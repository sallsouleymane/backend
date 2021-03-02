const express = require("express");
const router = express.Router();

//services
const blockchain = require("../services/Blockchain.js");
const txstate = require("../controllers/transactions/services/states");

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const { errorMessage, catchError } = require("./utils/errorHandler");
const { calculateShare } = require("./utils/calculateShare");

//controllers
const invoicePayCntrl = require("../controllers/cashier/invoicePayTransaction");
const userInvoicePay = require("../controllers/user/invoicePayTransaction");
const merchantInvoicePay = require("../controllers/merchant/invoicePayTransaction");

//transactions
// const walletInvoicePay = require("./transactions/intraBank/walletInvoicePay");
// const partnerCashierInvoicePay = require("./transactions/intraBank/partnerCashierInvoicePay");
// const merchantCashierInvoicePay = require("./transactions/intraBank/merchantCashierInvoicePay");
const iBCashierInvoicePay = require("./transactions/interBank/cashierInvoicePay");
const iBwalletInvoicePay = require("./transactions/interBank/walletInvoicePay");
const iBpartnerCashierInvoicePay = require("./transactions/interBank/partnerCashierInvoicePay");

//models
const Bank = require("../models/Bank");
const Branch = require("../models/Branch");
const Infra = require("../models/Infra");
const MerchantRule = require("../models/merchant/MerchantRule");
const IBMerchantRule = require("../models/merchant/InterBankRule");
const MerchantBranch = require("../models/merchant/MerchantBranch");
const MerchantPosition = require("../models/merchant/Position");
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

											var result = await iBwalletInvoicePay(
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
			async function (err, cashier) {
				let errRes = errorMessage(
					err,
					cashier,
					"Token changed or user not valid. Try to login again or contact system administrator."
				);
				if (errRes.status == 0) {
					res.status(200).json(errRes);
				} else {
					// Initiate transaction
					const master_code = await txstate.initiate(
						cashier.bank_id,
						"Inter Bank Non Wallet To Merchant"
					);
					Partner.findOne({ _id: cashier.partner_id }, (err, partner) => {
						var find = {
							merchant_id: merchant_id,
							type: "IBNWM-F",
							status: 1,
							active: 1,
						};
						IBMerchantRule.findOne(find, (err, fee1) => {
							let errRes = errorMessage(
								err,
								fee1,
								"Inter Bank Fee rule not found"
							);
							if (errRes.status == 0) {
								res.status(200).json(errRes);
							} else {
								find = {
									merchant_id: merchant_id,
									type: "IBNWM-C",
									status: 1,
									active: 1,
								};
								IBMerchantRule.findOne(find, (err, comm1) => {
									let errRes = errorMessage(
										err,
										comm1,
										"Inter Bank Commission rule not found"
									);
									if (errRes.status == 0) {
										res.status(200).json(errRes);
									} else {
										MerchantRule.findOne(
											{
												merchant_id: merchant_id,
												type: "NWM-F",
												status: 1,
												active: 1,
											},
											(err, fee2) => {
												let errRes = errorMessage(
													err,
													fee2,
													"Fee rule not found"
												);
												if (errRes.status == 0) {
													res.status(200).json(errRes);
												} else {
													MerchantRule.findOne(
														{
															merchant_id: merchant_id,
															type: "NWM-C",
															status: 1,
															active: 1,
														},
														async (err, comm2) => {
															let errRes = errorMessage(
																err,
																comm2,
																"Commission rule not found"
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
																			{ penalty: penalty }
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

																	let transfer = {
																		amount: total_amount,
																		cashierId: cashier._id,
																		master_code: master_code,
																	};

																	var result = await iBpartnerCashierInvoicePay(
																		transfer,
																		infra,
																		bank,
																		merchantBank,
																		branch,
																		merchant,
																		rule1,
																		rule2
																	);
																	var status_update_feedback = "";
																	if (result.status == 1) {
																		var c = await PartnerCashier.updateOne(
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
																				"Partner cashier's status can not be updated";
																		}
																		for (invoice of invoices) {
																			var i = await Invoice.findOneAndUpdate(
																				{ _id: invoice.id },
																				{
																					paid: 1,
																					paid_by: "PC",
																					payer_id: cashier._id,
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
																	await txstate.completed(master_code);
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

router.post("/cashier/interBank/payInvoice", jwtTokenAuth, (req, res) => {
	const { invoices, merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, cashier) {
			let errRes = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (errRes.status == 0) {
				res.status(200).json(errRes);
			} else {
				// Initiate transaction
				const master_code = await txstate.initiate(
					cashier.bank_id,
					"Inter Bank Non Wallet To Wallet"
				);
				var find = {
					merchant_id: merchant_id,
					type: "IBNWM-F",
					status: 1,
					active: 1,
				};
				IBMerchantRule.findOne(find, (err, fee1) => {
					let errRes = errorMessage(err, fee1, "Inter Bank Fee rule not found");
					if (errRes.status == 0) {
						res.status(200).json(errRes);
					} else {
						find = {
							merchant_id: merchant_id,
							type: "IBNWM-C",
							status: 1,
							active: 1,
						};
						IBMerchantRule.findOne(find, (err, comm1) => {
							let errRes = errorMessage(
								err,
								comm1,
								"Inter Bank Commission rule not found"
							);
							if (errRes.status == 0) {
								res.status(200).json(errRes);
							} else {
								MerchantRule.findOne(
									{
										merchant_id: merchant_id,
										type: "NWM-F",
										status: 1,
										active: 1,
									},
									(err, fee2) => {
										let errRes = errorMessage(err, fee2, "Fee rule not found");
										if (errRes.status == 0) {
											res.status(200).json(errRes);
										} else {
											MerchantRule.findOne(
												{
													merchant_id: merchant_id,
													type: "NWM-C",
													status: 1,
													active: 1,
												},
												async (err, comm2) => {
													let errRes = errorMessage(
														err,
														comm2,
														"Commission rule not found"
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
															let transfer = {
																amount: total_amount,
																cashierId: cashier._id,
																master_code: master_code,
															};

															var result = await iBCashierInvoicePay(
																transfer,
																infra,
																bank,
																merchantBank,
																branch,
																merchant,
																rule1,
																rule2
															);
															var status_update_feedback = "";
															if (result.status == 1) {
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
																for (invoice of invoices) {
																	var i = await Invoice.findOneAndUpdate(
																		{ _id: invoice.id },
																		{
																			paid: 1,
																			paid_by: "BC",
																			payer_id: cashier._id,
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
															await txstate.completed(master_code);
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
	"/merchantStaff/getInvoicesByCustomerCode",
	jwtTokenAuth,
	(req, res) => {
		const { customer_code } = req.body;
		const jwtusername = req.sign_creds.username;
		MerchantPosition.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err, position) {
				let errRes = errorMessage(err, position, "Position is not activated.");
				if (errRes.status == 0) {
					res.status(200).json(errRes);
				} else {
					Invoice.find(
						{
							is_validated: 1,
							merchant_id: position.merchant_id,
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

router.post("/merchantStaff/getInvoicesByNumber", jwtTokenAuth, (req, res) => {
	const { number } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			type: "staff",
			status: 1,
		},
		function (err, position) {
			let errRes = errorMessage(err, position, "Position is not activated.");
			if (errRes.status == 0) {
				res.status(200).json(errRes);
			} else {
				Invoice.find(
					{
						is_validated: 1,
						merchant_id: position.merchant_id,
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

router.post("/merchantStaff/getInvoicesByMobile", jwtTokenAuth, (req, res) => {
	const { mobile } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, position) {
			let errRes = errorMessage(err, position, "Position is not valid");
			if (errRes.status == 0) {
				res.status(200).json(errRes);
			} else {
				Invoice.find(
					{
						mobile: mobile,
						is_validated: 1,
						merchant_id: position.merchant_id,
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
});

router.post("/merchantStaff/payInvoice", jwtTokenAuth, merchantInvoicePay);

router.post(
	"/partnerCashier/payInvoice",
	jwtTokenAuth,
	invoicePayCntrl.partnerInvoicePay
);

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
				let errRes = errorMessage(
					err,
					cashier,
					"Token changed or user not valid. Try to login again or contact system administrator."
				);
				if (errRes.status == 0) {
					res.status(200).json(errRes);
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
			let errRes = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (errRes.status == 0) {
				res.status(200).json(errRes);
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
			let errRes = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (errRes.status == 0) {
				res.status(200).json(errRes);
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

router.post("/cashier/getInvoicesForCustomerCode", jwtTokenAuth, (req, res) => {
	const { customer_code, merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let errRes = errorMessage(err, cashier, "Cashier is not activated.");
			if (errRes.status == 0) {
				res.status(200).json(errRes);
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

router.post("/cashier/getInvoiceDetails", jwtTokenAuth, (req, res) => {
	const { number, merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let errRes = errorMessage(err, cashier, "Cashier is not activated.");
			if (errRes.status == 0) {
				res.status(200).json(errRes);
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

router.post("/cashier/getUserInvoices", jwtTokenAuth, (req, res) => {
	const { mobile, merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let errRes = errorMessage(err, cashier, "Cashier is not valid");
			if (errRes.status == 0) {
				res.status(200).json(errRes);
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

router.post(
	"/cashier/payInvoice",
	jwtTokenAuth,
	invoicePayCntrl.cashierInvoicePay
);

router.post("/user/getInvoices", jwtTokenAuth, (req, res) => {
	const { merchant_id } = req.body;
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
			status: 1,
		},
		function (err, user) {
			let errRes = errorMessage(err, user, "User is not activated.");
			if (errRes.status == 0) {
				res.status(200).json(errRes);
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
			let errRes = errorMessage(err, user, "User is not Valid.");
			if (errRes.status == 0) {
				res.status(200).json(errRes);
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
			let errRes = errorMessage(err, payer, "User is not valid");
			if (errRes.status == 0) {
				res.status(200).json(errRes);
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
			let errRes = errorMessage(err, payer, "User is not valid");
			if (errRes.status == 0) {
				res.status(200).json(errRes);
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

router.post("/user/payInvoice", jwtTokenAuth, userInvoicePay);

module.exports = router;
