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
				function (err1, cc) {
					let errMsg1 = errorMessage(err1, cc, "Money is already claimed", true);
					if (errMsg1.status == 0) {
						res.status(200).json(errMsg1);
					} else {
						CashierSend.findOne(
							{
								transaction_code: transferCode,
							},
							function (err2, sendRecord) {
								let errMsg2 = errorMessage(
									err2,
									sendRecord,
									"Cashier Send Record Not Found"
								);
								if (errMsg2.status == 0) {
									res.status(200).json(errMsg2);
								} else {
									Branch.findOne(
										{
											_id: cashier.branch_id,
										},
										function (err3, branch) {
											let errMsg3 = errorMessage(
												err3,
												branch,
												"Branch Not Found"
											);
											if (errMsg3.status == 0) {
												res.status(200).json(errMsg3);
											} else {
												Bank.findOne(
													{
														_id: cashier.bank_id,
													},
													function (err4, bank) {
														let errMsg4 = errorMessage(
															err4,
															branch,
															"Bank Not Found"
														);
														if (errMsg4.status == 0) {
															res.status(200).json(errMsg4);
														} else {
															Bank.findOne(
																{ _id: sendRecord.sending_bank_id },
																(err5, sendingBank) => {
																	let errMsg5 = errorMessage(
																		err5,
																		branch,
																		"Sender Bank Not Found"
																	);
																	if (errMsg5.status == 0) {
																		res.status(200).json(errMsg5);
																	} else {
																		const find = {
																			bank_id: sendingBank._id,
																			type: sendRecord.inter_bank_rule_type,
																			status: 1,
																			active: 1,
																		};
																		InterBankRule.findOne(
																			find,
																			function (err6, rule1) {
																				let errMsg6 = errorMessage(
																					err6,
																					rule1,
																					"Inter Bank Fee Rule Not Found"
																				);
																				if (errMsg6.status == 0) {
																					res.status(200).json(errMsg6);
																				} else {
																					const find1 = {
																						bank_id: cashier.bank_id,
																						trans_type: sendRecord.rule_type,
																						status: 1,
																						active: "Active",
																					};
																					Fee.findOne(
																						find1,
																						function (err7, rule2) {
																							let errMsg7 = errorMessage(
																								err7,
																								rule2,
																								"Revenue Rule Not Found"
																							);
																							if (errMsg7.status == 0) {
																								res.status(200).json(errMsg7);
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
																									(err8, claimObj) => {
																										if (err8) {
																											res
																												.status(200)
																												.json(catchError(err8));
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
																															(err9) => {
																																if (err9) {
																																	res
																																		.status(200)
																																		.json(
																																			catchError(
																																				err9
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
																												.catch((err10) => {
																													txstate.failed(
																														categoryConst.MAIN,
																														sendRecord.master_code
																													);
																													console.log(
																														err10.toString()
																													);
																													res.status(200).json({
																														status: 0,
																														message:
																															err10.message,
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
				function (err1, cc) {
					let errMsg1 = errorMessage(err1, cc, "Money is already claimed", true);
					if (errMsg1.status == 0) {
						res.status(200).json(errMsg1);
					} else {
						CashierSend.findOne(
							{
								transaction_code: transferCode,
							},
							function (err2, sendRecord) {
								let errMsg2 = errorMessage(
									err2,
									sendRecord,
									"Cashier send record not found"
								);
								if (errMsg2.status == 0) {
									res.status(200).json(errMsg2);
								} else {
									PartnerBranch.findOne(
										{
											_id: cashier.branch_id,
										},
										function (err3, branch) {
											let errMsg3 = errorMessage(
												err3,
												branch,
												"Branch Not Found"
											);
											if (errMsg3.status == 0) {
												res.status(200).json(errMsg3);
											} else {
												Partner.findOne(
													{ _id: branch.partner_id },
													(err4, partner) => {
														let errMsg4 = errorMessage(
															err4,
															partner,
															"Partner not Found"
														);
														if (errMsg4.status == 0) {
															res.status(200).json(errMsg4);
														} else {
															Bank.findOne(
																{
																	_id: cashier.bank_id,
																},
																function (err5, bank) {
																	let errMsg5 = errorMessage(
																		err5,
																		bank,
																		"Bank not Found"
																	);
																	if (errMsg5.status == 0) {
																		res.status(200).json(errMsg5);
																	} else {
																		Bank.findOne(
																			{ _id: sendRecord.sending_bank_id },
																			(err6, sendingBank) => {
																				let errMsg6 = errorMessage(
																					err6,
																					bank,
																					"Sending Bank not Found"
																				);
																				if (errMsg6.status == 0) {
																					res.status(200).json(errMsg6);
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
																						function (err7, rule1) {
																							let result7 = errorMessage(
																								err7,
																								rule1,
																								"Inter Bank Rule Not Found"
																							);
																							if (result7.status == 0) {
																								res.status(200).json(result7);
																							} else {
																								const find1 = {
																									bank_id: cashier.bank_id,
																									trans_type:
																										sendRecord.rule_type,
																									status: 1,
																									active: "Active",
																								};
																								Fee.findOne(
																									find1,
																									function (err8, rule2) {
																										let result8 = errorMessage(
																											err8,
																											rule2,
																											"Revenue Rule Not Found"
																										);
																										if (result8.status == 0) {
																											res
																												.status(200)
																												.json(result8);
																										} else {
																											var otherInfo = {
																												cashierId: cashier._id,
																												sendRecord: sendRecord,
																											};
																											addClaimRecord(
																												req.body,
																												otherInfo,
																												(err9, claimObj) => {
																													if (err9) {
																														res
																															.status(200)
																															.json(
																																catchError(err9)
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
																																		(err10) => {
																																			if (err10) {
																																				res
																																					.status(
																																						200
																																					)
																																					.json(
																																						catchError(
																																							err10
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
																															.catch((err11) => {
																																txstate.failed(
																																	categoryConst.MAIN,
																																	sendRecord.master_code
																																);
																																console.log(
																																	err11.toString()
																																);
																																res
																																	.status(200)
																																	.json({
																																		status: 0,
																																		message:
																																			err11.message,
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
