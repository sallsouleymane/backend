//utils
const makeid = require("../../routes/utils/idGenerator");
const sendSMS = require("../../routes/utils/sendSMS");
const sendMail = require("../../routes/utils/sendMail");
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");

const addCashierSendRecord = require("../utils/addSendRecord");
const updateCashierRecords = require("../utils/updateSendRecord");
const { jwtAuthentication } = require("./utils");

//models
const Infra = require("../../models/Infra");
const Fee = require("../../models/Fee");
const User = require("../../models/User");
const Bank = require("../../models/Bank");
const Branch = require("../../models/Branch");
const Cashier = require("../../models/Cashier");
const Partner = require("../../models/partner/Partner");
const PartnerBranch = require("../../models/partner/Branch");
const PartnerCashier = require("../../models/partner/Cashier");
const InterBankRule = require("../../models/InterBankRule");

// transactions
const txstate = require("../transactions/services/states");
const cashierToOperational = require("../transactions/interBank/cashierToOperational");
const cashierToCashier = require("../transactions/interBank/cashierToCashier");
const cashierToWallet = require("../transactions/interBank/cashierToWallet");

//constants
const categoryConst = require("../transactions/constants/category");

module.exports.cashierSendMoney = async function (req, res) {
	const {
		receiverMobile,
		receiverEmail,
		receiverIdentificationAmount,
		isInclusive,
	} = req.body;

	const transactionCode = makeid(8);

	jwtAuthentication("cashier", req, async function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			// Initiate transaction
			const master_code = await txstate.initiate(
				categoryConst.MAIN,
				cashier.bank_id,
				"Inter Bank Non Wallet To Non Wallet",
				cashier._id,
				cashier.cash_in_hand,
				req.body,
			);
			Branch.findOne(
				{
					_id: cashier.branch_id,
				},
				function (err1, branch) {
					let errMsg1 = errorMessage(err1, branch, "Branch Not Found");
					if (errMsg1.status == 0) {
						res.status(200).json(errMsg1);
					} else {
						Bank.findOne(
							{
								_id: cashier.bank_id,
							},
							function (err18, bank) {
								let errMsg18 = errorMessage(err18, bank, "Bank Not Found");
								if (errMsg18.status == 0) {
									res.status(200).json(errMsg18);
								} else {
									Infra.findOne(
										{
											_id: bank.user_id,
										},
										function (err2, infra) {
											let errMsg2 = errorMessage(err2, infra, "Infra Not Found");
											if (errMsg2.status == 0) {
												res.status(200).json(errMsg2);
											} else {
												const find = {
													bank_id: bank._id,
													type: "IBNWNW",
													status: 1,
													active: 1,
												};
												InterBankRule.findOne(find, function (err3, rule1) {
													let errMsg3 = errorMessage(
														err3,
														rule1,
														"Inter bank fee Rule Not Found"
													);
													if (errMsg3.status == 0) {
														res.status(200).json(errMsg3);
													} else {
														const find1 = {
															bank_id: bank._id,
															trans_type: "Non Wallet to Non Wallet",
															status: 1,
															active: "Active",
														};
														Fee.findOne(find1, function (err4, rule2) {
															let errMsg4 = errorMessage(
																err4,
																rule2,
																"Revenue Rule Not Found"
															);
															if (errMsg4.status == 0) {
																res.status(200).json(errMsg4);
															} else {
																var otherInfo = {
																	cashierId: cashier._id,
																	transactionCode: transactionCode,
																	ruleType: "Non Wallet to Non Wallet",
																	masterCode: master_code,
																	branchId: branch._id,
																	branchType: "branch",
																	isInterBank: 1,
																	interBankRuleType: "IBNWNW",
																	bankId: bank._id,
																};
																addCashierSendRecord(
																	req.body,
																	otherInfo,
																	(err5, cs) => {
																		if (err5) {
																			res.status(200).json(catchError(err5));
																		} else {
																			const transfer = {
																				amount: receiverIdentificationAmount,
																				isInclusive: isInclusive,
																				senderType: "sendBranch",
																				senderCode: branch.bcode,
																				master_code: master_code,
																				cashierId: cashier._id,
																			};
																			cashierToCashier(
																				transfer,
																				infra,
																				bank,
																				branch,
																				rule1,
																				rule2
																			)
																				.then(function (result) {
																					if (result.status == 1) {
																						let content =
																							"Your Transaction Code is " +
																							transactionCode;
																						if (
																							receiverMobile &&
																							receiverMobile != null
																						) {
																							sendSMS(content, receiverMobile);
																						}
																						if (
																							receiverEmail &&
																							receiverEmail != null
																						) {
																							sendMail(
																								content,
																								"Transaction Code",
																								receiverEmail
																							);
																						}

																						otherInfo.csId = cs._id;
																						otherInfo.amount = result.amount;
																						otherInfo.fee = result.fee;
																						otherInfo.sendFee = result.sendFee;

																						updateCashierRecords(
																							"cashier",
																							otherInfo,
																							(err6) => {
																								if (err6) {
																									res
																										.status(200)
																										.json(catchError(err6));
																								} else {
																									txstate.waitingForCompletion(
																										categoryConst.MAIN,
																										master_code,
																										{
																											infra_fee:result.infraFee,
																											bank_fee: result.fee,
																											send_fee: result.sendFee,
																										}
																									);
																									res.status(200).json({
																										status: 1,
																										message:
																											"transaction success",
																									});
																								}
																							}
																						);
																					} else {
																						txstate.failed(
																							categoryConst.MAIN,
																							master_code
																						);
																						res.status(200).json(result);
																					}
																				})
																				.catch((err7) => {
																					txstate.failed(
																						categoryConst.MAIN,
																						master_code
																					);
																					console.log(err7);
																					res.status(200).json({
																						status: 0,
																						message: err7.message,
																					});
																				});
																		}
																	}
																);
															}
														});
													}
												});
											} //infra
										}
									);
								}
							}
						);
					}
				}
			); //branch
		}
	});
};

module.exports.partnerSendMoney = async function (req, res) {
	const {
		receiverMobile,
		receiverEmail,
		receiverIdentificationAmount,
		isInclusive,
	} = req.body;

	const transactionCode = makeid(8);

	jwtAuthentication("partnerCashier", req, async function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			// Initiate transaction
			const master_code = await txstate.initiate(
				categoryConst.MAIN,
				cashier.bank_id,
				"Inter Bank Non Wallet To Non Wallet",
				cashier._id,
				cashier.cash_in_hand,
				req.body,
			);
			PartnerBranch.findOne(
				{
					_id: cashier.branch_id,
				},
				function (err1, branch) {
					let result1 = errorMessage(err1, branch, "Branch Not Found");
					if (result1.status == 0) {
						res.status(200).json(result1);
					} else {
						Partner.findOne({ _id: cashier.partner_id }, (err2, partner) => {
							let result2 = errorMessage(err2, partner, "Partner not found");
							if (result2.status == 0) {
								res.status(200).json(result2);
							} else {
								Bank.findOne(
									{
										_id: cashier.bank_id,
									},
									function (err3, bank) {
										let result3 = errorMessage(err3, bank, "Bank Not Found");
										if (result3.status == 0) {
											res.status(200).json(result3);
										} else {
											Infra.findOne(
												{
													_id: bank.user_id,
												},
												function (err4, infra) {
													let result4= errorMessage(
														err4,
														infra,
														"Infra Not Found"
													);
													if (result4.status == 0) {
														res.status(200).json(result4);
													} else {
														const find = {
															bank_id: bank._id,
															type: "IBNWNW",
															status: 1,
															active: 1,
														};
														InterBankRule.findOne(find, function (err5, rule1) {
															let result5 = errorMessage(
																err5,
																rule1,
																"Inter Bank Rule Not Found"
															);
															if (result5.status == 0) {
																res.status(200).json(result5);
															} else {
																const find1 = {
																	bank_id: bank._id,
																	trans_type: "Non Wallet to Non Wallet",
																	status: 1,
																	active: "Active",
																};
																Fee.findOne(find1, function (err6, rule2) {
																	let result6 = errorMessage(
																		err6,
																		rule2,
																		"Revenue Rule Not Found"
																	);
																	if (result6.status == 0) {
																		res.status(200).json(result6);
																	} else {
																		var otherInfo = {
																			cashierId: cashier._id,
																			transactionCode: transactionCode,
																			ruleType: "Non Wallet to Non Wallet",
																			masterCode: master_code,
																			branchId: branch._id,
																			branchType: "partnerbranch",
																			isInterBank: 1,
																			interBankRuleType: "IBNWNW",
																			bankId: bank._id,
																		};
																		addCashierSendRecord(
																			req.body,
																			otherInfo,
																			(err7, cs) => {
																				if (err7) {
																					res.status(200).json(catchError(err7));
																				} else {
																					var transfer = {
																						master_code: master_code,
																						amount: receiverIdentificationAmount,
																						isInclusive: isInclusive,
																						cashierId: cashier._id,
																						senderType: "sendPartner",
																						senderCode: partner.code,
																					};
																					cashierToCashier(
																						transfer,
																						infra,
																						bank,
																						branch,
																						rule1,
																						rule2
																					)
																						.then(function (result) {
																							if (result.status == 1) {
																								let content =
																									"Your Transaction Code is " +
																									transactionCode;
																								if (
																									receiverMobile &&
																									receiverMobile != null
																								) {
																									sendSMS(
																										content,
																										receiverMobile
																									);
																								}
																								if (
																									receiverEmail &&
																									receiverEmail != null
																								) {
																									sendMail(
																										content,
																										"Transaction Code",
																										receiverEmail
																									);
																								}

																								otherInfo.csId = cs._id;
																								otherInfo.amount =
																									result.amount;
																								otherInfo.fee = result.fee;
																								otherInfo.sendFee =
																									result.sendFee;

																								updateCashierRecords(
																									"partnercashier",
																									otherInfo,
																									(err8) => {
																										if (err8) {
																											res
																												.status(200)
																												.json(catchError(err8));
																										} else {
																											txstate.completed(
																												categoryConst.MAIN,
																												master_code,
																												{
																													infra_fee:result.infraFee,
																													bank_fee: result.fee,
																													send_fee: result.sendFee,
																												}
																											);
																											res.status(200).json({
																												status: 1,
																												message:
																													"transaction success",
																											});
																										}
																									}
																								);
																							} else {
																								txstate.failed(
																									categoryConst.MAIN,
																									master_code
																								);
																								res.status(200).json(result);
																							}
																						})
																						.catch((err9) => {
																							txstate.failed(
																								categoryConst.MAIN,
																								master_code
																							);
																							console.log(err9);
																							res.status(200).json({
																								status: 0,
																								message: err9.message,
																							});
																						});
																				}
																			}
																		);
																	}
																});
															}
														});
													} //infra
												}
											);
										}
									}
								);
							}
						});
					}
				}
			); //branch
		}
	});
};

module.exports.cashierSendMoneyToWallet = function (req, res) {
	const {
		receiverMobile,
		receiverIdentificationAmount,
		isInclusive,
	} = req.body;

	jwtAuthentication("cashier", req, async function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			// Initiate transaction
			const master_code = await txstate.initiate(
				categoryConst.MAIN,
				cashier.bank_id,
				"Inter Bank Non Wallet To Wallet",
				cashier._id,
				cashier.cash_in_hand,
				req.body,
			);
			User.findOne(
				{
					mobile: receiverMobile,
				},
				function (err1, receiver) {
					let result1 = errorMessage(err1, receiver, "Receiver Not Found");
					if (result1.status == 0) {
						res.status(200).json(result1);
					} else {
						Bank.findOne({ _id: receiver.bank_id }, (err2, receiverBank) => {
							let result2 = errorMessage(
								err2,
								receiverBank,
								"Receiver Not Found"
							);
							if (result2.status == 0) {
								res.status(200).json(result2);
							} else {
								Branch.findOne(
									{
										_id: cashier.branch_id,
									},
									function (err3, branch) {
										let result3 = errorMessage(err3, branch, "Branch Not Found");
										if (result3.status == 0) {
											res.status(200).json(result3);
										} else {
											Bank.findOne(
												{
													_id: cashier.bank_id,
												},
												function (err4, bank) {
													let result4 = errorMessage(
														err4,
														bank,
														"Bank Not Found"
													);
													if (result.status == 0) {
														res.status(200).json(result4);
													} else {
														Infra.findOne(
															{
																_id: bank.user_id,
															},
															function (err5, infra) {
																let result5 = errorMessage(
																	err5,
																	infra,
																	"Infra Not Found"
																);
																if (result5.status == 0) {
																	res.status(200).json(result5);
																} else {
																	var find = {
																		bank_id: bank._id,
																		type: "IBNWW",
																		status: 1,
																		active: 1,
																	};
																	InterBankRule.findOne(
																		find,
																		function (err6, rule1) {
																			let result6 = errorMessage(
																				err6,
																				rule1,
																				"Inter Bank Revenue Rule Not Found"
																			);
																			if (result6.status == 0) {
																				res.status(200).json(result6);
																			} else {
																				find = {
																					bank_id: bank._id,
																					trans_type: "Non Wallet to Wallet",
																					status: 1,
																					active: "Active",
																				};
																				Fee.findOne(
																					find,
																					function (err7, rule2) {
																						let result7 = errorMessage(
																							err7,
																							rule2,
																							"Revenue Rule Not Found"
																						);
																						if (result7.status == 0) {
																							res.status(200).json(result7);
																						} else {
																							//End

																							req.body.withoutID = false;
																							req.body.receiverccode = "";
																							req.body.receiverGivenName =
																								receiver.name;
																							req.body.receiverFamilyName =
																								receiver.last_name;
																							req.body.receiverCountry =
																								receiver.country;
																							req.body.receiverEmail =
																								receiver.email;
																							req.body.receiverIdentificationCountry =
																								"";
																							req.body.receiverIdentificationType =
																								receiver.id_type;
																							req.body.receiverIdentificationNumber =
																								receiver.id_number;
																							req.body.receiverIdentificationValidTill =
																								receiver.valid_till;

																							var otherInfo = {
																								cashierId: cashier._id,
																								transactionCode: "",
																								ruleType:
																									"Non Wallet to Wallet",
																								masterCode: master_code,
																								branchId: branch._id,
																								branchType: "branch",
																								isInterBank: 1,
																								interBankRuleType: "IBNWW",
																								bankId: bank._id,
																							};
																							addCashierSendRecord(
																								req.body,
																								otherInfo,
																								(err8, cs) => {
																									if (err8) {
																										res
																											.status(200)
																											.json(catchError(err8));
																									} else {
																										var transfer = {
																											master_code: master_code,
																											amount: receiverIdentificationAmount,
																											isInclusive: isInclusive,
																											cashierId: cashier._id,
																											senderType: "sendBranch",
																											senderCode: branch.bcode,
																										};
																										cashierToWallet(
																											transfer,
																											infra,
																											bank,
																											receiverBank,
																											branch,
																											receiver,
																											rule1,
																											rule2
																										)
																											.then(function (result) {
																												console.log(
																													"Result: " + result
																												);
																												if (
																													result.status == 1
																												) {
																													otherInfo.csId =
																														cs._id;
																													otherInfo.amount =
																														result.amount;
																													otherInfo.fee =
																														result.fee;
																													otherInfo.sendFee =
																														result.sendFee;

																													updateCashierRecords(
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
																																	master_code,
																																	{
																																		infra_fee:result.infraFee,
																																		bank_fee: result.fee,
																																		send_fee: result.sendFee,
																																		inter_bank_fee: result.interBankFee,
																																	}
																																);
																																res
																																	.status(200)
																																	.json({
																																		status: 1,
																																		message:
																																			"transaction success",
																																	});
																															}
																														}
																													);
																												} else {
																													txstate.failed(
																														categoryConst.MAIN,
																														master_code
																													);
																													res
																														.status(200)
																														.json(result);
																												}
																											})
																											.catch((err10) => {
																												txstate.failed(
																													categoryConst.MAIN,
																													master_code
																												);
																												console.log(err10);
																												res.status(200).json({
																													status: 0,
																													message: err10.message,
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
																	);
																}
															}
														);
													}
												}
											);
										} //infra
									}
								);
							}
						});
					}
				}
			);
		}
	}); //branch
};

module.exports.partnerSendMoneyToWallet = function (req, res) {
	const {
		receiverMobile,
		receiverIdentificationAmount,
		isInclusive,
	} = req.body;

	jwtAuthentication("partnerCashier", req, async function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			// Initiate transaction
			const master_code = await txstate.initiate(
				categoryConst.MAIN,
				cashier.bank_id,
				"Inter Bank Non Wallet To Wallet",
				cashier._id,
				cashier.cash_in_hand,
				req.body,
			);
			Partner.findOne({ _id: cashier.partner_id }, (err1, partner) => {
				let result1 = errorMessage(err1, partner, "Partner not found");
				if (result1.status == 0) {
					res.status(200).json(result1);
				} else {
					User.findOne(
						{
							mobile: receiverMobile,
						},
						function (err2, receiver) {
							let result2 = errorMessage(err2, receiver, "Receiver Not Found");
							if (result2.status == 0) {
								res.status(200).json(result2);
							} else {
								Bank.findOne({ _id: receiver.bank_id }, (err3, receiverBank) => {
									let result3 = errorMessage(
										err3,
										receiverBank,
										"Receiver Bank Not Found"
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
													branch,
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
																Infra.findOne(
																	{
																		_id: bank.user_id,
																	},
																	function (err6, infra) {
																		let result6 = errorMessage(
																			err6,
																			infra,
																			"Infra Not Found"
																		);
																		if (result6.status == 0) {
																			res.status(200).json(result6);
																		} else {
																			var find = {
																				bank_id: bank._id,
																				type: "IBNWW",
																				status: 1,
																				active: 1,
																			};
																			InterBankRule.findOne(
																				find,
																				function (err7, rule1) {
																					let result7 = errorMessage(
																						err7,
																						rule1,
																						"Inter Bank Revenue Rule Not Found"
																					);
																					if (result7.status == 0) {
																						res.status(200).json(result7);
																					} else {
																						find = {
																							bank_id: bank._id,
																							trans_type:
																								"Non Wallet to Wallet",
																							status: 1,
																							active: "Active",
																						};
																						Fee.findOne(
																							find,
																							function (err8, rule2) {
																								if (err8) {
																									console.log(err8);
																									var message8 = err8;
																									if (err8.message) {
																										message8= err8.message;
																									}
																									res.status(200).json({
																										status: 0,
																										message: message8,
																									});
																								} else if (rule2 == null) {
																									res.status(200).json({
																										status: 0,
																										message:
																											"Revenue Rule Not Found",
																									});
																								} else {
																									req.body.withoutID = false;
																									req.body.receiverccode = "";
																									req.body.receiverGivenName =
																										receiver.name;
																									req.body.receiverFamilyName =
																										receiver.last_name;
																									req.body.receiverCountry =
																										receiver.country;
																									req.body.receiverEmail =
																										receiver.email;
																									req.body.receiverIdentificationCountry =
																										"";
																									req.body.receiverIdentificationType =
																										receiver.id_type;
																									req.body.receiverIdentificationNumber =
																										receiver.id_number;
																									req.body.receiverIdentificationValidTill =
																										receiver.valid_till;

																									var otherInfo = {
																										cashierId: cashier._id,
																										transactionCode: "",
																										ruleType:
																											"Non Wallet to Wallet",
																										masterCode: master_code,
																										branchId: branch._id,
																										branchType: "partnerbranch",
																										isInterBank: 1,
																										interBankRuleType: "IBNWW",
																										bankId: bank._id,
																									};
																									addCashierSendRecord(
																										req.body,
																										otherInfo,
																										(err9, cs) => {
																											if (err9) {
																												res
																													.status(200)
																													.json(
																														catchError(err9)
																													);
																											} else {
																												//End
																												var transfer = {
																													master_code: master_code,
																													amount: receiverIdentificationAmount,
																													isInclusive: isInclusive,
																													cashierId:
																														cashier._id,
																													partnerCode:
																														partner.code,
																													senderType:
																														"sendPartner",
																													senderCode:
																														partner.code,
																												};
																												cashierToWallet(
																													transfer,
																													infra,
																													bank,
																													receiverBank,
																													branch,
																													receiver,
																													rule1,
																													rule2
																												)
																													.then(function (
																														result
																													) {
																														console.log(
																															"Result: " +
																																result
																														);
																														if (
																															result.status == 1
																														) {
																															otherInfo.csId =
																																cs._id;
																															otherInfo.amount =
																																result.amount;
																															otherInfo.fee =
																																result.fee;
																															otherInfo.sendFee =
																																result.sendFee;

																															updateCashierRecords(
																																"partnerCashier",
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
																																			master_code,
																																			{
																																				infra_fee:result.infraFee,
																																				bank_fee: result.fee,
																																				send_fee: result.sendFee,
																																				inter_bank_fee: result.interBankFee,
																																			}
																																		);
																																		res
																																			.status(
																																				200
																																			)
																																			.json({
																																				status: 1,
																																				message:
																																					"transaction success",
																																			});
																																	}
																																}
																															);
																														} else {
																															res
																																.status(200)
																																.json(result);
																														}
																													})
																													.catch((err11) => {
																														txstate.failed(
																															categoryConst.MAIN,
																															master_code
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
																			);
																		}
																	}
																);
															}
														}
													);
												} //infra
											}
										);
									}
								});
							}
						}
					);
				}
			});
		}
	}); //branch
};

module.exports.cashierSendToOperational = async function (req, res) {
	const { wallet_id, amount, is_inclusive } = req.body;
	var code = wallet_id.substr(0, 2);
	if (code != "PB") {
		res.status(200).json({
			status: 0,
			message: "You can only send to branch and partner branch",
		});
		return;
	}
	jwtAuthentication("cashier", req, async function (err1, cashier) {
		if (err1) {
			res.status(200).json(err1);
		} else {
			// Initiate transaction state
			const master_code = await txstate.initiate(
				categoryConst.MAIN,
				cashier.bank_id,
				"Inter Bank Non Wallet to Operational",
				cashier._id,
				""
			);
			Branch.findOne({ _id: cashier.branch_id }, (err2, branch) => {
				let result2 = errorMessage(err2, branch, "Branch not found");
				if (result2.status == 0) {
					res.status(200).json(result2);
				} else {
					Bank.findOne({ _id: branch.bank_id }, (err3, bank) => {
						let result3 = errorMessage(err3, bank, "Bank not found");
						if (result3.status == 0) {
							res.status(200).json(result3);
						} else {
							Infra.findOne({ _id: bank.user_id }, (err4, infra) => {
								let result4 = errorMessage(err4, infra, "Infra not found");
								if (result4.status == 0) {
									res.status(200).json(result4);
								} else {
									
									const Collection = getTypeClass(code);
									Collection.findOne(
										{
											_id: { $ne: branch._id },
											"wallet_ids.operational": wallet_id,
										},
										(err5, toBranch) => {
											let result5 = errorMessage(
												err5,
												toBranch,
												"Invalid wallet ID"
											);
											if (result5.status == 0) {
												res.status(200).json(result5);
											} else {
												Bank.findOne(
													{ _id: toBranch.bank_id },
													(err6, toBank) => {
														let result6 = errorMessage(
															err6,
															toBank,
															"To Branch's bank not found"
														);
														if (result6.status == 0) {
															res.status(200).json(result6);
														} else {
															var find1 = {
																bank_id: bank._id,
																type: "IBNWO",
																status: 1,
																active: 1,
															};
															InterBankRule.findOne(
																find1,
																function (err7, rule1) {
																	let result7 = errorMessage(
																		err7,
																		rule1,
																		"Inter Bank Revenue Rule Not Found"
																	);
																	if (result7.status == 0) {
																		res.status(200).json(result7);
																	} else {
																		Fee.findOne(find1, (err8, rule2) => {
																			let errMsg8 = errorMessage(
																				err8,
																				rule2,
																				"Rule not found"
																			);
																			if (errMsg8.status == 0) {
																				res.status(200).json(errMsg8);
																			} else {
																				req.body.withoutID = false;
																				req.body.receiverccode = toBranch.ccode;
																				req.body.receiverGivenName =
																					toBranch.name;
																				req.body.receiverFamilyName = "";
																				req.body.receiverCountry =
																					toBranch.country;
																				req.body.receiverMobile =
																					toBranch.mobile;
																				req.body.receiverEmail = toBranch.email;
																				req.body.receiverIdentificationCountry =
																					"";
																				req.body.receiverIdentificationType =
																					"";
																				req.body.receiverIdentificationNumber =
																					"";
																				req.body.receiverIdentificationValidTill =
																					"";

																				var otherInfo = {
																					cashierId: cashier._id,
																					transactionCode: "",
																					ruleType: "Non Wallet to Operational",
																					masterCode: master_code,
																					branchId: branch._id,
																					branchType: "branch",
																					isInterBank: 1,
																					interBankRuleType: "IBNWO",
																					bankId: bank._id,
																				};
																				addCashierSendRecord(
																					req.body,
																					otherInfo,
																					(err9, cs) => {
																						if (err9) {
																							res
																								.status(200)
																								.json(catchError(err9));
																						} else {
																							const transfer = {
																								amount: amount,
																								isInclusive: is_inclusive,
																								master_code: master_code,
																								senderType: "sendBranch",
																								senderCode: branch.bcode,
																								cashierId: cashier._id,
																							};
																							cashierToOperational(
																								transfer,
																								infra,
																								bank,
																								toBank,
																								branch,
																								toBranch,
																								rule1,
																								rule2
																							)
																								.then((result) => {
																									if (result.status == 1) {
																										otherInfo.csId = cs._id;
																										otherInfo.amount =
																											result.amount;
																										otherInfo.fee = result.fee;
																										otherInfo.sendFee =
																											result.sendFee;

																										updateCashierRecords(
																											"cashier",
																											otherInfo,
																											(err10) => {
																												if (err10) {
																													res
																														.status(200)
																														.json(
																															catchError(err10)
																														);
																												} else {
																													txstate.completed(
																														categoryConst.MAIN,
																														master_code
																													);
																													res.status(200).json({
																														status: 1,
																														message:
																															result.amount +
																															"XOF amount is Transferred",
																													});
																												}
																											}
																										);
																									} else {
																										txstate.failed(
																											categoryConst.MAIN,
																											master_code
																										);
																										res
																											.status(200)
																											.json(result);
																									}
																								})
																								.catch((err11) => {
																									txstate.failed(
																										categoryConst.MAIN,
																										master_code
																									);
																									console.log(err11);
																									res.status(200).json({
																										status: 0,
																										message: err11.message,
																									});
																								});
																						}
																					}
																				);
																			}
																		});
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
							});
						}
					});
				}
			});
		}
	});
};

module.exports.partnerSendToOperational = async function (req, res) {
	const { wallet_id, amount, is_inclusive } = req.body;
	jwtAuthentication("partnerCashier", req, async function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			// Initiate transaction state
			const master_code = await txstate.initiate(
				categoryConst.MAIN,
				cashier.bank_id,
				"Non Wallet to Operational",
				cashier._id,
				""
			);
			Partner.findOne({ _id: cashier.partner_id }, (err1, partner) => {
				let result1 = errorMessage(err1, partner, "Partner Not Found");
				if (result1.status == 0) {
					res.status(200).json(result1);
				} else {
					PartnerBranch.findOne({ _id: cashier.branch_id }, (err2, branch) => {
						let result2 = errorMessage(err2, branch, "Branch not found");
						if (result2.status == 0) {
							res.status(200).json(result2);
						} else {
							Bank.findOne({ _id: branch.bank_id }, (err3, bank) => {
								let result3 = errorMessage(err3, bank, "Bank not found");
								if (result3.status == 0) {
									res.status(200).json(result3);
								} else {
									Infra.findOne({ _id: bank.user_id }, (err4, infra) => {
										let result4 = errorMessage(err4, infra, "Infra not found");
										if (result4.status == 0) {
											res.status(200).json(result4);
										} else {
											const Collection = getTypeClass(code);
											Collection.findOne(
												{
													_id: { $ne: branch._id },
													"wallet_ids.operational": wallet_id,
												},
												(err5, toBranch) => {
													let result5 = errorMessage(
														err5,
														toBranch,
														"Invalid wallet ID"
													);
													if (result5.status == 0) {
														res.status(200).json(result5);
													} else {
														Bank.findOne(
															{ _id: toBranch.bank_id },
															(err6, toBank) => {
																let result6 = errorMessage(
																	err6,
																	toBank,
																	"To Branch's bank not found"
																);
																if (result6.status == 0) {
																	res.status(200).json(result6);
																} else {
																	var find = {
																		bank_id: bank._id,
																		type: "IBNWO",
																		status: 1,
																		active: 1,
																	};
																	InterBankRule.findOne(
																		find,
																		function (err7, rule1) {
																			let result7 = errorMessage(
																				err7,
																				rule1,
																				"Inter Bank Revenue Rule Not Found"
																			);
																			if (result7.status == 0) {
																				res.status(200).json(result7);
																			} else {
																				const find1 = {
																					bank_id: bank._id,
																					trans_type:
																						"Non Wallet to Operational",
																					status: 1,
																					active: "Active",
																				};
																				Fee.findOne(find1, (err8, rule2) => {
																					let result8= errorMessage(
																						err8,
																						rule,
																						"Rule not found"
																					);
																					if (result8.status == 0) {
																						res.status(200).json(result8);
																					} else {
																						req.body.withoutID = false;
																						req.body.receiverccode =
																							toBranch.ccode;
																						req.body.receiverGivenName =
																							toBranch.name;
																						req.body.receiverFamilyName = "";
																						req.body.receiverCountry =
																							toBranch.country;
																						req.body.receiverMobile =
																							toBranch.mobile;
																						req.body.receiverEmail =
																							toBranch.email;
																						req.body.receiverIdentificationCountry =
																							"";
																						req.body.receiverIdentificationType =
																							"";
																						req.body.receiverIdentificationNumber =
																							"";
																						req.body.receiverIdentificationValidTill =
																							"";

																						var otherInfo = {
																							cashierId: cashier._id,
																							transactionCode: "",
																							ruleType:
																								"Non Wallet to Operational",
																							masterCode: master_code,
																							branchId: branch._id,
																							branchType: "partnerbranch",
																							isInterBank: 1,
																							interBankRuleType: "IBNWO",
																							bankId: bank._id,
																						};

																						addCashierSendRecord(
																							req.body,
																							otherInfo,
																							(err9, cs) => {
																								if (err9) {
																									res
																										.status(200)
																										.json(catchError(err9));
																								} else {
																									const transfer = {
																										amount: amount,
																										isInclusive: is_inclusive,
																										master_code: master_code,
																										senderType: "sendPartner",
																										senderCode: partner.code,
																										cashierId: cashier._id,
																									};
																									cashierToOperational(
																										transfer,
																										infra,
																										bank,
																										toBank,
																										branch,
																										toBranch,
																										rule1,
																										rule2
																									)
																										.then((result) => {
																											if (result.status == 1) {
																												otherInfo.csId = cs._id;
																												otherInfo.amount =
																													result.amount;
																												otherInfo.fee =
																													result.fee;
																												otherInfo.sendFee =
																													result.sendFee;

																												updateCashierRecords(
																													"partnercashier",
																													otherInfo,
																													(err10) => {
																														if (err10) {
																															res
																																.status(200)
																																.json(
																																	catchError(
																																		err10
																																	)
																																);
																														} else {
																															txstate.completed(
																																categoryConst.MAIN,
																																master_code
																															);
																															res
																																.status(200)
																																.json({
																																	status: 1,
																																	message:
																																		result.amount +
																																		"XOF amount is Transferred",
																																});
																														}
																													}
																												);
																											} else {
																												res
																													.status(200)
																													.json(result);
																											}
																										})
																										.catch((err11) => {
																											console.log(err11);
																											res.status(200).json({
																												status: 0,
																												message: err11.message,
																											});
																										});
																								}
																							}
																						);
																					}
																				});
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
									});
								}
							});
						}
					});
				}
			});
		}
	});
};
