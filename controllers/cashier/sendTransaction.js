//utils
const makeid = require("../../routes/utils/idGenerator");
const sendSMS = require("../../routes/utils/sendSMS");
const sendMail = require("../../routes/utils/sendMail");
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const { jwtAuthentication } = require("./utils");

const addCashierSendRecord = require("../utils/addSendRecord");
const updateCashierRecords = require("../utils/updateSendRecord");

const Infra = require("../../models/Infra");
const Fee = require("../../models/Fee");
const User = require("../../models/User");
const Bank = require("../../models/Bank");
const Branch = require("../../models/Branch");
const Cashier = require("../../models/Cashier");
const Partner = require("../../models/partner/Partner");
const PartnerBranch = require("../../models/partner/Branch");
const PartnerCashier = require("../../models/partner/Cashier");

// transactions
const txstate = require("../transactions/services/states");
const cashierToOperational = require("../transactions/intraBank/cashierToOperational");
const cashierToCashier = require("../transactions/intraBank/cashierToCashier");
const cashierToWallet = require("../transactions/intraBank/cashierToWallet");

//constants
const categoryConst = require("../transactions/constants/category");

module.exports.cashierSendMoney = async function (req, res, next) {
	try {
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
				// Initiate transaction state
				const master_code = await txstate.initiate(
					categoryConst.MAIN,
					cashier.bank_id,
					"Non Wallet To Non Wallet",
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
								function (err2, bank) {
									let errMsg2 = errorMessage(err2, bank, "Bank Not Found");
									if (errMsg2.status == 0) {
										res.status(200).json(errMsg2);
									} else {
										Infra.findOne(
											{
												_id: bank.user_id,
											},
											function (err3, infra) {
												let result3 = errorMessage(
													err3,
													infra,
													"Infra Not Found"
												);
												if (result3.status == 0) {
													res.status(200).json(result3);
												} else {
													const find = {
														bank_id: bank._id,
														trans_type: "Non Wallet to Non Wallet",
														status: 1,
														active: "Active",
													};
													Fee.findOne(find, function (err4, rule) {
														let errMsg4 = errorMessage(
															err4,
															rule,
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
																			master_code: master_code,
																			senderType: "sendBranch",
																			senderCode: branch.bcode,
																			cashierId: cashier._id,
																		};
																		cashierToCashier(
																			transfer,
																			infra,
																			bank,
																			branch,
																			rule
																		)
																			.then(function (result) {
																				console.log("Result: " + result);
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
																				res.status(200).json(catchError(err7));
																			});
																	}
																}
															);
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
	} catch (err8) {
		res.status(200).json(catchError(err8));
	}
};

module.exports.partnerSendMoney = async function (req, res) {
	try {
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
				// Initiate transaction state
				const master_code = await txstate.initiate(
					categoryConst.MAIN,
					cashier.bank_id,
					"Non Wallet To Non Wallet",
					cashier._id,
					cashier.cash_in_hand,
					req.body,
				);
				Partner.findOne({ _id: cashier.partner_id }, (err1, partner) => {
					let result1 = errorMessage(err1, partner, "Partner not found");
					if (result1.status == 0) {
						res.status(200).json(result1);
					} else {
						PartnerBranch.findOne(
							{
								_id: cashier.branch_id,
							},
							function (err2, branch) {
								let result2 = errorMessage(err2, branch, "Branch Not Found");
								if (result2.status == 0) {
									res.status(200).json(result2);
								} else {
									Bank.findOne(
										{
											_id: partner.bank_id,
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
														let result4 = errorMessage(
															err4,
															infra,
															"Infra Not Found"
														);
														if (result4.status == 0) {
															res.status(200).json(result4);
														} else {
															const find = {
																bank_id: bank._id,
																trans_type: "Non Wallet to Non Wallet",
																status: 1,
																active: "Active",
															};
															Fee.findOne(find, function (err5, rule) {
																let result5 = errorMessage(
																	err5,
																	rule,
																	"Revenue Rule Not Found"
																);
																if (result5.status == 0) {
																	res.status(200).json(result5);
																} else {
																	var otherInfo = {
																		cashierId: cashier._id,
																		transactionCode: transactionCode,
																		ruleType: "Non Wallet to Non Wallet",
																		masterCode: master_code,
																		branchId: branch._id,
																		branchType: "partnerbranch",
																	};
																	addCashierSendRecord(
																		req.body,
																		otherInfo,
																		(err6, cs) => {
																			if (err6) {
																				res.status(200).json(catchError(err6));
																			} else {
																				const transfer = {
																					amount: receiverIdentificationAmount,
																					isInclusive: isInclusive,
																					senderType: "sendPartner",
																					senderCode: partner.code,
																					master_code: master_code,
																					cashierId: cashier._id,
																				};
																				cashierToCashier(
																					transfer,
																					infra,
																					bank,
																					branch,
																					rule
																				)
																					.then(function (result) {
																						console.log("Result: " + result);
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
																							otherInfo.amount = result.amount;
																							otherInfo.fee = result.fee;
																							otherInfo.sendFee =
																								result.sendFee;

																							updateCashierRecords(
																								"partnercashier",
																								otherInfo,
																								(err7) => {
																									if (err7) {
																										res
																											.status(200)
																											.json(catchError(err7));
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
																					.catch((err8) => {
																						txstate.failed(
																							categoryConst.MAIN,
																							master_code
																						);
																						res.status.json(catchError(err8));
																					});
																			}
																		}
																	);
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
			}
		});
	} catch (err10) {
		res.status(200).json(catchError(err10));
	}
};

module.exports.cashierSendMoneyToWallet = async function (req, res) {
	try {
		const {
			receiverMobile,
			receiverIdentificationAmount,
			isInclusive,
		} = req.body;

		jwtAuthentication("cashier", req, async function (err, cashier) {
			if (err) {
				res.status(200).json(err);
			} else {
				// Initiate transaction state
				const master_code = await txstate.initiate(
					categoryConst.MAIN,
					cashier.bank_id,
					"Non Wallet to Wallet",
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
							Branch.findOne(
								{
									_id: cashier.branch_id,
								},
								function (err2, branch) {
									let result2 = errorMessage(err2, branch, "Branch Not Found");
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
															let result4 = errorMessage(
																err4,
																infra,
																"Infra Not Found"
															);
															if (result4.status == 0) {
																res.status(200).json(result4);
															} else {
																const find = {
																	bank_id: bank._id,
																	trans_type: "Non Wallet to Wallet",
																	status: 1,
																	active: "Active",
																};
																Fee.findOne(find, function (err5, rule) {
																	let result5 = errorMessage(
																		err5,
																		rule,
																		"Revenue Rule Not Found"
																	);
																	if (result5.status == 0) {
																		res.status(200).json(result5);
																	} else {
																		req.body.withoutID = false;
																		req.body.receiverccode = "";
																		req.body.receiverGivenName = receiver.name;
																		req.body.receiverFamilyName =
																			receiver.last_name;
																		req.body.receiverCountry = receiver.country;
																		req.body.receiverEmail = receiver.email;
																		req.body.receiverIdentificationCountry = "";
																		req.body.receiverIdentificationType =
																			receiver.id_type;
																		req.body.receiverIdentificationNumber =
																			receiver.id_number;
																		req.body.receiverIdentificationValidTill =
																			receiver.valid_till;

																		var otherInfo = {
																			cashierId: cashier._id,
																			transactionCode: "",
																			ruleType: "Non Wallet to Wallet",
																			masterCode: master_code,
																		};
																		addCashierSendRecord(
																			req.body,
																			otherInfo,
																			(err6, cs) => {
																				if (err6) {
																					res.status(200).json(catchError(err6));
																				} else {
																					const transfer = {
																						amount: receiverIdentificationAmount,
																						isInclusive: isInclusive,
																						master_code: master_code,
																						senderType: "sendBranch",
																						senderCode: branch.bcode,
																						cashierId: cashier._id,
																					};
																					cashierToWallet(
																						transfer,
																						infra,
																						bank,
																						branch,
																						receiver,
																						rule
																					)
																						.then(function (result) {
																							console.log("Result: " + result);
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
																									(err7) => {
																										if (err7) {
																											res
																												.status(200)
																												.json(catchError(err7));
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
																						.catch((err8) => {
																							console.log(err8);
																							txstate.failed(
																								categoryConst.MAIN,
																								master_code
																							);
																							res.status(200).json({
																								status: 0,
																								message: err8.message,
																							});
																						});
																				}
																			}
																		);
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
					}
				);
			}
		});
	} catch (err9) {
		res.status(200).json(catchError(err9));
	}
};

module.exports.partnerSendMoneyToWallet = async function (req, res) {
	const {
		receiverMobile,
		receiverIdentificationAmount,
		isInclusive,
	} = req.body;

	jwtAuthentication("partnerCashier", req, async function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			// Initiate transaction state
			const master_code = await txstate.initiate(
				categoryConst.MAIN,
				cashier.bank_id,
				"Non Wallet to Wallet",
				cashier._id,
				cashier.cash_in_hand,
				req.body,
			);
			Partner.findOne({ _id: cashier.partner_id }, (err1, partner) => {
				let result1 = errorMessage(err1, partner, "Partner Not Found");
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
								PartnerBranch.findOne(
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
													if (result4.status == 0) {
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
																	const find = {
																		bank_id: bank._id,
																		trans_type: "Non Wallet to Wallet",
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
																			req.body.withoutID = false;
																			req.body.receiverccode = "";
																			req.body.receiverGivenName =
																				receiver.name;
																			req.body.receiverFamilyName =
																				receiver.last_name;
																			req.body.receiverCountry =
																				receiver.country;
																			req.body.receiverEmail = receiver.email;
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
																				ruleType: "Non Wallet to Wallet",
																				masterCode: master_code,
																			};
																			addCashierSendRecord(
																				req.body,
																				otherInfo,
																				(err7, cs) => {
																					if (err7) {
																						res
																							.status(200)
																							.json(catchError(err7));
																					} else {
																						const transfer = {
																							amount: receiverIdentificationAmount,
																							isInclusive: isInclusive,
																							master_code: master_code,
																							senderType: "sendPartner",
																							senderCode: partner.code,
																							cashierId: cashier._id,
																						};
																						cashierToWallet(
																							transfer,
																							infra,
																							bank,
																							branch,
																							receiver,
																							rule
																						)
																							.then(function (result) {
																								console.log(
																									"Result: " + result
																								);
																								if (result.status == 1) {
																									otherInfo.csId = cs._id;
																									otherInfo.amount =
																										result.amount;
																									otherInfo.fee = result.fee;
																									otherInfo.sendFee =
																										result.sendFee;

																									updateCashierRecords(
																										"partnerCashier",
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
																								console.log(err9.toString());
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
						}
					);
				}
			});
		}
	});
};

module.exports.cashierSendToOperational = async function (req, res) {
	const { walletId, receiverIdentificationAmount, isInclusive } = req.body;
	jwtAuthentication("cashier", req, async function (err, cashier) {
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
			Branch.findOne({ _id: cashier.branch_id }, (err1, branch) => {
				let result1 = errorMessage(err1, branch, "Branch not found");
				if (result1.status == 0) {
					res1.status(200).json(result1);
				} else {
					PartnerBranch.findOne(
						{
							bank_id: branch.bank_id,
							"wallet_ids.operational": walletId,
						},
						(err2, toBranch) => {
							let errMsg2 = errorMessage(err2, toBranch, "Invalid wallet ID");
							if (errMsg2.status == 0) {
								res.status(200).json(errMsg2);
							} else {
								const find = {
									bank_id: branch.bank_id,
									trans_type: "Non Wallet to Operational",
									status: 1,
									active: "Active",
								};
								Fee.findOne(find, (err30, rule) => {
									let errMsg30 = errorMessage(err30, rule, "Rule not found");
									if (errMsg30.status == 0) {
										res.status(200).json(errMsg0);
									} else {
										Bank.findOne({ _id: branch.bank_id }, (err3, bank) => {
											let errMsg3 = errorMessage(err3, bank, "Bank not found");
											if (errMsg3.status == 0) {
												res.status(200).json(errMsg3);
											} else {
												Infra.findOne({ _id: bank.user_id }, (err4, infra) => {
													let errMsg4 = errorMessage(
														err4,
														infra,
														"Infra not found"
													);
													if (errMsg4.status == 0) {
														res.status(200).json(errMsg4);
													} else {
														req.body.withoutID = false;
														req.body.receiverccode = toBranch.ccode;
														req.body.receiverGivenName = toBranch.name;
														req.body.receiverFamilyName = "";
														req.body.receiverCountry = toBranch.country;
														req.body.receiverMobile = toBranch.mobile;
														req.body.receiverEmail = toBranch.email;
														req.body.receiverIdentificationCountry = "";
														req.body.receiverIdentificationType = "";
														req.body.receiverIdentificationNumber = "";
														req.body.receiverIdentificationValidTill = "";

														var otherInfo = {
															cashierId: cashier._id,
															transactionCode: "",
															ruleType: "Non Wallet to Operational",
															masterCode: master_code,
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
																		master_code: master_code,
																		senderType: "sendBranch",
																		senderCode: branch.bcode,
																		cashierId: cashier._id,
																	};
																	cashierToOperational(
																		transfer,
																		infra,
																		bank,
																		branch,
																		toBranch,
																		rule
																	)
																		.then((result) => {
																			if (result.status == 1) {
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
									}
								});
							}
						}
					);
				}
			});
		}
	});
};

module.exports.partnerSendToOperational = async function (req, res) {
	const { wallet_id, receiverIdentificationAmount, isInclusive } = req.body;
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
							PartnerBranch.findOne(
								{
									_id: { $ne: branch._id },
									bank_id: cashier.bank_id,
									"wallet_ids.operational": wallet_id,
								},
								(err3, toBranch) => {
									let result3 = errorMessage(err3, toBranch, "Invalid wallet ID");
									if (result3.status == 0) {
										res.status(200).json(result3);
									} else {
										const find = {
											bank_id: cashier.bank_id,
											trans_type: "Non Wallet to Operational",
											status: 1,
											active: "Active",
										};
										Fee.findOne(find, (err4, rule) => {
											let result4 = errorMessage(err4, rule, "Rule not found");
											if (result4.status == 0) {
												res.status(200).json(result4);
											} else {
												Bank.findOne({ _id: cashier.bank_id }, (err5, bank) => {
													let result5 = errorMessage(
														err,
														bank,
														"Bank not found"
													);
													if (result5.status == 0) {
														res.status(200).json(result5);
													} else {
														Infra.findOne(
															{ _id: bank.user_id },
															(err6, infra) => {
																let result6 = errorMessage(
																	err6,
																	infra,
																	"Infra not found"
																);
																if (result6.status == 0) {
																	res.status(200).json(result6);
																} else {
																	req.body.withoutID = false;
																	req.body.receiverccode = toBranch.ccode;
																	req.body.receiverGivenName = toBranch.name;
																	req.body.receiverFamilyName = "";
																	req.body.receiverCountry = toBranch.country;
																	req.body.receiverMobile = toBranch.mobile;
																	req.body.receiverEmail = toBranch.email;
																	req.body.receiverIdentificationCountry = "";
																	req.body.receiverIdentificationType = "";
																	req.body.receiverIdentificationNumber = "";
																	req.body.receiverIdentificationValidTill = "";

																	var otherInfo = {
																		cashierId: cashier._id,
																		transactionCode: "",
																		ruleType: "Non Wallet to Operational",
																		masterCode: master_code,
																	};
																	addCashierSendRecord(
																		req.body,
																		otherInfo,
																		(err7, cs) => {
																			if (err7) {
																				res.status(200).json(catchError(err7));
																			} else {
																				const transfer = {
																					amount: receiverIdentificationAmount,
																					isInclusive: isInclusive,
																					master_code: master_code,
																					senderType: "sendPartner",
																					senderCode: partner.code,
																					cashierId: cashier._id,
																				};
																				cashierToOperational(
																					transfer,
																					infra,
																					bank,
																					branch,
																					toBranch,
																					rule
																				)
																					.then((result) => {
																						if (result.status == 1) {
																							otherInfo.csId = cs._id;
																							otherInfo.amount = result.amount;
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
																							res.status(200).json(result);
																						}
																					})
																					.catch((err9) => {
																						console.log(err9);
																						res.status(200).json({
																							status: 0,
																							message: err.message,
																						});
																					});
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
						}
					});
				}
			});
		}
	});
};
