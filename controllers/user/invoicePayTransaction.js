//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const invoicesTotalAmount = require("../utils/invoicesTotalAmount");
const updateInvoiceRecord = require("../utils/updateInvoiceRecord");

//controllers
const walletInvoicePay = require("../transactions/intraBank/walletInvoicePay");

// transactions
const txstate = require("../transactions/states");

//models
const Bank = require("../../models/Bank");
const Infra = require("../../models/Infra");
const MerchantRule = require("../../models/merchant/MerchantRule");
const Merchant = require("../../models/merchant/Merchant");
const User = require("../../models/User");

module.exports = async (req, res) => {
	// Initiate transaction state
	const master_code = await txstate.initiate();
	const today = new Date();
	const { invoices, merchant_id } = req.body;
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
			status: 1,
		},
		function (err, user) {
			let errRes = errorMessage(err, user, "User is not valid");
			if (errRes.status == 0) {
				res.status(200).json(errRes);
			} else {
				MerchantRule.findOne(
					{ merchant_id: merchant_id, type: "WM-F", status: 1, active: 1 },
					(err, fee) => {
						let errRes = errorMessage(err, fee, "Fee rule not found");
						if (errRes.status == 0) {
							res.status(200).json(errRes);
						} else {
							MerchantRule.findOne(
								{
									merchant_id: merchant_id,
									type: "WM-C",
									status: 1,
									active: 1,
								},
								async (err, comm) => {
									let errRes = errorMessage(
										err,
										comm,
										"Commission rule not found"
									);
									if (errRes.status == 0) {
										res.status(200).json(errRes);
									} else {
										try {
											// all the users
											const bank = await Bank.findOne({
												_id: user.bank_id,
											});
											if (bank == null) {
												throw new Error("User has invalid bank");
											}
											const infra = await Infra.findOne({
												_id: bank.user_id,
											});
											if (infra == null) {
												throw new Error("User's bank has invalid infra");
											}

											const merchant = await Merchant.findOne({
												_id: merchant_id,
											});
											if (merchant == null) {
												throw new Error("Invoice has invalid merchant");
											}
											await Merchant.findOneAndUpdate(
												{
													_id: merchant_id,
													last_paid_at: {
														$lte: new Date(today.setHours(00, 00, 00)),
													},
												},
												{ amount_collected: 0 }
											);

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
												user,
												merchant,
												fee,
												comm
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

												txstate.reported(master_code);
												res.status(200).json(result);
											} else {
												res.status(200).json(result);
											}
										} catch (err) {
											res.status(200).json(catchError(err));
										}
									}
								}
							);
						}
					}
				);
			}
		}
	);
};
