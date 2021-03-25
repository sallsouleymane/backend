//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const { jwtAuthentication } = require("./utils");

const addClaimRecord = require("../utils/addClaimRecord");
const updateClaimRecord = require("../utils/updateClaimRecord");

const Fee = require("../../models/Fee");
const Bank = require("../../models/Bank");
const OTP = require("../../models/OTP");
const Branch = require("../../models/Branch");
const Cashier = require("../../models/Cashier");
const CashierSend = require("../../models/CashierSend");
const CashierClaim = require("../../models/CashierClaim");
const CashierLedger = require("../../models/CashierLedger");
const Partner = require("../../models/partner/Partner");
const PartnerBranch = require("../../models/partner/Branch");
const PartnerCashier = require("../../models/partner/Cashier");

// transactions
const txstate = require("../transactions/services/states");
const cashierClaimMoney = require("../transactions/intraBank/cashierClaimMoney");

//constants
const categoryConst = require("../transactions/constants/category");

module.exports.cashierClaimMoney = function (req, res) {
	const { transferCode } = req.body;

	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
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
				CashierClaim.findOne(
					{
						transaction_code: transferCode,
						status: 1,
					},
					(err, cc) => {
						let errRes = errorMessage(
							err,
							cc,
							"Money is already claimed",
							true
						);
						if (errRes.status == 0) {
							res.status(200).json(errRes);
						} else {
							CashierSend.findOne(
								{
									transaction_code: transferCode,
								},
								function (err, sendRecord) {
									let errRes = errorMessage(
										err,
										sendRecord,
										"Transaction Not Found"
									);
									if (errRes.status == 0) {
										res.status(200).json(errRes);
									} else {
										Branch.findOne(
											{
												_id: cashier.branch_id,
											},
											function (err, branch) {
												let errRes = errorMessage(
													err,
													branch,
													"Branch Not Found"
												);
												if (errRes.status == 0) {
													res.status(200).json(errRes);
												} else {
													Bank.findOne(
														{
															_id: cashier.bank_id,
														},
														function (err, bank) {
															let errRes = errorMessage(
																err,
																bank,
																"Bank Not Found"
															);
															if (errRes.status == 0) {
																res.status(200).json(errRes);
															} else {
																const find = {
																	bank_id: cashier.bank_id,
																	trans_type: sendRecord.rule_type,
																	status: 1,
																	active: "Active",
																};
																Fee.findOne(find, function (err, rule) {
																	let errRes = errorMessage(
																		err,
																		rule,
																		"Revenue Rule Not Found"
																	);
																	if (errRes.status == 0) {
																		res.status(200).json(errRes);
																	} else {
																		// update calimer id
																		txstate.updateClaimer(
																			sendRecord.master_code,
																			cashier._id
																		);

																		// add a cashier claimer record
																		var otherInfo = {
																			cashierId: cashier._id,
																			sendRecord: sendRecord,
																		};
																		addClaimRecord(
																			req.body,
																			otherInfo,
																			(err, claimObj) => {
																				if (err) {
																					res.status(200).json(catchError(err));
																				} else {
																					const transfer = {
																						amount: sendRecord.amount,
																						isInclusive:
																							sendRecord.is_inclusive,
																						master_code: sendRecord.master_code,
																						claimerType: "claimBranch",
																						claimerCode: branch.bcode,
																						sendBranchType:
																							sendRecord.send_branch_type,
																						sendBranchId:
																							sendRecord.send_branch_id,
																						cashierId: cashier._id,
																					};

																					// perform claim transaction
																					cashierClaimMoney(
																						transfer,
																						bank,
																						branch,
																						rule
																					)
																						.then(function (result) {
																							if (result.status == 1) {
																								otherInfo.claimId =
																									claimObj._id;
																								otherInfo.amount =
																									result.amount;
																								otherInfo.claimFee =
																									result.claimFee;

																								//update claimer record
																								updateClaimRecord(
																									"cashier",
																									otherInfo,
																									(err) => {
																										if (err) {
																											res
																												.status(200)
																												.json(catchError(err));
																										} else {
																											txstate.completed(
																												categoryConst.MAIN,
																												sendRecord.master_code
																											);
																											res.status(200).json({
																												status: 1,
																												message:
																													"Cashier claimed money",
																											});
																										}
																									}
																								);
																							} else {
																								txstate.failed(
																									categoryConst.MAIN,
																									sendRecord.master_code
																								);
																								console.log(result.toString());
																								res.status(200).json(result);
																							}
																						})
																						.catch((err) => {
																							txstate.failed(
																								categoryConst.MAIN,
																								sendRecord.master_code
																							);
																							console.log(err);
																							res.status(200).json({
																								status: 0,
																								message: err.message,
																							});
																						});
																				}
																			}
																		);
																	}
																}); //save
															}
														}
													);
												}
											}
										); //branch
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

module.exports.partnerClaimMoney = function (req, res) {
	const { transferCode } = req.body;
	const jwtusername = req.sign_creds.username;

	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Partner.findOne({ _id: cashier.partner_id }, (err, partner) => {
					let result = errorMessage(err, partner, "Partner not found");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						CashierClaim.findOne(
							{
								transaction_code: transferCode,
								status: 1,
							},
							(err, cc) => {
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
								} else if (cc) {
									res.status(200).json({
										status: 0,
										message: "Money is already claimed",
									});
								} else {
									CashierSend.findOne(
										{
											transaction_code: transferCode,
										},
										function (err, sendRecord) {
											let result = errorMessage(
												err,
												sendRecord,
												"Transaction Not Found"
											);
											if (result.status == 0) {
												res.status(200).json(result);
											} else {
												PartnerBranch.findOne(
													{
														_id: cashier.branch_id,
													},
													function (err, branch) {
														let result = errorMessage(
															err,
															branch,
															"Branch Not Found"
														);
														if (result.status == 0) {
															res.status(200).json(result);
														} else {
															Bank.findOne(
																{
																	_id: cashier.bank_id,
																},
																function (err, bank) {
																	let result = errorMessage(
																		err,
																		bank,
																		"Bank Not Found"
																	);
																	if (result.status == 0) {
																		res.status(200).json(result);
																	} else {
																		const find = {
																			bank_id: cashier.bank_id,
																			trans_type: sendRecord.rule_type,
																			status: 1,
																			active: "Active",
																		};
																		Fee.findOne(find, function (err, rule) {
																			let result = errorMessage(
																				err,
																				rule,
																				"Revenue Rule Not Found"
																			);
																			if (result.status == 0) {
																				res.status(200).json(result);
																			} else {
																				var otherInfo = {
																					cashierId: cashier._id,
																					sendRecord: sendRecord,
																				};
																				addClaimRecord(
																					req.body,
																					otherInfo,
																					(err, claimObj) => {
																						if (err) {
																							res
																								.status(200)
																								.json(catchError(err));
																						} else {
																							const transfer = {
																								amount: sendRecord.amount,
																								isInclusive:
																									sendRecord.is_inclusive,
																								master_code:
																									sendRecord.master_code,
																								claimerType: "claimPartner",
																								claimerCode: partner.code,
																								sendBranchType:
																									sendRecord.send_branch_type,
																								sendBranchId:
																									sendRecord.send_branch_id,
																								cashierId: cashier._id,
																							};
																							cashierClaimMoney(
																								transfer,
																								bank,
																								branch,
																								rule
																							)
																								.then(function (result) {
																									if (result.status == 1) {
																										otherInfo.claimId =
																											claimObj._id;
																										otherInfo.amount =
																											result.amount;
																										otherInfo.claimFee =
																											result.claimFee;

																										updateClaimRecord(
																											"partnercashier",
																											otherInfo,
																											(err) => {
																												if (err) {
																													res
																														.status(200)
																														.json(
																															catchError(err)
																														);
																												} else {
																													txstate.completed(
																														categoryConst.MAIN,
																														sendRecord.master_code
																													);
																													res.status(200).json({
																														status: 1,
																														message:
																															"Cashier claimed money",
																													});
																												}
																											}
																										);
																									} else {
																										console.log(
																											result.toString()
																										);
																										res
																											.status(200)
																											.json(result);
																									}
																								})
																								.catch((err) => {
																									res
																										.status(200)
																										.json(catchError(err));
																								});
																						}
																					}
																				);
																			}
																		}); //save
																	}
																}
															);
														}
													}
												); //branch
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
	);
};
