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
					(err1, cc) => {
						let errRes1 = errorMessage(
							err1,
							cc,
							"Money is already claimed",
							true
						);
						if (errRes1.status == 0) {
							res.status(200).json(errRes1);
						} else {
							CashierSend.findOne(
								{
									transaction_code: transferCode,
								},
								function (err2, sendRecord) {
									let errRes2 = errorMessage(
										err2,
										sendRecord,
										"Transaction Not Found"
									);
									if (errRes2.status == 0) {
										res.status(200).json(errRes2);
									} else {
										Branch.findOne(
											{
												_id: cashier.branch_id,
											},
											function (err3, branch) {
												let errRes3 = errorMessage(
													err3,
													branch,
													"Branch Not Found"
												);
												if (errRes3.status == 0) {
													res.status(200).json(errRes3);
												} else {
													Bank.findOne(
														{
															_id: cashier.bank_id,
														},
														function (err4, bank) {
															let errRes4 = errorMessage(
																err4,
																bank,
																"Bank Not Found"
															);
															if (errRes4.status == 0) {
																res.status(200).json(errRes4);
															} else {
																const find = {
																	bank_id: cashier.bank_id,
																	trans_type: sendRecord.rule_type,
																	status: 1,
																	active: "Active",
																};
																Fee.findOne(find, function (err5, rule) {
																	let errRes5 = errorMessage(
																		err5,
																		rule,
																		"Revenue Rule Not Found"
																	);
																	if (errRes5.status == 0) {
																		res.status(200).json(errRes5);
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
																			(err6, claimObj) => {
																				if (err6) {
																					res.status(200).json(catchError(err6));
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
																									(err7) => {
																										if (err7) {
																											res
																												.status(200)
																												.json(catchError(err7));
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
																						.catch((err8) => {
																							txstate.failed(
																								categoryConst.MAIN,
																								sendRecord.master_code
																							);
																							console.log(err8);
																							res.status(200).json({
																								status: 0,
																								message: err8.message,
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
		function (err0, cashier) {
			let result0 = errorMessage(
				err0,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result0.status == 0) {
				res.status(200).json(result0);
			} else {
				Partner.findOne({ _id: cashier.partner_id }, (err1, partner) => {
					let result1 = errorMessage(err1, partner, "Partner not found");
					if (result1.status == 0) {
						res.status(200).json(result1);
					} else {
						CashierClaim.findOne(
							{
								transaction_code: transferCode,
								status: 1,
							},
							(err2, cc) => {
								if (err2) {
									console.log(err2);
									var message2 = err2;
									if (err2.message) {
										message2 = err.message;
									}
									res.status(200).json({
										status: 0,
										message: message2,
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
										function (err3, sendRecord) {
											let result3 = errorMessage(
												err3,
												sendRecord,
												"Transaction Not Found"
											);
											if (result3.status == 0) {
												res.status(200).json(result3);
											} else {
												PartnerBranch.findOne(
													{
														_id: cashier.branch_id,
													},
													function (err4, branch) {
														let result4 = errorMessage(
															err4,
															branch4,
															"Branch Not Found"
														);
														if (result4.status == 0) {
															res.status(200).json(result4);
														} else {
															Bank.findOne(
																{
																	_id: cashier.bank_id,
																},
																function (err5, bank) {
																	let result5 = errorMessage(
																		err5,
																		bank,
																		"Bank Not Found"
																	);
																	if (result5.status == 0) {
																		res.status(200).json(result5);
																	} else {
																		const find = {
																			bank_id: cashier.bank_id,
																			trans_type: sendRecord.rule_type,
																			status: 1,
																			active: "Active",
																		};
																		Fee.findOne(find, function (err6, rule) {
																			let result6 = errorMessage(
																				err6,
																				rule,
																				"Revenue Rule Not Found"
																			);
																			if (result6.status == 0) {
																				res.status(200).json(result6);
																			} else {
																				var otherInfo = {
																					cashierId: cashier._id,
																					sendRecord: sendRecord,
																				};
																				addClaimRecord(
																					req.body,
																					otherInfo,
																					(err7, claimObj) => {
																						if (err7) {
																							res
																								.status(200)
																								.json(catchError(err7));
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
																											(err8) => {
																												if (err8) {
																													res
																														.status(200)
																														.json(
																															catchError(err8)
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
																								.catch((err9) => {
																									res
																										.status(200)
																										.json(catchError(err9));
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
