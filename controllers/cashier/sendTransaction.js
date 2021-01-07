//utils
const makeid = require("../../routes/utils/idGenerator");
const sendSMS = require("../../routes/utils/sendSMS");
const sendMail = require("../../routes/utils/sendMail");
const makeotp = require("../../routes/utils/makeotp");
const getTypeClass = require("../../routes/utils/getTypeClass");
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");

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
const txstate = require("../transactions/states");
// const cashierToOperational = require("../transactions/intraBank/cashierToOperational");
const cashierToCashier = require("../transactions/intraBank/cashierToCashier");
const cashierToWallet = require("../transactions/intraBank/cashierToWallet");

module.exports.cashierSendMoney = async function (req, res, next) {
	try {
		// Initiate transaction state
		const master_code = await txstate.initiate();

		const {
			receiverMobile,
			receiverEmail,
			receiverIdentificationAmount,
			isInclusive,
		} = req.body;

		const transactionCode = makeid(8);

		const jwtusername = req.sign_creds.username;
		Cashier.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err, cashier) {
				let errMsg = errorMessage(
					err,
					cashier,
					"Token changed or user not valid. Try to login again or contact system administrator."
				);
				if (errMsg.status == 0) {
					res.status(200).json(errMsg);
				} else {
					Branch.findOne(
						{
							_id: cashier.branch_id,
						},
						function (err, branch) {
							let errMsg = errorMessage(err, branch, "Branch Not Found");
							if (errMsg.status == 0) {
								res.status(200).json(errMsg);
							} else {
								Bank.findOne(
									{
										_id: cashier.bank_id,
									},
									function (err, bank) {
										let errMsg = errorMessage(err, bank, "Bank Not Found");
										if (errMsg.status == 0) {
											res.status(200).json(errMsg);
										} else {
											Infra.findOne(
												{
													_id: bank.user_id,
												},
												function (err, infra) {
													let result = errorMessage(
														err,
														infra,
														"Infra Not Found"
													);
													if (result.status == 0) {
														res.status(200).json(result);
													} else {
														const find = {
															bank_id: bank._id,
															trans_type: "Non Wallet to Non Wallet",
															status: 1,
															active: "Active",
														};
														Fee.findOne(find, function (err, rule) {
															let errMsg = errorMessage(
																err,
																rule,
																"Revenue Rule Not Found"
															);
															if (errMsg.status == 0) {
																res.status(200).json(errMsg);
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
																	(err, cs) => {
																		if (err) {
																			res.status(200).json(catchError(err));
																		} else {
																			const transfer = {
																				amount: receiverIdentificationAmount,
																				isInclusive: isInclusive,
																				master_code: master_code,
																				senderType: "sendBranch",
																				senderCode: branch.bcode,
																				isInterBank: 0,
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
																							(err) => {
																								if (err) {
																									res
																										.status(200)
																										.json(catchError(err));
																								} else {
																									txstate.waitingForCompletion(
																										master_code
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
																						res.status(200).json(result);
																					}
																				})
																				.catch((err) => {
																					let errMsg = catchError(err);
																					res.status(200).json(errMsg);
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
	} catch (err) {
		res.status(200).json(catchError(err));
	}
};

module.exports.partnerSendMoney = async function (req, res) {
	try {
		// Initiate transaction state
		const master_code = await txstate.initiate();

		const {
			receiverMobile,
			receiverEmail,
			receiverIdentificationAmount,
			isInclusive,
		} = req.body;

		const transactionCode = makeid(8);

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
							PartnerBranch.findOne(
								{
									_id: cashier.branch_id,
								},
								function (err, branch) {
									let result = errorMessage(err, branch, "Branch Not Found");
									if (result.status == 0) {
										res.status(200).json(result);
									} else {
										Bank.findOne(
											{
												_id: partner.bank_id,
											},
											function (err, bank) {
												let result = errorMessage(err, bank, "Bank Not Found");
												if (result.status == 0) {
													res.status(200).json(result);
												} else {
													Infra.findOne(
														{
															_id: bank.user_id,
														},
														function (err, infra) {
															let result = errorMessage(
																err,
																infra,
																"Infra Not Found"
															);
															if (result.status == 0) {
																res.status(200).json(result);
															} else {
																const find = {
																	bank_id: bank._id,
																	trans_type: "Non Wallet to Non Wallet",
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
																			transactionCode: transactionCode,
																			ruleType: "Non Wallet to Non Wallet",
																			masterCode: master_code,
																			branchId: branch._id,
																			branchType: "partnerbranch",
																		};
																		addCashierSendRecord(
																			req.body,
																			otherInfo,
																			(err, cs) => {
																				if (err) {
																					res.status(200).json(catchError(err));
																				} else {
																					const transfer = {
																						amount: receiverIdentificationAmount,
																						isInclusive: isInclusive,
																						senderType: "sendPartner",
																						senderCode: partner.code,
																						master_code: master_code,
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
																								otherInfo.amount =
																									result.amount;
																								otherInfo.fee = result.fee;
																								otherInfo.sendFee =
																									result.sendFee;

																								updateCashierRecords(
																									"partnercashier",
																									otherInfo,
																									(err) => {
																										if (err) {
																											res
																												.status(200)
																												.json(catchError(err));
																										} else {
																											txstate.waitingForCompletion(
																												master_code
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
																								res.status(200).json(result);
																							}
																						})
																						.catch((err) => {
																							res.status.json(catchError(err));
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
			}
		);
	} catch (err) {
		res.status(200).json(catchError(err));
	}
};

module.exports.cashierSendMoneyToWallet = async function (req, res) {
	try {
		// Initiate transaction state
		const master_code = await txstate.initiate();
		const {
			receiverMobile,
			receiverIdentificationAmount,
			isInclusive,
		} = req.body;

		const jwtusername = req.sign_creds.username;
		Cashier.findOne(
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
					User.findOne(
						{
							mobile: receiverMobile,
						},
						function (err, receiver) {
							let result = errorMessage(err, receiver, "Receiver Not Found");
							if (result.status == 0) {
								res.status(200).json(result);
							} else {
								Branch.findOne(
									{
										_id: cashier.branch_id,
									},
									function (err, branch) {
										let result = errorMessage(err, branch, "Branch Not Found");
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
														Infra.findOne(
															{
																_id: bank.user_id,
															},
															function (err, infra) {
																let result = errorMessage(
																	err,
																	infra,
																	"Infra Not Found"
																);
																if (result.status == 0) {
																	res.status(200).json(result);
																} else {
																	const find = {
																		bank_id: bank._id,
																		trans_type: "Non Wallet to Wallet",
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
																				branchId: branch._id,
																				branchType: "branch",
																			};
																			addCashierSendRecord(
																				req.body,
																				otherInfo,
																				(err, cs) => {
																					if (err) {
																						res
																							.status(200)
																							.json(catchError(err));
																					} else {
																						const transfer = {
																							amount: receiverIdentificationAmount,
																							isInclusive: isInclusive,
																							master_code: master_code,
																							senderType: "sendBranch",
																							senderCode: branch.bcode,
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
																										"cashier",
																										otherInfo,
																										(err) => {
																											if (err) {
																												res
																													.status(200)
																													.json(
																														catchError(err)
																													);
																											} else {
																												txstate.reported(
																													master_code
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
																									res.status(200).json(result);
																								}
																							})
																							.catch((err) => {
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
			}
		);
	} catch (err) {
		res.status(200).json(catchError(err));
	}
};

module.exports.partnerSendMoneyToWallet = async function (req, res) {
	const {
		receiverMobile,
		receiverIdentificationAmount,
		isInclusive,
	} = req.body;
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
					let result = errorMessage(err, partner, "Partner Not Found");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						User.findOne(
							{
								mobile: receiverMobile,
							},
							function (err, receiver) {
								let result = errorMessage(err, receiver, "Receiver Not Found");
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
															Infra.findOne(
																{
																	_id: bank.user_id,
																},
																function (err, infra) {
																	let result = errorMessage(
																		err,
																		infra,
																		"Infra Not Found"
																	);
																	if (result.status == 0) {
																		res.status(200).json(result);
																	} else {
																		const find = {
																			bank_id: bank._id,
																			trans_type: "Non Wallet to Wallet",
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
																					branchId: branch._id,
																					branchType: "partnerbranch",
																				};
																				addCashierSendRecord(
																					req.body,
																					otherInfo,
																					(err, cs) => {
																						if (err) {
																							res
																								.status(200)
																								.json(catchError(err));
																						} else {
																							const transfer = {
																								amount: receiverIdentificationAmount,
																								isInclusive: isInclusive,
																								master_code: master_code,
																								senderType: "sendPartner",
																								senderCode: partner.code,
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
																											(err) => {
																												if (err) {
																													res
																														.status(200)
																														.json(
																															catchError(err)
																														);
																												} else {
																													txstate.reported(
																														master_code
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
																										res
																											.status(200)
																											.json(result);
																									}
																								})
																								.catch((err) => {
																									console.log(err.toString());
																									res.status(200).json({
																										status: 0,
																										message: err.message,
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
		}
	);
};
