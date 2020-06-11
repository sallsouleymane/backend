const express = require("express");
const router = express.Router();

//services
const blockchain = require("../services/Blockchain.js");

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const { calculateShare } = require("./utils/utility");

const cashierInvoicePay = require("./transactions/cashierInvoicePay");
const userInvoicePay = require("./transactions/userInvoicePay");

const Bank = require("../models/Bank");
const Branch = require("../models/Branch");
const Infra = require("../models/Infra");
const MerchantFee = require("../models/merchant/MerchantFee");
const MerchantBranch = require("../models/merchant/MerchantBranch");
const MerchantCashier = require("../models/merchant/MerchantCashier");
const Merchant = require("../models/merchant/Merchant");
const Cashier = require("../models/Cashier");
const User = require("../models/User");
const Invoice = require("../models/merchant/Invoice");
const Commission = require("../models/merchant/BankCommission");

const jwtTokenAuth = require("./JWTTokenAuth");

router.post("/cashier/getUserInvoices", (req, res) => {
	const { token, mobile } = req.body;
	Cashier.findOne(
		{
			token,
			status: 1,
		},
		function (err, cashier) {
			if (err || cashier == null) {
				console.log(err);
				res.status(200).json({
					status: 0,
					message: "Internal server error",
				});
			} else {
				Invoice.find({ mobile: mobile }, async (err, invoices) => {
					if (err ) {
						console.log(err);
						res.status(200).json({
							status: 0,
							message: "Internal server error",
						});
					} else {
					console.log(invoices);
					var invoicePromises = invoices.map(async (invoice) => {
						var merchant = await Merchant.findOne({
							_id: invoice.merchant_id,
							status: 1,
						});
						if (merchant != null && merchant.bank_id == cashier.bank_id) {
							return invoice;
						}
					});
					var result = await Promise.all(invoicePromises);
					res.status(200).json({
						status: 1,
						invoices: result,
					});
				}
				});
			
			}
		}
	);
});

router.post("/cashier/payInvoice", (req, res) => {
	const { token, invoice_id, amount } = req.body;
	Cashier.findOne(
		{
			token,
			status: 1,
		},
		function (err, cashier) {
			if (err) {
				console.log(err);
				res.status(200).json({
					status: 0,
					message: "Internal server error",
				});
			} else if (cashier == null) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else {
				Invoice.findOne({ _id: invoice_id, paid: 0 }, (err, invoice) => {
					if (err) {
						console.log(err);
						res.status(200).json({
							status: 0,
							message: "Internal server error",
						});
					} else if (invoice == null) {
						res.status(200).json({
							status: 0,
							message: "Invoice is not valid or already paid",
						});
					} else {
						if (invoice.amount != amount) {
							res.status(200).json({
								status: 0,
								message: "Invoice amount to be paid is " + invoice.amount,
							});
						} else {
							MerchantFee.findOne(
								{ merchant_id: invoice.merchant_id, type: 1 },
								(err, fee) => {
									if (err) {
										console.log(err);
										res.status(200).json({
											status: 0,
											message: "Internal server error",
										});
									} else if (fee == null) {
										res.status(200).json({
											status: 0,
											message: "Fee rule not found",
										});
									} else {
										Commission.findOne(
											{ merchant_id: invoice.merchant_id },
											async (err, comm) => {
												if (err) {
													console.log(err);
													res.status(200).json({
														status: 0,
														message: "Internal server error",
													});
												} else if (comm == null) {
													res.status(200).json({
														status: 0,
														message: "Commission rule not found",
													});
												} else {
													// all the users
													let branch = await Branch.findOne({
														_id: cashier.branch_id,
													});
													let bank = await Bank.findOne({
														_id: branch.bank_id,
													});

													// check branch operational wallet balance
													const branchOpWallet =
														branch.bcode + "_operational@" + bank.name;
													var bal = await blockchain.getBalance(branchOpWallet);
													console.log(branchOpWallet);
													if (Number(bal) < amount) {
														res.status(200).json({
															status: 0,
															message:
																"Not enough balance. Recharge Your wallet.",
														});
													} else {
														let infra = await Infra.findOne({
															_id: bank.user_id,
														});
														let merchant = await Merchant.findOne({
															_id: invoice.merchant_id,
														});

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
														var result = await cashierInvoicePay(
															amount,
															infra,
															bank,
															branch,
															merchant,
															fee,
															comm
														);
														if (result.status == 1) {
															await Invoice.updateOne(
																{ _id: invoice_id },
																{ paid: 1 }
															);
															await Merchant.updateOne(
																{ _id: merchant._id },
																{
																	last_paid_at: new Date(),
																	$inc: {
																		amount_collected: amount,
																		amount_due: -amount,
																		bills_paid: 1,
																	},
																}
															);
															await MerchantBranch.updateOne(
																{ _id: branch._id },
																{
																	last_paid_at: new Date(),
																	$inc: {
																		amount_collected: amount,
																		amount_due: -amount,
																		bills_paid: 1,
																	},
																}
															);
															bankFee = calculateShare("bank", amount, fee);
															await Cashier.updateOne(
																{ _id: cashier._id },
																{
																	$inc: {
																		cash_in_hand: amount + bankFee,
																	},
																}
															);
														}

														content =
															"<p>E-Wallet Application: You invoice nummber: " +
															invoice.number +
															" for purpose " +
															invoice.description +
															" is paid at cashier counter. Amount Paid: " +
															invoice.amount;
														sendSMS(content, invoice.mobile);
														res.status(200).json(result);
													}
												}
											}
										);
									}
								}
							);
						}
					}
				});
			}
		}
	);
});

router.post("/user/getInvoices", jwtTokenAuth, (req, res) => {
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
			status: 1,
		},
		function (err, user) {
			if (err || user == null) {
				console.log(err);
				res.status(200).json({
					status: 0,
					message: "Internal server error",
				});
			} else {
				Bank.findOne({ name: user.bank }, (err, bank) => {
					if (err || bank == null) {
						console.log(err);
						res.status(200).json({
							status: 0,
							message: "Internal server error",
						});
					} else {
						Invoice.find({ mobile: user.mobile }, async (err, invoices) => {
							if (err) {
								console.log(err);
								res.status(200).json({
									status: 0,
									message: "Internal server error",
								});
							} else {
								var invoicePromises = invoices.map(async (invoice) => {
									var merchant = await Merchant.findOne({
										_id: invoice.merchant_id,
										status: 1,
									});
									if (merchant != null && merchant.bank_id == bank._id) {
										return invoice;
									}
								});
								var result = await Promise.all(invoicePromises);
								res.status(200).json({
									status: 1,
									invoices: result,
								});
							}
						});
					}
				});
			}
		}
	);
});

router.post("/user/payInvoice", jwtTokenAuth, (req, res) => {
	const { invoice_id, amount } = req.body;
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
			status: 1,
		},
		function (err, user) {
			if (err || user == null) {
				console.log(err);
				res.status(200).json({
					status: 0,
					message: "Internal server error",
				});
			} else {
				Invoice.findOne({ _id: invoice_id }, (err, invoice) => {
					if (err) {
						console.log(err);
						res.status(200).json({
							status: 0,
							message: "Internal server error",
						});
					} else if (invoice == null) {
						res.status(200).json({
							status: 0,
							message: "Invoice is not valid",
						});
					} else {
						if (invoice.amount != amount) {
							res.status(200).json({
								status: 0,
								message: "Invoice amount to be paid is " + invoice.amount,
							});
						} else {
							MerchantCashier.findOne({_id: invoice.cashier_id},(err, mcashier)=>{
								if (err || mcashier == null) {
									console.log(err);
									res.status(200).json({
										status: 0,
										message: "Internal server error",
									});
								} else {
							
							MerchantFee.findOne(
								{ merchant_id: invoice.merchant_id, type: 1 },
								(err, fee) => {
									if (err) {
										console.log(err);
										res.status(200).json({
											status: 0,
											message: "Internal server error",
										});
									} else if (fee == null) {
										res.status(200).json({
											status: 0,
											message: "Fee rule not found",
										});
									} else {
										Commission.findOne(
											{ merchant_id: invoice.merchant_id },
											async (err, comm) => {
												if (err) {
													console.log(err);
													res.status(200).json({
														status: 0,
														message: "Internal server error",
													});
												} else if (comm == null) {
													res.status(200).json({
														status: 0,
														message: "Commission rule not found",
													});
												} else {
													// all the users
													let bank = await Bank.findOne({
														name: user.bank,
													});

													// check branch operational wallet balance
													const userOpWallet = user.mobile + "@" + bank.name;
													var bal = await blockchain.getBalance(userOpWallet);
													if (Number(bal) < amount) {
														res.status(200).json({
															status: 0,
															message:
																"Not enough balance. Recharge Your wallet.",
														});
													} else {
														let infra = await Infra.findOne({
															_id: bank.user_id,
														});
														let merchant = await Merchant.findOne({
															_id: invoice.merchant_id,
														});

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
														var result = await userInvoicePay(
															amount,
															infra,
															bank,
															user,
															merchant,
															fee,
															comm
														);
														if (result.status == 1) {
															await Invoice.updateOne(
																{ _id: invoice_id },
																{ paid: 1 }
															);
															await Merchant.updateOne(
																{ _id: merchant._id },
																{
																	last_paid_at: new Date(),
																	$inc: {
																		amount_collected: amount,
																		amount_due: -amount,
																		bills_paid: 1,
																	},
																}
															);
															await MerchantBranch.updateOne(
																{ _id: mcashier.branch_id },
																{
																	last_paid_at: new Date(),
																	$inc: {
																		amount_collected: amount,
																		amount_due: -amount,
																		bills_paid: 1,
																	},
																}
															);
														}

														content =
															"<p>E-Wallet Application: You invoice nummber: " +
															invoice.number +
															" for purpose " +
															invoice.description +
															" is paid. Amount Paid: " +
															invoice.amount;
														sendSMS(content, invoice.mobile);
														res.status(200).json(result);
													}
												}
											}
										);
									}
								}
							);
							}
						});
						}
					}
				});
			}
		}
	);
});

module.exports = router;
