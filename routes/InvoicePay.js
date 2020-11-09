const express = require("express");
const router = express.Router();

//services
const blockchain = require("../services/Blockchain.js");

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const { calculateShare } = require("./utils/calculateShare");

const cashierInvoicePay = require("./transactions/cashierInvoicePay");
const userInvoicePay = require("./transactions/userInvoicePay");
const partnerCashierInvoicePay = require("./transactions/partnerCashierInvoicePay");
const merchantCashierInvoicePay = require("./transactions/merchantCashierInvoicePay");
const iBCashierInvoicePay = require("./transactions/interBank/cashierInvoicePay");
const iBuserInvoicePay = require("./transactions/interBank/userInvoicePay");
const iBpartnerCashierInvoicePay = require("./transactions/interBank/partnerCashierInvoicePay");

const Bank = require("../models/Bank");
const Branch = require("../models/Branch");
const Infra = require("../models/Infra");
const MerchantRule = require("../models/merchant/MerchantRule");
const IBMerchantRule = require("../models/merchant/InterBankRule");
const MerchantBranch = require("../models/merchant/MerchantBranch");
const MerchantCashier = require("../models/merchant/MerchantCashier");
const Merchant = require("../models/merchant/Merchant");
const Cashier = require("../models/Cashier");
const User = require("../models/User");
const Invoice = require("../models/merchant/Invoice");
const InvoiceGroup = require("../models/merchant/InvoiceGroup");
const Partner = require("../models/partner/Partner");
const PartnerCashier = require("../models/partner/Cashier");
const PartnerBranch = require("../models/partner/Branch");
const InterBankRule = require("../models/InterBankRule");

const jwtTokenAuth = require("./JWTTokenAuth");

router.post("/user/interBank/payInvoice", jwtTokenAuth, (req, res) => {
	const { invoices, merchant_id } = req.body;
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
			status: 1,
		},
		function (err, user) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (user == null) {
				console.log(err);
				res.status(200).json({
					status: 0,
					message: "User is not valid",
				});
			} else {
				Bank.findOne({ _id: user.bank_id }, (err, bank) => {
					if (err) {
						console.log(err);
						var message = err;
						if (err.message) {
							message = err.message;
						}
						res.status(200).json({
							status: 0,
							message: message,
						});
					} else if (bank == null) {
						res.status(200).json({
							status: 0,
							message: "Bank not found",
						});
					} else {
						var find = {
							merchant_id: merchant_id,
							type: "IBWM-F",
							status: 1,
							active: 1,
						};
						IBMerchantRule.findOne(find, (err, fee) => {
							if (err) {
								console.log(err);
								var message = err;
								if (err.message) {
									message = err.message;
								}
								res.status(200).json({
									status: 0,
									message: message,
								});
							} else if (fee == null) {
								res.status(200).json({
									status: 0,
									message: "Inter Bank Fee rule not found",
								});
							} else {
								find = {
									merchant_id: merchant_id,
									type: "IBWM-C",
									status: 1,
									active: 1,
								};
								IBMerchantRule.findOne(find, async (err, comm) => {
									if (err) {
										console.log(err);
										var message = err;
										if (err.message) {
											message = err.message;
										}
										res.status(200).json({
											status: 0,
											message: message,
										});
									} else if (comm == null) {
										res.status(200).json({
											status: 0,
											message: "Inter Bank Commission rule not found",
										});
									} else {
										try {
											var total_amount = 0;
											for (invoice of invoices) {
												var { id, penalty } = invoice;
												var inv = await Invoice.findOne({
													_id: id,
													merchant_id: merchant_id,
													paid: 0,
													is_validated: 1,
												});
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
											var result = await iBuserInvoicePay(
												total_amount,
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

													var mc = await MerchantCashier.updateOne(
														{ _id: i.cashier_id },
														{
															last_paid_at: last_paid_at,
															$inc: {
																bills_paid: 1,
															},
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
});

router.post(
	"/partnerCashier/interBank/payInvoice",
	jwtTokenAuth,
	(req, res) => {
		const { invoices, merchant_id } = req.body;
		const jwtusername = req.sign_creds.username;
		PartnerCashier.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err, cashier) {
				if (err) {
					console.log(err);
					var message = err;
					if (err.message) {
						message = err.message;
					}
					res.status(200).json({
						status: 0,
						message: message,
					});
				} else if (cashier == null) {
					res.status(200).json({
						status: 0,
						message:
							"Token changed or user not valid. Try to login again or contact system administrator.",
					});
				} else {
					Partner.findOne({ _id: cashier.partner_id }, (err, partner) => {
						var find = {
							merchant_id: merchant_id,
							type: "IBNWM-F",
							status: 1,
							active: 1,
						};
						IBMerchantRule.findOne(find, (err, fee1) => {
							if (err) {
								console.log(err);
								var message = err;
								if (err.message) {
									message = err.message;
								}
								res.status(200).json({
									status: 0,
									message: message,
								});
							} else if (fee1 == null) {
								res.status(200).json({
									status: 0,
									message: "Inter Bank Fee rule not found",
								});
							} else {
								find = {
									merchant_id: merchant_id,
									type: "IBNWM-C",
									status: 1,
									active: 1,
								};
								IBMerchantRule.findOne(find, (err, comm1) => {
									if (err) {
										console.log(err);
										var message = err;
										if (err.message) {
											message = err.message;
										}
										res.status(200).json({
											status: 0,
											message: message,
										});
									} else if (comm1 == null) {
										res.status(200).json({
											status: 0,
											message: "Inter Bank Commission rule not found",
										});
									} else {
										MerchantRule.findOne(
											{
												merchant_id: merchant_id,
												type: "NWM-F",
												status: 1,
												active: 1,
											},
											(err, fee2) => {
												if (err) {
													console.log(err);
													var message = err;
													if (err.message) {
														message = err.message;
													}
													res.status(200).json({
														status: 0,
														message: message,
													});
												} else if (fee2 == null) {
													res.status(200).json({
														status: 0,
														message: "Fee rule not found",
													});
												} else {
													MerchantRule.findOne(
														{
															merchant_id: merchant_id,
															type: "NWM-C",
															status: 1,
															active: 1,
														},
														async (err, comm2) => {
															if (err) {
																console.log(err);
																var message = err;
																if (err.message) {
																	message = err.message;
																}
																res.status(200).json({
																	status: 0,
																	message: message,
																});
															} else if (comm2 == null) {
																res.status(200).json({
																	status: 0,
																	message: "Commission rule not found",
																});
															} else {
																try {
																	var total_amount = 0;
																	for (invoice of invoices) {
																		var { id, penalty } = invoice;
																		var inv = await Invoice.findOne({
																			_id: id,
																			merchant_id: merchant_id,
																			paid: 0,
																			is_validated: 1,
																		});
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
																		throw new Error(
																			"Amount is a negative value"
																		);
																	}

																	// all the users
																	let branch = await PartnerBranch.findOne({
																		_id: cashier.branch_id,
																		status: 1,
																	});
																	if (branch == null) {
																		throw new Error(
																			"Cashier has invalid branch"
																		);
																	}

																	let bank = await Bank.findOne({
																		_id: partner.bank_id,
																		status: 1,
																	});
																	if (bank == null) {
																		throw new Error(
																			"Cashier's Partner has invalid bank"
																		);
																	}

																	let infra = await Infra.findOne({
																		_id: bank.user_id,
																	});
																	if (infra == null) {
																		throw new Error(
																			"Cashier's bank has invalid infra"
																		);
																	}

																	let merchant = await Merchant.findOne({
																		_id: merchant_id,
																	});
																	if (merchant == null) {
																		throw new Error(
																			"Invoice has invalid merchant"
																		);
																	}
																	let merchantBank = await Bank.findOne({
																		_id: merchant.bank_id,
																		status: 1,
																	});
																	if (merchantBank == null) {
																		throw new Error(
																			"Merchant has invalid bank"
																		);
																	}

																	const today = new Date();
																	await Merchant.findOneAndUpdate(
																		{
																			_id: merchant._id,
																			last_paid_at: {
																				$lte: new Date(
																					today.setHours(00, 00, 00)
																				),
																			},
																		},
																		{ amount_collected: 0 }
																	);

																	var rule1 = {
																		fee: fee1,
																		comm: comm1,
																	};
																	var rule2 = {
																		fee: fee2,
																		comm: comm2,
																	};

																	var result = await iBpartnerCashierInvoicePay(
																		total_amount,
																		infra,
																		bank,
																		merchantBank,
																		branch,
																		merchant,
																		rule1,
																		rule2
																	);
																	var status_update_feedback;
																	if (result.status == 1) {
																		for (invoice of invoices) {
																			var i = await Invoice.findOneAndUpdate(
																				{ _id: invoice.id },
																				{
																					paid: 1,
																					paid_by: "PC",
																				}
																			);
																			if (i == null) {
																				status_update_feedback =
																					"Invoice paid status can not be updated";
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

																			var mc = await MerchantCashier.updateOne(
																				{ _id: i.cashier_id },
																				{
																					last_paid_at: last_paid_at,
																					$inc: {
																						bills_paid: 1,
																					},
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
																					"Merchant branch status can not be updated";
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
																			var c = await PartnerCashier.updateOne(
																				{ _id: cashier._id },
																				{
																					$inc: {
																						cash_received:
																							total_amount + result.bankFee,
																						cash_in_hand:
																							total_amount + result.bankFee,
																						fee_generated:
																							result.partnerFeeShare,
																						commission_generated:
																							result.partnerCommShare,
																						total_trans: 1,
																					},
																				}
																			);
																			if (c == null) {
																				status_update_feedback =
																					"Bank cashier's status can not be updated";
																			}

																			content =
																				"E-Wallet:  Amount " +
																				i.amount +
																				" is paid for invoice nummber " +
																				i.number +
																				" for purpose " +
																				i.description;
																			sendSMS(content, i.mobile);
																		}
																	}
																	result.status_update_feedback = status_update_feedback;
																	res.status(200).json(result);
																} catch (err) {
																	console.log(err);
																	var message = err;
																	if (err && err.message) {
																		message = err.message;
																	}
																	res.status(200).json({
																		status: 0,
																		message: message,
																		err: err,
																	});
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
						});
					});
				}
			}
		);
	}
);

router.post("/cashier/interBank/payInvoice", (req, res) => {
	const { token, invoices, merchant_id } = req.body;
	Cashier.findOne(
		{
			token,
			status: 1,
		},
		function (err, cashier) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (cashier == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				var find = {
					merchant_id: merchant_id,
					type: "IBNWM-F",
					status: 1,
					active: 1,
				};
				IBMerchantRule.findOne(find, (err, fee1) => {
					if (err) {
						console.log(err);
						var message = err;
						if (err.message) {
							message = err.message;
						}
						res.status(200).json({
							status: 0,
							message: message,
						});
					} else if (fee1 == null) {
						res.status(200).json({
							status: 0,
							message: "Inter Bank Fee rule not found",
						});
					} else {
						find = {
							merchant_id: merchant_id,
							type: "IBNWM-C",
							status: 1,
							active: 1,
						};
						IBMerchantRule.findOne(find, (err, comm1) => {
							if (err) {
								console.log(err);
								var message = err;
								if (err.message) {
									message = err.message;
								}
								res.status(200).json({
									status: 0,
									message: message,
								});
							} else if (comm1 == null) {
								res.status(200).json({
									status: 0,
									message: "Inter Bank Commission rule not found",
								});
							} else {
								MerchantRule.findOne(
									{
										merchant_id: merchant_id,
										type: "NWM-F",
										status: 1,
										active: 1,
									},
									(err, fee2) => {
										if (err) {
											console.log(err);
											var message = err;
											if (err.message) {
												message = err.message;
											}
											res.status(200).json({
												status: 0,
												message: message,
											});
										} else if (fee2 == null) {
											res.status(200).json({
												status: 0,
												message: "Fee rule not found",
											});
										} else {
											MerchantRule.findOne(
												{
													merchant_id: merchant_id,
													type: "NWM-C",
													status: 1,
													active: 1,
												},
												async (err, comm2) => {
													if (err) {
														console.log(err);
														var message = err;
														if (err.message) {
															message = err.message;
														}
														res.status(200).json({
															status: 0,
															message: message,
														});
													} else if (comm2 == null) {
														res.status(200).json({
															status: 0,
															message: "Commission rule not found",
														});
													} else {
														try {
															var total_amount = 0;
															for (invoice of invoices) {
																var { id, penalty } = invoice;
																var inv = await Invoice.findOne({
																	_id: id,
																	merchant_id: merchant_id,
																	paid: 0,
																	is_validated: 1,
																});
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

															// all the users
															let branch = await Branch.findOne({
																_id: cashier.branch_id,
																status: 1,
															});
															if (branch == null) {
																throw new Error("Cashier has invalid branch");
															}

															let bank = await Bank.findOne({
																_id: branch.bank_id,
																status: 1,
															});
															if (bank == null) {
																throw new Error(
																	"Cashier's Branch has invalid bank"
																);
															}

															let infra = await Infra.findOne({
																_id: bank.user_id,
															});
															if (infra == null) {
																throw new Error(
																	"Cashier's bank has invalid infra"
																);
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
																throw new Error("Merchant's Bank not found");
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
																fee: fee1,
																comm: comm1,
															};

															var rule2 = {
																fee: fee2,
																comm: comm2,
															};

															var result = await iBCashierInvoicePay(
																total_amount,
																infra,
																bank,
																merchantBank,
																branch,
																merchant,
																rule1,
																rule2
															);
															var status_update_feedback;
															if (result.status == 1) {
																for (invoice of invoices) {
																	var i = await Invoice.findOneAndUpdate(
																		{ _id: invoice.id },
																		{
																			paid: 1,
																			paid_by: "BC",
																		}
																	);
																	if (i == null) {
																		status_update_feedback =
																			"Invoice paid status can not be updated";
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

																	var mc = await MerchantCashier.updateOne(
																		{ _id: i.cashier_id },
																		{
																			last_paid_at: last_paid_at,
																			$inc: {
																				bills_paid: 1,
																			},
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
																			"Merchant branch status can not be updated";
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

																	var c = await Cashier.updateOne(
																		{ _id: cashier._id },
																		{
																			$inc: {
																				cash_received:
																					total_amount + result.bankFee,
																				cash_in_hand:
																					total_amount + result.bankFee,
																				fee_generated: result.partnerFeeShare,
																				commission_generated:
																					result.partnerCommShare,
																				total_trans: 1,
																			},
																		}
																	);
																	if (c == null) {
																		status_update_feedback =
																			"Bank cashier's status can not be updated";
																	}

																	content =
																		"E-Wallet:  Amount " +
																		i.amount +
																		" is paid for invoice nummber " +
																		i.number +
																		" for purpose " +
																		i.description;
																	sendSMS(content, i.mobile);
																}
															}
															result.status_update_feedback = status_update_feedback;
															res.status(200).json(result);
														} catch (err) {
															console.log(err);
															var message = err.toString();
															if (err.message) {
																message = err.message;
															}
															res.status(200).json({
																status: 0,
																message: message,
																err: err,
															});
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
				});
			}
		}
	);
});

router.post(
	"/merchantCashier/getInvoicesByCustomerCode",
	jwtTokenAuth,
	(req, res) => {
		const { customer_code } = req.body;
		const jwtusername = req.sign_creds.username;
		MerchantCashier.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err, cashier) {
				if (err) {
					console.log(err);
					var message = err;
					if (err.message) {
						message = err.message;
					}
					res.status(200).json({
						status: 0,
						message: message,
					});
				} else if (cashier == null) {
					res.status(200).json({
						status: 0,
						message: "Cashier is not activated.",
					});
				} else {
					Invoice.find(
						{
							is_validated: 1,
							merchant_id: cashier.merchant_id,
							customer_code: customer_code,
						},
						(err, invoices) => {
							if (err) {
								console.log(err);
								var message = err;
								if (err.message) {
									message = err.message;
								}
								res.status(200).json({
									status: 0,
									message: message,
								});
							} else if (invoices.length == 0) {
								res.status(200).json({
									status: 0,
									message: "Invoice not found",
								});
							} else {
								res.status(200).json({
									status: 1,
									invoice: invoices,
								});
							}
						}
					);
				}
			}
		);
	}
);

router.post(
	"/merchantCashier/getInvoicesByNumber",
	jwtTokenAuth,
	(req, res) => {
		const { number } = req.body;
		const jwtusername = req.sign_creds.username;
		MerchantCashier.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err, cashier) {
				if (err) {
					console.log(err);
					var message = err;
					if (err.message) {
						message = err.message;
					}
					res.status(200).json({
						status: 0,
						message: message,
					});
				} else if (cashier == null) {
					res.status(200).json({
						status: 0,
						message: "Cashier is not activated.",
					});
				} else {
					Invoice.find(
						{
							is_validated: 1,
							merchant_id: cashier.merchant_id,
							$or: [{ number: number }, { reference_invoice: number }],
						},
						(err, invoices) => {
							if (err) {
								console.log(err);
								var message = err;
								if (err.message) {
									message = err.message;
								}
								res.status(200).json({
									status: 0,
									message: message,
								});
							} else if (invoices.length == 0) {
								res.status(200).json({
									status: 0,
									message: "Invoice not found",
								});
							} else {
								res.status(200).json({
									status: 1,
									invoice: invoices,
								});
							}
						}
					);
				}
			}
		);
	}
);

router.post(
	"/merchantCashier/getInvoicesByMobile",
	jwtTokenAuth,
	(req, res) => {
		const { mobile } = req.body;
		const jwtusername = req.sign_creds.username;
		MerchantCashier.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err, cashier) {
				if (err) {
					console.log(err);
					var message = err;
					if (err.message) {
						message = err.message;
					}
					res.status(200).json({
						status: 0,
						message: message,
					});
				} else if (cashier == null) {
					console.log(err);
					res.status(200).json({
						status: 0,
						message: "Cashier is not valid",
					});
				} else {
					Invoice.find(
						{
							mobile: mobile,
							is_validated: 1,
							merchant_id: cashier.merchant_id,
						},
						(err, invoices) => {
							if (err) {
								console.log(err);
								var message = err;
								if (err.message) {
									message = err.message;
								}
								res.status(200).json({
									status: 0,
									message: message,
								});
							} else {
								res.status(200).json({
									status: 1,
									invoices: invoices,
								});
							}
						}
					);
				}
			}
		);
	}
);

router.post("/merchantCashier/payInvoice", jwtTokenAuth, (req, res) => {
	const { invoices } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (cashier == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Merchant.findOne({ _id: cashier.merchant_id }, (err, merchant) => {
					if (err) {
						console.log(err);
						var message = err;
						if (err.message) {
							message = err.message;
						}
						res.status(200).json({
							status: 0,
							message: message,
						});
					} else if (merchant == null) {
						res.status(200).json({
							status: 0,
							message: "Cashier's Merchant not found",
						});
					} else {
						MerchantRule.findOne(
							{ merchant_id: merchant._id, type: "M-C", status: 1, active: 1 },
							async (err, comm) => {
								if (err) {
									console.log(err);
									var message = err;
									if (err.message) {
										message = err.message;
									}
									res.status(200).json({
										status: 0,
										message: message,
									});
								} else if (comm == null) {
									res.status(200).json({
										status: 0,
										message: "Commission rule not found",
									});
								} else {
									try {
										var total_amount = 0;
										for (invoice of invoices) {
											var { id, penalty } = invoice;
											var inv = await Invoice.findOne({
												_id: id,
												merchant_id: merchant._id,
												paid: 0,
												is_validated: 1,
											});
											if (inv == null) {
												throw new Error(
													"Invoice id " +
														id +
														" is already paid or it belongs to different merchant"
												);
											}
											if (isNaN(penalty)) {
												throw new Error("Penalty is not a number");
											}
											total_amount += inv.amount + penalty;
										}
										if (total_amount < 0) {
											throw new Error("Amount is a negative value");
										}
										let bank = await Bank.findOne({
											_id: comm.bank_id,
											status: 1,
										});
										if (bank == null) {
											throw new Error("Merchant Cashier has invalid bank");
										}
										let infra = await Infra.findOne({
											_id: bank.user_id,
										});
										if (infra == null) {
											throw new Error("Cashier's bank has invalid infra");
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

										var result = await merchantCashierInvoicePay(
											total_amount,
											infra,
											bank,
											merchant,
											comm
										);
										var status_update_feedback;
										if (result.status == 1) {
											for (invoice of invoices) {
												var i = await Invoice.findOneAndUpdate(
													{ _id: invoice.id },
													{
														paid: 1,
														paid_by: "MC",
													}
												);
												if (i == null) {
													status_update_feedback =
														"Invoice paid status can not be updated";
												}

												var last_paid_at = new Date();
												var m = await Merchant.updateOne(
													{ _id: merchant._id },
													{
														$set: { last_paid_at: last_paid_at },
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

												var mc = await MerchantCashier.updateOne(
													{ _id: i.cashier_id },
													{
														$set: { last_paid_at: last_paid_at },
														$inc: {
															bills_paid: 1,
														},
													}
												);
												if (mc == null) {
													status_update_feedback =
														"Merchant cashier status can not be updated";
												}

												var mb = await MerchantBranch.updateOne(
													{ _id: mc.branch_id },
													{
														$set: { last_paid_at: last_paid_at },
														$inc: {
															amount_collected: total_amount,
															amount_due: -total_amount,
															bills_paid: 1,
														},
													}
												);
												if (mb == null) {
													status_update_feedback =
														"Merchant branch status can not be updated";
												}

												var ig = await InvoiceGroup.updateOne(
													{ _id: i.group_id },
													{
														$set: { last_paid_at: last_paid_at },
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
													"E-Wallet:  Amount " +
													i.amount +
													" is paid for invoice nummber " +
													i.number +
													" for purpose " +
													i.description;
												sendSMS(content, i.mobile);
											}
										}
										result.status_update_feedback = status_update_feedback;
										res.status(200).json(result);
									} catch (err) {
										console.log(err);
										var message = err;
										if (err && err.message) {
											message = err.message;
										}
										res
											.status(200)
											.json({ status: 0, message: message, err: err });
									}
								}
							}
						);
					}
				});
			}
		}
	);
});

router.post("/partnerCashier/payInvoice", jwtTokenAuth, (req, res) => {
	const { invoices, merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (cashier == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Partner.findOne({ _id: cashier.partner_id }, (err, partner) => {
					MerchantRule.findOne(
						{ merchant_id: merchant_id, type: "NWM-F", status: 1, active: 1 },
						(err, fee) => {
							if (err) {
								console.log(err);
								var message = err;
								if (err.message) {
									message = err.message;
								}
								res.status(200).json({
									status: 0,
									message: message,
								});
							} else if (fee == null) {
								res.status(200).json({
									status: 0,
									message: "Fee rule not found",
								});
							} else {
								MerchantRule.findOne(
									{
										merchant_id: merchant_id,
										type: "NWM-C",
										status: 1,
										active: 1,
									},
									async (err, comm) => {
										if (err) {
											console.log(err);
											var message = err;
											if (err.message) {
												message = err.message;
											}
											res.status(200).json({
												status: 0,
												message: message,
											});
										} else if (comm == null) {
											res.status(200).json({
												status: 0,
												message: "Commission rule not found",
											});
										} else {
											try {
												var total_amount = 0;
												for (invoice of invoices) {
													var { id, penalty } = invoice;
													var inv = await Invoice.findOne({
														_id: id,
														merchant_id: merchant_id,
														paid: 0,
														is_validated: 1,
													});
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

												// all the users
												let branch = await PartnerBranch.findOne({
													_id: cashier.branch_id,
													status: 1,
												});
												if (branch == null) {
													throw new Error("Cashier has invalid branch");
												}

												let bank = await Bank.findOne({
													_id: partner.bank_id,
													status: 1,
												});
												if (bank == null) {
													throw new Error("Cashier's Partner has invalid bank");
												}

												// check branch operational wallet balance
												const branchOpWallet = branch.wallet_ids.operational;
												var bal = await blockchain.getBalance(branchOpWallet);
												if (Number(bal) < total_amount) {
													res.status(200).json({
														status: 0,
														message:
															"Not enough balance. Recharge Your wallet.",
													});
												} else {
													let infra = await Infra.findOne({
														_id: bank.user_id,
													});
													if (infra == null) {
														throw new Error("Cashier's bank has invalid infra");
													}

													let merchant = await Merchant.findOne({
														_id: merchant_id,
													});
													if (merchant == null) {
														throw new Error("Invoice has invalid merchant");
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

													var result = await partnerCashierInvoicePay(
														total_amount,
														infra,
														bank,
														branch,
														merchant,
														fee,
														comm
													);
													var status_update_feedback;
													if (result.status == 1) {
														for (invoice of invoices) {
															var i = await Invoice.findOneAndUpdate(
																{ _id: invoice.id },
																{
																	paid: 1,
																	paid_by: "PC",
																}
															);
															if (i == null) {
																status_update_feedback =
																	"Invoice paid status can not be updated";
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

															var mc = await MerchantCashier.updateOne(
																{ _id: i.cashier_id },
																{
																	last_paid_at: last_paid_at,
																	$inc: {
																		bills_paid: 1,
																	},
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
																	"Merchant branch status can not be updated";
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

															bankFee = calculateShare(
																"bank",
																total_amount,
																fee
															);
															partnerFeeShare = calculateShare(
																"partner",
																total_amount,
																fee
															);
															partnerCommShare = calculateShare(
																"partner",
																total_amount,
																comm
															);
															var c = await PartnerCashier.updateOne(
																{ _id: cashier._id },
																{
																	$inc: {
																		cash_received: total_amount + bankFee,
																		cash_in_hand: total_amount + bankFee,
																		fee_generated: partnerFeeShare,
																		commission_generated: partnerCommShare,
																		total_trans: 1,
																	},
																}
															);
															if (c == null) {
																status_update_feedback =
																	"Bank cashier's status can not be updated";
															}

															content =
																"E-Wallet:  Amount " +
																i.amount +
																" is paid for invoice nummber " +
																i.number +
																" for purpose " +
																i.description;
															sendSMS(content, i.mobile);
														}
													}
													result.status_update_feedback = status_update_feedback;
													res.status(200).json(result);
												}
											} catch (err) {
												console.log(err);
												var message = err;
												if (err && err.message) {
													message = err.message;
												}
												res
													.status(200)
													.json({ status: 0, message: message, err: err });
											}
										}
									}
								);
							}
						}
					);
				});
			}
		}
	);
});

router.post(
	"/partnerCashier/getInvoicesForCustomerCode",
	jwtTokenAuth,
	(req, res) => {
		const { customer_code, merchant_id } = req.body;
		const jwtusername = req.sign_creds.username;
		PartnerCashier.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err, cashier) {
				if (err) {
					console.log(err);
					var message = err;
					if (err.message) {
						message = err.message;
					}
					res.status(200).json({
						status: 0,
						message: message,
					});
				} else if (cashier == null) {
					res.status(200).json({
						status: 0,
						message:
							"Token changed or user not valid. Try to login again or contact system administrator.",
					});
				} else {
					Invoice.find(
						{
							is_validated: 1,
							merchant_id: merchant_id,
							customer_code: customer_code,
						},
						(err, invoices) => {
							if (err) {
								console.log(err);
								var message = err;
								if (err.message) {
									message = err.message;
								}
								res.status(200).json({
									status: 0,
									message: message,
								});
							} else if (invoices.length == 0) {
								res.status(200).json({
									status: 0,
									message: "Invoice not found",
								});
							} else {
								res.status(200).json({
									status: 1,
									invoice: invoices,
								});
							}
						}
					);
				}
			}
		);
	}
);

router.post("/partnerCashier/getInvoiceDetails", jwtTokenAuth, (req, res) => {
	const { number, merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (cashier == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Invoice.find(
					{
						is_validated: 1,
						merchant_id: merchant_id,
						$or: [{ number: number }, { reference_invoice: number }],
					},
					(err, invoices) => {
						if (err) {
							console.log(err);
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else if (invoices.length == 0) {
							res.status(200).json({
								status: 0,
								message: "Invoice not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								invoice: invoices,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/partnerCashier/getUserInvoices", jwtTokenAuth, (req, res) => {
	const { mobile, merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (cashier == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Invoice.find(
					{ mobile: mobile, merchant_id: merchant_id, is_validated: 1 },
					(err, invoices) => {
						if (err) {
							console.log(err);
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else {
							res.status(200).json({
								status: 1,
								invoices: invoices,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/cashier/getInvoicesForCustomerCode", (req, res) => {
	const { token, customer_code, merchant_id } = req.body;
	Cashier.findOne(
		{
			token,
			status: 1,
		},
		function (err, cashier) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (cashier == null) {
				res.status(200).json({
					status: 0,
					message: "Cashier is not activated.",
				});
			} else {
				Invoice.find(
					{
						is_validated: 1,
						merchant_id: merchant_id,
						customer_code: customer_code,
					},
					(err, invoices) => {
						if (err) {
							console.log(err);
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else if (invoices.length == 0) {
							res.status(200).json({
								status: 0,
								message: "Invoice not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								invoice: invoices,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/cashier/getInvoiceDetails", (req, res) => {
	const { token, number, merchant_id } = req.body;
	Cashier.findOne(
		{
			token,
			status: 1,
		},
		function (err, cashier) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (cashier == null) {
				res.status(200).json({
					status: 0,
					message: "Cashier is not activated.",
				});
			} else {
				Invoice.find(
					{
						is_validated: 1,
						merchant_id: merchant_id,
						$or: [{ number: number }, { reference_invoice: number }],
					},
					(err, invoices) => {
						if (err) {
							console.log(err);
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else if (invoices.length == 0) {
							res.status(200).json({
								status: 0,
								message: "Invoice not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								invoice: invoices,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/cashier/getUserInvoices", (req, res) => {
	const { token, mobile, merchant_id } = req.body;
	Cashier.findOne(
		{
			token,
			status: 1,
		},
		function (err, cashier) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (cashier == null) {
				console.log(err);
				res.status(200).json({
					status: 0,
					message: "Cashier is not valid",
				});
			} else {
				Invoice.find(
					{ mobile: mobile, merchant_id: merchant_id, is_validated: 1 },
					(err, invoices) => {
						if (err) {
							console.log(err);
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else {
							res.status(200).json({
								status: 1,
								invoices: invoices,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/cashier/payInvoice", (req, res) => {
	const { token, invoices, merchant_id } = req.body;
	Cashier.findOne(
		{
			token,
			status: 1,
		},
		function (err, cashier) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (cashier == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				MerchantRule.findOne(
					{ merchant_id: merchant_id, type: "NWM-F", status: 1, active: 1 },
					(err, fee) => {
						if (err) {
							console.log(err);
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else if (fee == null) {
							res.status(200).json({
								status: 0,
								message: "Fee rule not found",
							});
						} else {
							MerchantRule.findOne(
								{
									merchant_id: merchant_id,
									type: "NWM-C",
									status: 1,
									active: 1,
								},
								async (err, comm) => {
									if (err) {
										console.log(err);
										var message = err;
										if (err.message) {
											message = err.message;
										}
										res.status(200).json({
											status: 0,
											message: message,
										});
									} else if (comm == null) {
										res.status(200).json({
											status: 0,
											message: "Commission rule not found",
										});
									} else {
										try {
											var total_amount = 0;
											for (invoice of invoices) {
												var { id, penalty } = invoice;
												var inv = await Invoice.findOne({
													_id: id,
													merchant_id: merchant_id,
													paid: 0,
													is_validated: 1,
												});
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

											// all the users
											let branch = await Branch.findOne({
												_id: cashier.branch_id,
												status: 1,
											});
											if (branch == null) {
												throw new Error("Cashier has invalid branch");
											}

											let bank = await Bank.findOne({
												_id: branch.bank_id,
												status: 1,
											});
											if (bank == null) {
												throw new Error("Cashier's Branch has invalid bank");
											}

											// check branch operational wallet balance
											const branchOpWallet = branch.wallet_ids.operational;
											var bal = await blockchain.getBalance(branchOpWallet);
											console.log(branchOpWallet);
											if (Number(bal) < total_amount) {
												res.status(200).json({
													status: 0,
													message: "Not enough balance. Recharge Your wallet.",
												});
											} else {
												let infra = await Infra.findOne({
													_id: bank.user_id,
												});
												if (infra == null) {
													throw new Error("Cashier's bank has invalid infra");
												}

												let merchant = await Merchant.findOne({
													_id: merchant_id,
												});
												if (merchant == null) {
													throw new Error("Invoice has invalid merchant");
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

												var result = await cashierInvoicePay(
													total_amount,
													infra,
													bank,
													branch,
													merchant,
													fee,
													comm
												);
												var status_update_feedback;
												if (result.status == 1) {
													for (invoice of invoices) {
														var i = await Invoice.findOneAndUpdate(
															{ _id: invoice.id },
															{
																paid: 1,
																paid_by: "BC",
															}
														);
														if (i == null) {
															status_update_feedback =
																"Invoice paid status can not be updated";
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

														var mc = await MerchantCashier.updateOne(
															{ _id: i.cashier_id },
															{
																last_paid_at: last_paid_at,
																$inc: {
																	bills_paid: 1,
																},
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
																"Merchant branch status can not be updated";
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

														bankFee = calculateShare("bank", total_amount, fee);
														partnerFeeShare = calculateShare(
															"branch",
															total_amount,
															fee
														);
														partnerCommShare = calculateShare(
															"branch",
															total_amount,
															comm
														);
														var c = await Cashier.updateOne(
															{ _id: cashier._id },
															{
																$inc: {
																	cash_received: total_amount + bankFee,
																	cash_in_hand: total_amount + bankFee,
																	fee_generated: partnerFeeShare,
																	commission_generated: partnerCommShare,
																	total_trans: 1,
																},
															}
														);
														if (c == null) {
															status_update_feedback =
																"Bank cashier's status can not be updated";
														}

														content =
															"E-Wallet:  Amount " +
															i.amount +
															" is paid for invoice nummber " +
															i.number +
															" for purpose " +
															i.description;
														sendSMS(content, i.mobile);
													}
												}
												result.status_update_feedback = status_update_feedback;
												res.status(200).json(result);
											}
										} catch (err) {
											console.log(err);
											var message = err.toString();
											if (err.message) {
												message = err.message;
											}
											res
												.status(200)
												.json({ status: 0, message: message, err: err });
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
});

router.post("/user/getInvoices", jwtTokenAuth, (req, res) => {
	const { merchant_id } = req.body;
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
			status: 1,
		},
		function (err, user) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (user == null) {
				res.status(200).json({
					status: 0,
					message: "User is not activated.",
				});
			} else {
				Invoice.find(
					{ mobile: user.mobile, merchant_id: merchant_id, is_validated: 1 },
					(err, invoices) => {
						if (err) {
							console.log(err);
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else {
							res.status(200).json({
								status: 1,
								invoices: invoices,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/user/getInvoicesByNumber", jwtTokenAuth, (req, res) => {
	const { number, merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (user == null) {
				res.status(200).json({
					status: 0,
					message: "User is not Valid.",
				});
			} else {
				Invoice.find(
					{
						is_validated: 1,
						merchant_id: merchant_id,
						$or: [{ number: number }, { reference_invoice: number }],
					},
					(err, invoices) => {
						if (err) {
							console.log(err);
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else if (invoices.length == 0) {
							res.status(200).json({
								status: 0,
								message: "Invoice not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								invoice: invoices,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/user/getInvoicesForCustomerCode", jwtTokenAuth, (req, res) => {
	const { customer_code, merchant_id } = req.body;
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
			status: 1,
		},
		function (err, payer) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (payer == null) {
				res.status(200).json({
					status: 0,
					message: "User is not valid",
				});
			} else {
				Invoice.find(
					{
						is_validated: 1,
						merchant_id: merchant_id,
						customer_code: customer_code,
					},
					(err, invoices) => {
						if (err) {
							console.log(err);
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else if (invoices.length == 0) {
							res.status(200).json({
								status: 0,
								message: "Invoice not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								invoice: invoices,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/user/getInvoicesForMobile", jwtTokenAuth, (req, res) => {
	const { mobile, merchant_id } = req.body;
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
			status: 1,
		},
		function (err, payer) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (payer == null) {
				res.status(200).json({
					status: 0,
					message: "User is not valid",
				});
			} else {
				Invoice.find(
					{ mobile: mobile, merchant_id: merchant_id, is_validated: 1 },
					(err, invoices) => {
						if (err) {
							console.log(err);
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else {
							res.status(200).json({
								status: 1,
								invoices: invoices,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/user/payInvoice", jwtTokenAuth, (req, res) => {
	const { invoices, merchant_id } = req.body;
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
			status: 1,
		},
		function (err, user) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (user == null) {
				console.log(err);
				res.status(200).json({
					status: 0,
					message: "User is not valid",
				});
			} else {
				MerchantRule.findOne(
					{ merchant_id: merchant_id, type: "WM-F", status: 1, active: 1 },
					(err, fee) => {
						if (err) {
							console.log(err);
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else if (fee == null) {
							res.status(200).json({
								status: 0,
								message: "Fee rule not found",
							});
						} else {
							MerchantRule.findOne(
								{
									merchant_id: merchant_id,
									type: "WM-C",
									status: 1,
									active: 1,
								},
								async (err, comm) => {
									if (err) {
										console.log(err);
										var message = err;
										if (err.message) {
											message = err.message;
										}
										res.status(200).json({
											status: 0,
											message: message,
										});
									} else if (comm == null) {
										res.status(200).json({
											status: 0,
											message: "Commission rule not found",
										});
									} else {
										try {
											var total_amount = 0;
											for (invoice of invoices) {
												var { id, penalty } = invoice;
												var inv = await Invoice.findOne({
													_id: id,
													merchant_id: merchant_id,
													paid: 0,
													is_validated: 1,
												});
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
											let bank = await Bank.findOne({
												_id: user.bank_id,
											});
											if (bank == null) {
												throw new Error("User has invalid bank");
											}

											// check branch operational wallet balance
											const userOpWallet = user.wallet_id;
											var bal = await blockchain.getBalance(userOpWallet);
											console.log(bal);
											if (Number(bal) < total_amount) {
												res.status(200).json({
													status: 0,
													message: "Not enough balance. Recharge Your wallet.",
												});
											} else {
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
													total_amount,
													infra,
													bank,
													user,
													merchant,
													fee,
													comm
												);
												var status_update_feedback;
												if (result.status == 1) {
													for (invoice of invoices) {
														var i = await Invoice.findOneAndUpdate(
															{ _id: invoice.id },
															{
																paid: 1,
																paid_by: "US",
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

														var mc = await MerchantCashier.updateOne(
															{ _id: i.cashier_id },
															{
																last_paid_at: last_paid_at,
																$inc: {
																	bills_paid: 1,
																},
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
												res.status(200).json(result);
											}
										} catch (err) {
											console.log(err);
											var message = err;
											if (err && err.message) {
												message = err.message;
											}
											res.status(200).json({ status: 0, message: message });
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
});

module.exports = router;
