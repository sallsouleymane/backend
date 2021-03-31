//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const invoicesTotalAmount = require("../utils/invoicesTotalAmount");
const updateInvoiceRecord = require("../utils/updateInvoiceRecord");
const { jwtAuthentication } = require("./utils");

//controllers
const cashierInvoicePay = require("../transactions/interBank/cashierInvoicePay");

// transactions
const txstate = require("../transactions/services/states");

//models
const Bank = require("../../models/Bank");
const Branch = require("../../models/Branch");
const Infra = require("../../models/Infra");
const MerchantRule = require("../../models/merchant/MerchantRule");
const Merchant = require("../../models/merchant/Merchant");
const Cashier = require("../../models/Cashier");
const Partner = require("../../models/partner/Partner");
const PartnerCashier = require("../../models/partner/Cashier");
const PartnerBranch = require("../../models/partner/Branch");

//constants
const categoryConst = require("../transactions/constants/category");

module.exports.cashierInvoicePay = (req, res) => {
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
					categoryConst.MAIN,
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

															var result = await cashierInvoicePay(
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
																			payer_branch_id: cashier.branch_id,
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
															txstate.completed(
																categoryConst.MAIN,
																master_code
															);
															res.status(200).json(result);
														} catch (err) {
															txstate.failed(categoryConst.MAIN, master_code);
															res.status(200).json(catchError(err));
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
};

module.exports.partnerInvoicePay = (req, res) => {
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
																	throw new Error("Merchant has invalid bank");
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

																var result = await cashierInvoicePay(
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
																				payer_branch_id: cashier.branch_id,
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
};
