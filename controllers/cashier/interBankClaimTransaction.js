//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");

const addClaimRecord = require("../utils/addClaimRecord");
const updateClaimRecord = require("../utils/updateClaimRecord");
const { jwtAuthentication } = require("./utils");

const Fee = require("../../models/Fee");
const Bank = require("../../models/Bank");
const OTP = require("../../models/OTP");
const Branch = require("../../models/Branch");
const Cashier = require("../../models/Cashier");
const CashierSend = require("../../models/CashierSend");
const CashierClaim = require("../../models/CashierClaim");
const Partner = require("../../models/partner/Partner");
const PartnerBranch = require("../../models/partner/Branch");
const PartnerCashier = require("../../models/partner/Cashier");
const InterBankRule = require("../../models/InterBankRule");

// transactions
const txstate = require("../transactions/services/states");
const cashierClaimMoney = require("../transactions/interBank/cashierClaimMoney");

//constants
const categoryConst = require("../transactions/constants/category");

module.exports.cashierClaimMoney = function (req, res) {
	const { transferCode } = req.body;

	jwtAuthentication("cashier", req, async function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			CashierClaim.findOne(
				{
					transaction_code: transferCode,
					status: 1,
				},
				function (err, cc) {
					let errMsg = errorMessage(err, cc, "Money is already claimed", true);
					if (errMsg.status == 0) {
						res.status(200).json(errMsg);
					} else {
						CashierSend.findOne(
							{
								transaction_code: transferCode,
							},
							function (err, sendRecord) {
								let errMsg = errorMessage(
									err,
									sendRecord,
									"Cashier Send Record Not Found"
								);
								if (errMsg.status == 0) {
									res.status(200).json(errMsg);
								} else {
									Branch.findOne(
										{
											_id: cashier.branch_id,
										},
										function (err, branch) {
											let errMsg = errorMessage(
												err,
												branch,
												"Branch Not Found"
											);
											if (errMsg.status == 0) {
												res.status(200).json(errMsg);
											} else {
												Bank.findOne(
													{
														_id: cashier.bank_id,
													},
													function (err, bank) {
														let errMsg = errorMessage(
															err,
															branch,
															"Bank Not Found"
														);
														if (errMsg.status == 0) {
															res.status(200).json(errMsg);
														} else {
															Bank.findOne(
																{ _id: sendRecord.sending_bank_id },
																(err, sendingBank) => {
																	let errMsg = errorMessage(
																		err,
																		branch,
																		"Sender Bank Not Found"
																	);
																	if (errMsg.status == 0) {
																		res.status(200).json(errMsg);
																	} else {
																		const find = {
																			bank_id: sendingBank._id,
																			type: sendRecord.inter_bank_rule_type,
																			status: 1,
																			active: 1,
																		};
																		InterBankRule.findOne(
																			find,
																			function (err, rule1) {
																				let errMsg = errorMessage(
																					err,
																					rule1,
																					"Inter Bank Fee Rule Not Found"
																				);
																				if (errMsg.status == 0) {
																					res.status(200).json(errMsg);
																				} else {
																					const find = {
																						bank_id: cashier.bank_id,
																						trans_type: sendRecord.rule_type,
																						status: 1,
																						active: "Active",
																					};
																					Fee.findOne(
																						find,
																						function (err, rule2) {
																							let errMsg = errorMessage(
																								err,
																								rule2,
																								"Revenue Rule Not Found"
																							);
																							if (errMsg.status == 0) {
																								res.status(200).json(errMsg);
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
																											res
																												.status(200)
																												.json(catchError(err));
																										} else {
																											const transfer = {
																												amount:
																													sendRecord.amount,
																												isInclusive:
																													sendRecord.is_inclusive,
																												master_code:
																													sendRecord.master_code,
																												claimerType:
																													"claimBranch",
																												claimerCode:
																													branch.bcode,
																												sendBranchType:
																													sendRecord.send_branch_type,
																												sendBranchId:
																													sendRecord.send_branch_id,
																												cashierId: cashier._id,
																											};
																											cashierClaimMoney(
																												transfer,
																												sendingBank,
																												bank,
																												branch,
																												rule1,
																												rule2
																											)
																												.then(function (
																													result
																												) {
																													if (
																														result.status == 1
																													) {
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
																																		.json(
																																			catchError(
																																				err
																																			)
																																		);
																																} else {
																																	txstate.completed(
																																		categoryConst.MAIN,
																																		sendRecord.master_code
																																	);
																																	res
																																		.status(200)
																																		.json({
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
																														console.log(
																															result.toString()
																														);
																														res
																															.status(200)
																															.json(result);
																													}
																												})
																												.catch((err) => {
																													txstate.failed(
																														categoryConst.MAIN,
																														sendRecord.master_code
																													);
																													console.log(
																														err.toString()
																													);
																													res.status(200).json({
																														status: 0,
																														message:
																															err.message,
																													});
																												});
																										}
																									}
																								);
																							}
																						}
																					);
																				}
																			}
																		); //save
																	}
																}
															);
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
};

module.exports.partnerClaimMoney = function (req, res) {
	const { transferCode } = req.body;
	jwtAuthentication("partnerCashier", req, async function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			CashierClaim.findOne(
				{
					transaction_code: transferCode,
					status: 1,
				},
				function (err, cc) {
					let errMsg = errorMessage(err, cc, "Money is already claimed", true);
					if (errMsg.status == 0) {
						res.status(200).json(errMsg);
					} else {
						CashierSend.findOne(
							{
								transaction_code: transferCode,
							},
							function (err, sendRecord) {
								let errMsg = errorMessage(
									err,
									sendRecord,
									"Cashier send record not found"
								);
								if (errMsg.status == 0) {
									res.status(200).json(errMsg);
								} else {
									PartnerBranch.findOne(
										{
											_id: cashier.branch_id,
										},
										function (err, branch) {
											let errMsg = errorMessage(
												err,
												branch,
												"Branch Not Found"
											);
											if (errMsg.status == 0) {
												res.status(200).json(errMsg);
											} else {
												Partner.findOne(
													{ _id: branch.partner_id },
													(err, partner) => {
														let errMsg = errorMessage(
															err,
															partner,
															"Partner not Found"
														);
														if (errMsg.status == 0) {
															res.status(200).json(errMsg);
														} else {
															Bank.findOne(
																{
																	_id: cashier.bank_id,
																},
																function (err, bank) {
																	let errMsg = errorMessage(
																		err,
																		bank,
																		"Bank not Found"
																	);
																	if (errMsg.status == 0) {
																		res.status(200).json(errMsg);
																	} else {
																		Bank.findOne(
																			{ _id: sendRecord.sending_bank_id },
																			(err, sendingBank) => {
																				let errMsg = errorMessage(
																					err,
																					bank,
																					"Sending Bank not Found"
																				);
																				if (errMsg.status == 0) {
																					res.status(200).json(errMsg);
																				} else {
																					const find = {
																						bank_id: sendingBank._id,
																						type:
																							sendRecord.inter_bank_rule_type,
																						status: 1,
																						active: 1,
																					};
																					InterBankRule.findOne(
																						find,
																						function (err, rule1) {
																							let result = errorMessage(
																								err,
																								rule1,
																								"Inter Bank Rule Not Found"
																							);
																							if (result.status == 0) {
																								res.status(200).json(result);
																							} else {
																								const find = {
																									bank_id: cashier.bank_id,
																									trans_type:
																										sendRecord.rule_type,
																									status: 1,
																									active: "Active",
																								};
																								Fee.findOne(
																									find,
																									function (err, rule2) {
																										let result = errorMessage(
																											err,
																											rule2,
																											"Revenue Rule Not Found"
																										);
																										if (result.status == 0) {
																											res
																												.status(200)
																												.json(result);
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
																															.json(
																																catchError(err)
																															);
																													} else {
																														const transfer = {
																															amount:
																																sendRecord.amount,
																															isInclusive:
																																sendRecord.is_inclusive,
																															master_code:
																																sendRecord.master_code,
																															claimerType:
																																"claimPartner",
																															claimerCode:
																																partner.code,
																															sendBranchType:
																																sendRecord.send_branch_type,
																															sendBranchId:
																																sendRecord.send_branch_id,
																															cashierId:
																																cashier._id,
																														};
																														cashierClaimMoney(
																															transfer,
																															sendingBank,
																															bank,
																															branch,
																															rule1,
																															rule2
																														)
																															.then(function (
																																result
																															) {
																																if (
																																	result.status ==
																																	1
																																) {
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
																																					.status(
																																						200
																																					)
																																					.json(
																																						catchError(
																																							err
																																						)
																																					);
																																			} else {
																																				txstate.completed(
																																					categoryConst.MAIN,
																																					sendRecord.master_code
																																				);
																																				res
																																					.status(
																																						200
																																					)
																																					.json(
																																						{
																																							status: 1,
																																							message:
																																								"Cashier claimed money",
																																						}
																																					);
																																			}
																																		}
																																	);
																																} else {
																																	txstate.failed(
																																		categoryConst.MAIN,
																																		sendRecord.master_code
																																	);
																																	console.log(
																																		result.toString()
																																	);
																																	res
																																		.status(200)
																																		.json(
																																			result
																																		);
																																}
																															})
																															.catch((err) => {
																																txstate.failed(
																																	categoryConst.MAIN,
																																	sendRecord.master_code
																																);
																																console.log(
																																	err.toString()
																																);
																																res
																																	.status(200)
																																	.json({
																																		status: 0,
																																		message:
																																			err.message,
																																	});
																															});
																													}
																												}
																											);
																										}
																									}
																								);
																							}
																						}
																					); //save
																				}
																			}
																		);
																	}
																}
															);
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
};
