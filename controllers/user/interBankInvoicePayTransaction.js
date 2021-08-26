//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const invoicesTotalAmount = require("../utils/invoicesTotalAmount");
const updateInvoiceRecord = require("../utils/updateInvoiceRecord");

//controllers
const walletInvoicePay = require("../transactions/interBank/walletInvoicePay");

// transactions
const txstate = require("../transactions/services/states");

//models
const Bank = require("../../models/Bank");
const Infra = require("../../models/Infra");
const MerchantRule = require("../../models/merchant/MerchantRule");
const Merchant = require("../../models/merchant/Merchant");
const User = require("../../models/User");
const IBMerchantRule = require("../../models/merchant/InterBankRule");

//constants
const categoryConst = require("../transactions/constants/category");

module.exports = (req, res) => {
	const { invoices, merchant_id } = req.body;
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
			status: 1,
		},
		async function (err, user) {
			let errRes = errorMessage(err, user, "User is not valid");
			if (errRes.status == 0) {
				res.status(200).json(errRes);
			} else {
				// Initiate transaction
				const master_code = await txstate.initiate(
					categoryConst.MAIN,
					user.bank_id,
					"Inter Bank Wallet To Merchant"
				);
				Bank.findOne({ _id: user.bank_id }, (err1, bank) => {
					let errRes1 = errorMessage(err1, bank, "Bank not found");
					if (errRes1.status == 0) {
						res.status(200).json(errRes1);
					} else {
						var find = {
							merchant_id: merchant_id,
							type: "IBWM-F",
							status: 1,
							active: 1,
						};
						IBMerchantRule.findOne(find, (err2, fee) => {
							let errRes2 = errorMessage(
								err2,
								fee,
								"Inter Bank Fee rule not found"
							);
							if (errRes2.status == 0) {
								res.status(200).json(errRes2);
							} else {
								find = {
									merchant_id: merchant_id,
									type: "IBWM-C",
									status: 1,
									active: 1,
								};
								IBMerchantRule.findOne(find, async (err3, comm) => {
									let errRes3 = errorMessage(
										err3,
										comm,
										"Inter Bank Commission rule not found"
									);
									if (errRes3.status == 0) {
										res.status(200).json(errRes3);
									} else {
										try {
											// all the users

											let infra = await Infra.findOne({
												_id: bank.user_id,
											});
											if (infra == null) {
												throw new Error("User's bank has invalid infra");
											}

											let merchant = await Merchant.findOne({
												_id: merchant_id,
											});
											if (merchant == null) {
												throw new Error("Invoice has invalid merchant");
											}

											let merchantBank = await Bank.findOne({
												_id: merchant.bank_id,
												status: 1,
											});
											if (merchantBank == null) {
												throw new Error("Merchant has invalid bank");
											}

											const today = new Date();
											await Merchant.findOneAndUpdate(
												{
													_id: merchant._id,
													last_paid_at: {
														$lte: new Date(today.setHours(00, 00, 00)),
													},
												},
												{ amount_collected: 0 }
											);
											var rule1 = {
												fee: fee,
												comm: comm,
											};

											const total_amount = await invoicesTotalAmount(
												invoices,
												merchant_id
											);

											let transfer = {
												amount: total_amount,
												master_code: master_code,
											};

											var result = await walletInvoicePay(
												transfer,
												infra,
												bank,
												merchantBank,
												user,
												merchant,
												rule1
											);
											if (result.status == 1) {
												let otherInfo = {
													total_amount: total_amount,
													master_code: master_code,
													paid_by: "US",
													payer_id: user._id,
												};

												let status = await updateInvoiceRecord(
													req.body,
													otherInfo
												);
												if (status != null) {
													throw new Error(status);
												}

												txstate.completed(categoryConst.MAIN, master_code);
												res.status(200).json(result);
											} else {
												txstate.failed(categoryConst.MAIN, master_code);
												res.status(200).json(result);
											}
										} catch (err4) {
											txstate.failed(categoryConst.MAIN, master_code);
											console.log(err4);
											var message4 = err4;
											if (err4 && err4.message) {
												message4 = err4.message;
											}
											res.status(200).json({ status: 0, message: message4 });
										}
									}
								});
							}
						});
					}
				});
			}
		}
	);
};
