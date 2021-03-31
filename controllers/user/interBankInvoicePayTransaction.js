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
					user.bank_id,
					"Inter Bank Wallet To Merchant"
				);
				Bank.findOne({ _id: user.bank_id }, (err, bank) => {
					let errRes = errorMessage(err, bank, "Bank not found");
					if (errRes.status == 0) {
						res.status(200).json(errRes);
					} else {
						var find = {
							merchant_id: merchant_id,
							type: "IBWM-F",
							status: 1,
							active: 1,
						};
						IBMerchantRule.findOne(find, (err, fee) => {
							let errRes = errorMessage(
								err,
								fee,
								"Inter Bank Fee rule not found"
							);
							if (errRes.status == 0) {
								res.status(200).json(errRes);
							} else {
								find = {
									merchant_id: merchant_id,
									type: "IBWM-C",
									status: 1,
									active: 1,
								};
								IBMerchantRule.findOne(find, async (err, comm) => {
									let errRes = errorMessage(
										err,
										comm,
										"Inter Bank Commission rule not found"
									);
									if (errRes.status == 0) {
										res.status(200).json(errRes);
									} else {
										try {
											var total_amount = 0;
											for (invoice of invoices) {
												var { id, penalty } = invoice;
												var inv = await Invoice.findOneAndUpdate(
													{
														_id: id,
														merchant_id: merchant_id,
														paid: 0,
														is_validated: 1,
													},
													{ penalt: penalty }
												);
												if (inv == null) {
													throw new Error(
														"Invoice id " +
															id +
															" is already paid or it belongs to different merchant"
													);
												}
												total_amount += inv.amount + penalty;
											}
											if (total_amount < 0) {
												throw new Error("Amount is a negative value");
											}
											console.log("Total Amount", total_amount);
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
												comm,
												comm,
											};

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
											var status_update_feedback;
											if (result.status == 1) {
												for (invoice of invoices) {
													var i = await Invoice.findOneAndUpdate(
														{ _id: invoice.id },
														{
															paid: 1,
															paid_by: "US",
															payer_id: user._id,
														}
													);
													if (i == null) {
														status_update_feedback =
															"Invoice status can not be updated";
													}

													var last_paid_at = new Date();
													var m = await Merchant.updateOne(
														{ _id: merchant._id },
														{
															last_paid_at: last_paid_at,
															$inc: {
																amount_collected: total_amount,
																amount_due: -total_amount,
																bills_paid: 1,
															},
														}
													);
													if (m == null) {
														status_update_feedback =
															"Merchant status can not be updated";
													}

													var mc = await MerchantPosition.updateOne(
														{ _id: i.creator_id },
														{
															last_paid_at: last_paid_at,
														}
													);
													if (mc == null) {
														status_update_feedback =
															"Merchant cashier status can not be updated";
													}

													var mb = await MerchantBranch.updateOne(
														{ _id: mc.branch_id },
														{
															last_paid_at: last_paid_at,
															$inc: {
																amount_collected: total_amount,
																amount_due: -total_amount,
																bills_paid: 1,
															},
														}
													);
													if (mb == null) {
														status_update_feedback =
															"Merchant Branch status can not be updated";
													}

													var ig = await InvoiceGroup.updateOne(
														{ _id: i.group_id },
														{
															last_paid_at: last_paid_at,
															$inc: {
																bills_paid: 1,
															},
														}
													);
													if (ig == null) {
														status_update_feedback =
															"Invoice group status can not be updated";
													}

													content =
														"E-Wallet:: Due amount " +
														i.amount +
														" is paid for invoice nummber " +
														i.number +
														" for purpose " +
														i.description;
													sendSMS(content, i.mobile);
												}
											}
											result.status_update_feedback = status_update_feedback;
											await txstate.completed(master_code);
											res.status(200).json(result);
										} catch (err) {
											console.log(err);
											var message = err;
											if (err && err.message) {
												message = err.message;
											}
											res.status(200).json({ status: 0, message: message });
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
