//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const invoicesTotalAmount = require("../utils/invoicesTotalAmount");
const updateInvoiceRecord = require("../utils/updateInvoiceRecord");
const { jwtAuthentication } = require("./utils");

// transactions
const cashierInvoicePay = require("../transactions/interBank/cashierInvoicePay");
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
const IBMerchantRule = require("../../models/merchant/InterBankRule");

//constants
const categoryConst = require("../transactions/constants/category");

module.exports.cashierInvoicePay = (req, res) => {
	const { invoices, merchant_id } = req.body;
	jwtAuthentication("cashier", req, async function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			// Initiate transaction
			const master_code = await txstate.initiate(
				categoryConst.MAIN,
				cashier.bank_id,
				"Inter Bank Non Wallet To Merchant",
				cashier._id,
				cashier.cash_in_hand,
			);
			var find = {
				merchant_id: merchant_id,
				type: "IBNWM-F",
				status: 1,
				active: 1,
			};
			IBMerchantRule.findOne(find, (err1, fee1) => {
				let errRes1 = errorMessage(err1, fee1, "Inter Bank Fee rule not found");
				if (errRes1.status == 0) {
					res.status(200).json(errRes1);
				} else {
					find = {
						merchant_id: merchant_id,
						type: "IBNWM-C",
						status: 1,
						active: 1,
					};
					IBMerchantRule.findOne(find, (err2, comm1) => {
						let errRes2 = errorMessage(
							err2,
							comm1,
							"Inter Bank Commission rule not found"
						);
						if (errRes2.status == 0) {
							res.status(200).json(errRes2);
						} else {
							MerchantRule.findOne(
								{
									merchant_id: merchant_id,
									type: "NWM-F",
									status: 1,
									active: 1,
								},
								(err3, fee2) => {
									let errRes3 = errorMessage(err3, fee2, "Fee rule not found");
									if (errRes3.status == 0) {
										res.status(200).json(errRes3);
									} else {
										MerchantRule.findOne(
											{
												merchant_id: merchant_id,
												type: "NWM-C",
												status: 1,
												active: 1,
											},
											async (err4, comm2) => {
												let errRes4 = errorMessage(
													err4,
													comm2,
													"Commission rule not found"
												);
												if (errRes4.status == 0) {
													res.status(200).json(errRes4);
												} else {
													try {
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

														let total_amount = await invoicesTotalAmount(
															invoices,
															merchant_id
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
															payerCode: branch.bcode,
															payerType: "branch",
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
														if (result.status == 1) {
															await Cashier.updateOne(
																{ _id: cashier._id },
																{
																	$inc: {
																		cash_received:
																			total_amount + result.bankFee,
																		cash_in_hand: total_amount + result.bankFee,
																		fee_generated: result.partnerFeeShare,
																		cash_received_fee: result.partnerFeeShare,
																		cash_received_commission: result.partnerCommShare,
																		commission_generated:
																			result.partnerCommShare,
																		total_trans: 1,
																	},
																}
															);
															let otherInfo = {
																total_amount: total_amount,
																master_code: master_code,
																paid_by: "BC",
																payer_id: cashier._id,
																payer_branch_id: cashier.branch_id,
																payer_bank_id: cashier.bank_id,
																fee: Number(result.partnerFeeShare)/invoices.length,
																commission: Number(result.partnerCommShare)/invoices.length,
															};

															let status = await updateInvoiceRecord(
																req.body,
																otherInfo
															);
															if (status != null) {
																throw new Error(status);
															}

															txstate.completed(
																categoryConst.MAIN,
																master_code
															);
															res.status(200).json(result);
														} else {
															txstate.completed(
																categoryConst.MAIN,
																master_code
															);
															res.status(200).json(result);
														}
													} catch (err5) {
														txstate.failed(categoryConst.MAIN, master_code);
														res.status(200).json(catchError(err5));
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
	});
};

module.exports.partnerInvoicePay = (req, res) => {
	const { invoices, merchant_id } = req.body;
	jwtAuthentication("partnerCashier", req, async function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			// Initiate transaction
			const master_code = await txstate.initiate(
				categoryConst.MAIN,
				cashier.bank_id,
				"Inter Bank Non Wallet To Merchant"
			);
			Partner.findOne({ _id: cashier.partner_id }, (err1, partner) => {
				var find = {
					merchant_id: merchant_id,
					type: "IBNWM-F",
					status: 1,
					active: 1,
				};
				IBMerchantRule.findOne(find, (err2, fee1) => {
					let errRes2 = errorMessage(err2, fee1, "Inter Bank Fee rule not found");
					if (errRes2.status == 0) {
						res.status(200).json(errRes2);
					} else {
						find = {
							merchant_id: merchant_id,
							type: "IBNWM-C",
							status: 1,
							active: 1,
						};
						IBMerchantRule.findOne(find, (err3, comm1) => {
							let errRes = errorMessage(
								err3,
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
									(err30, fee2) => {
										let errRes30 = errorMessage(err30, fee2, "Fee rule not found");
										if (errRes30.status == 0) {
											res.status(200).json(errRes30);
										} else {
											MerchantRule.findOne(
												{
													merchant_id: merchant_id,
													type: "NWM-C",
													status: 1,
													active: 1,
												},
												async (err4, comm2) => {
													let errRes4 = errorMessage(
														err4,
														comm2,
														"Commission rule not found"
													);
													if (errRes4.status == 0) {
														res.status(200).json(errRes4);
													} else {
														try {
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

															let total_amount = await invoicesTotalAmount(
																invoices,
																merchant_id
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
																payeCode: partner.code,
																payerType: "partner",
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
															if (result.status == 1) {
																await PartnerCashier.updateOne(
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
																let otherInfo = {
																	total_amount: total_amount,
																	master_code: master_code,
																	paid_by: "PC",
																	payer_id: cashier._id,
																	payer_branch_id: cashier.branch_id,
																	payer_partner_id: cashier.partner_id,
																	fee: Number(result.partnerFeeShare)/invoices.length,
																	commission: Number(result.partnerCommShare)/invoices.length,
																};

																let status = await updateInvoiceRecord(
																	req.body,
																	otherInfo
																);
																if (status != null) {
																	throw new Error(status);
																}

																txstate.completed(
																	categoryConst.MAIN,
																	master_code
																);
																res.status(200).json(result);
															} else {
																txstate.failed(categoryConst.MAIN, master_code);
																res.status(200).json(result);
															}
														} catch (err5) {
															console.log(err5);
															var message = err;
															if (err5 && err5.message) {
																message = err5.message;
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
	});
};
