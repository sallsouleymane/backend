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
				cashier._id
			);
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
											let errMsg = errorMessage(err, infra, "Infra Not Found");
											if (errMsg.status == 0) {
												res.status(200).json(errMsg);
											} else {
												const find = {
													bank_id: bank._id,
													type: "IBNWNW",
													status: 1,
													active: 1,
												};
												InterBankRule.findOne(find, function (err, rule1) {
													let errMsg = errorMessage(
														err,
														rule1,
														"Inter bank fee Rule Not Found"
													);
													if (errMsg.status == 0) {
														res.status(200).json(errMsg);
													} else {
														const find = {
															bank_id: bank._id,
															trans_type: "Non Wallet to Non Wallet",
															status: 1,
															active: "Active",
														};
														Fee.findOne(find, function (err, rule2) {
															let errMsg = errorMessage(
																err,
																rule2,
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
																	isInterBank: 1,
																	interBankRuleType: "IBNWNW",
																	bankId: bank._id,
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
																							(err) => {
																								if (err) {
																									res
																										.status(200)
																										.json(catchError(err));
																								} else {
																									txstate.waitingForCompletion(
																										categoryConst.MAIN,
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
																						txstate.failed(
																							categoryConst.MAIN,
																							master_code
																						);
																						res.status(200).json(result);
																					}
																				})
																				.catch((err) => {
																					txstate.failed(
																						categoryConst.MAIN,
																						master_code
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
				""
			);
			PartnerBranch.findOne(
				{
					_id: cashier.branch_id,
				},
				function (err, branch) {
					let result = errorMessage(err, branch, "Branch Not Found");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						Partner.findOne({ _id: cashier.partner_id }, (err, partner) => {
							let result = errorMessage(err, partner, "Partner not found");
							if (result.status == 0) {
								res.status(200).json(result);
							} else {
								Bank.findOne(
									{
										_id: cashier.bank_id,
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
															type: "IBNWNW",
															status: 1,
															active: 1,
														};
														InterBankRule.findOne(find, function (err, rule1) {
															let result = errorMessage(
																err,
																rule1,
																"Inter Bank Rule Not Found"
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
																Fee.findOne(find, function (err, rule2) {
																	let result = errorMessage(
																		err,
																		rule2,
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
																			isInterBank: 1,
																			interBankRuleType: "IBNWNW",
																			bankId: bank._id,
																		};
																		addCashierSendRecord(
																			req.body,
																			otherInfo,
																			(err, cs) => {
																				if (err) {
																					res.status(200).json(catchError(err));
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
																									(err) => {
																										if (err) {
																											res
																												.status(200)
																												.json(catchError(err));
																										} else {
																											txstate.waitingForCompletion(
																												categoryConst.MAIN,
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
																								txstate.failed(
																									categoryConst.MAIN,
																									master_code
																								);
																								res.status(200).json(result);
																							}
																						})
																						.catch((err) => {
																							txstate.failed(
																								categoryConst.MAIN,
																								master_code
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
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	const {
		givenname,
		familyname,
		note,
		senderIdentificationCountry,
		senderIdentificationType,
		senderIdentificationNumber,
		senderIdentificationValidTill,
		address1,
		state,
		zip,
		ccode,
		country,
		email,
		mobile,
		requireOTP,
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
		async function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				// Initiate transaction
				const master_code = await txstate.initiate(
					cashier.bank_id,
					"Inter Bank Non Wallet To Wallet"
				);
				User.findOne(
					{
						mobile: receiverMobile,
					},
					function (err, receiver) {
						let result = errorMessage(err, receiver, "Receiver Not Found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							Bank.findOne({ _id: receiver.bank_id }, (err, receiverBank) => {
								let result = errorMessage(
									err,
									receiverBank,
									"Receiver Not Found"
								);
								if (result.status == 0) {
									res.status(200).json(result);
								} else {
									Branch.findOne(
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
																		let data = new CashierSend();
																		let temp = {
																			ccode: ccode,
																			mobile: mobile,
																			givenname: givenname,
																			familyname: familyname,
																			address1: address1,
																			state: state,
																			zip: zip,
																			country: country,
																			email: email,
																			note: note,
																		};
																		data.sender_info = temp;
																		temp = {
																			country: senderIdentificationCountry,
																			type: senderIdentificationType,
																			number: senderIdentificationNumber,
																			valid: senderIdentificationValidTill,
																		};
																		data.sender_id = temp;
																		temp = {
																			mobile: receiverMobile,
																		};
																		data.receiver_info = temp;
																		data.amount = receiverIdentificationAmount;
																		data.is_inclusive = isInclusive;
																		data.cashier_id = cashier._id;
																		data.rule_type = "Non Wallet to Wallet";
																		data.is_inter_bank = 1;
																		data.inter_bank_rule_type = "IBNWW";

																		//send transaction sms after actual transaction

																		if (requireOTP) {
																			data.require_otp = 1;
																			data.otp = makeotp(6);
																			content =
																				data.otp +
																				" - Send this OTP to the Receiver";
																			if (mobile && mobile != null) {
																				sendSMS(content, mobile);
																			}
																			if (email && email != null) {
																				sendMail(
																					content,
																					"Transaction OTP",
																					email
																				);
																			}
																		}

																		data.save((err, cs) => {
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
																				var find = {
																					bank_id: bank._id,
																					type: "IBNWW",
																					status: 1,
																					active: 1,
																				};
																				InterBankRule.findOne(
																					find,
																					function (err, rule1) {
																						let result = errorMessage(
																							err,
																							rule1,
																							"Inter Bank Revenue Rule Not Found"
																						);
																						if (result.status == 0) {
																							res.status(200).json(result);
																						} else {
																							find = {
																								bank_id: bank._id,
																								trans_type:
																									"Non Wallet to Wallet",
																								status: 1,
																								active: "Active",
																							};
																							const amount = receiverIdentificationAmount;
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
																										//End
																										var transfer = {
																											master_code: master_code,
																											amount: amount,
																											isInclusive: isInclusive,
																											cashierId: cashier._id,
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
																													CashierSend.findByIdAndUpdate(
																														cs._id,
																														{
																															status: 1,
																															fee: result.fee,
																															master_code:
																																result.master_code,
																														},
																														async (err) => {
																															if (err) {
																																console.log(
																																	err
																																);
																																var message = err;
																																if (
																																	err.message
																																) {
																																	message =
																																		err.message;
																																}
																																res
																																	.status(200)
																																	.json({
																																		status: 0,
																																		message: message,
																																	});
																															} else {
																																Cashier.findByIdAndUpdate(
																																	cashier._id,
																																	{
																																		cash_received:
																																			Number(
																																				cashier.cash_received
																																			) +
																																			Number(
																																				result.amount
																																			) +
																																			Number(
																																				result.fee
																																			),
																																		cash_in_hand:
																																			Number(
																																				cashier.cash_in_hand
																																			) +
																																			Number(
																																				result.amount
																																			) +
																																			Number(
																																				result.fee
																																			),
																																		fee_generated:
																																			Number(
																																				result.sendFee
																																			) +
																																			Number(
																																				cashier.fee_generated
																																			),

																																		total_trans:
																																			Number(
																																				cashier.total_trans
																																			) + 1,
																																	},
																																	function (
																																		e,
																																		v
																																	) {}
																																);

																																CashierLedger.findOne(
																																	{
																																		cashier_id:
																																			cashier._id,
																																		trans_type:
																																			"CR",
																																		created_at: {
																																			$gte: new Date(
																																				start
																																			),
																																			$lte: new Date(
																																				end
																																			),
																																		},
																																	},
																																	function (
																																		err,
																																		c
																																	) {
																																		if (
																																			err ||
																																			c == null
																																		) {
																																			let data = new CashierLedger();
																																			data.amount =
																																				Number(
																																					result.amount
																																				) +
																																				Number(
																																					result.fee
																																				);
																																			data.trans_type =
																																				"CR";
																																			data.transaction_details = JSON.stringify(
																																				{
																																					fee:
																																						result.fee,
																																				}
																																			);
																																			data.cashier_id =
																																				cashier._id;
																																			data.save(
																																				function (
																																					err,
																																					c
																																				) {}
																																			);
																																		} else {
																																			var amt =
																																				Number(
																																					c.amount
																																				) +
																																				Number(
																																					result.amount
																																				) +
																																				Number(
																																					result.fee
																																				);
																																			CashierLedger.findByIdAndUpdate(
																																				c._id,
																																				{
																																					amount: amt,
																																				},
																																				function (
																																					err,
																																					c
																																				) {}
																																			);
																																		}
																																	}
																																);
																																await txstate.completed(
																																	master_code
																																);
																																res
																																	.status(200)
																																	.json({
																																		status: 1,
																																		message:
																																			receiverIdentificationAmount +
																																			"XOF amount is Transferred",
																																	});
																															}
																														}
																													);
																												} else {
																													res.status(200).json({
																														status: 0,
																														message: result.toString(),
																													});
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
											} //infra
										}
									);
								}
							});
						}
					}
				);
			}
		}
	); //branch
};

module.exports.partnerSendMoneyToWallet = function (req, res) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";

	const jwtusername = req.sign_creds.username;
	const {
		givenname,
		familyname,
		note,
		senderIdentificationCountry,
		senderIdentificationType,
		senderIdentificationNumber,
		senderIdentificationValidTill,
		address1,
		state,
		zip,
		ccode,
		country,
		email,
		mobile,
		requireOTP,
		receiverMobile,
		receiverIdentificationAmount,
		isInclusive,
	} = req.body;

	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				// Initiate transaction
				const master_code = await txstate.initiate(
					cashier.bank_id,
					"Inter Bank Non Wallet To Wallet"
				);
				Partner.findOne({ _id: cashier.partner_id }, (err, partner) => {
					let result = errorMessage(err, partner, "Partner not found");
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
									Bank.findOne(
										{ _id: receiver.bank_id },
										(err, receiverBank) => {
											let result = errorMessage(
												err,
												receiverBank,
												"Receiver Bank Not Found"
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
																					let data = new CashierSend();
																					let temp = {
																						ccode: ccode,
																						mobile: mobile,
																						givenname: givenname,
																						familyname: familyname,
																						address1: address1,
																						state: state,
																						zip: zip,
																						country: country,
																						email: email,
																						note: note,
																					};
																					data.sender_info = temp;

																					temp = {
																						country: senderIdentificationCountry,
																						type: senderIdentificationType,
																						number: senderIdentificationNumber,
																						valid: senderIdentificationValidTill,
																					};
																					data.sender_id = temp;

																					temp = {
																						mobile: receiverMobile,
																					};
																					data.receiver_info = temp;

																					data.amount = receiverIdentificationAmount;
																					data.is_inclusive = isInclusive;
																					data.cashier_id = cashier._id;
																					data.rule_type =
																						"Non Wallet to Wallet";
																					data.is_inter_bank = 1;
																					data.inter_bank_rule_type = "IBNWW";

																					//send transaction sms after actual transaction

																					if (requireOTP) {
																						data.require_otp = 1;
																						data.otp = makeotp(6);
																						content =
																							data.otp +
																							" - Send this OTP to the Receiver";
																						if (mobile && mobile != null) {
																							sendSMS(content, mobile);
																						}
																						if (email && email != null) {
																							sendMail(
																								content,
																								"Transaction OTP",
																								email
																							);
																						}
																					}

																					data.save((err, cs) => {
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
																							var find = {
																								bank_id: bank._id,
																								type: "IBNWW",
																								status: 1,
																								active: 1,
																							};
																							InterBankRule.findOne(
																								find,
																								function (err, rule1) {
																									let result = errorMessage(
																										err,
																										rule1,
																										"Inter Bank Revenue Rule Not Found"
																									);
																									if (result.status == 0) {
																										res
																											.status(200)
																											.json(result);
																									} else {
																										find = {
																											bank_id: bank._id,
																											trans_type:
																												"Non Wallet to Wallet",
																											status: 1,
																											active: "Active",
																										};
																										const amount = receiverIdentificationAmount;
																										Fee.findOne(
																											find,
																											function (err, rule2) {
																												if (err) {
																													console.log(err);
																													var message = err;
																													if (err.message) {
																														message =
																															err.message;
																													}
																													res.status(200).json({
																														status: 0,
																														message: message,
																													});
																												} else if (
																													rule2 == null
																												) {
																													res.status(200).json({
																														status: 0,
																														message:
																															"Revenue Rule Not Found",
																													});
																												} else {
																													//End
																													var transfer = {
																														master_code: master_code,
																														amount: amount,
																														isInclusive: isInclusive,
																														cashierId:
																															cashier._id,
																														partnerCode:
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
																																result.status ==
																																1
																															) {
																																CashierSend.findByIdAndUpdate(
																																	cs._id,
																																	{
																																		status: 1,
																																		fee:
																																			result.fee,
																																		master_code:
																																			result.master_code,
																																	},
																																	async (
																																		err
																																	) => {
																																		if (err) {
																																			console.log(
																																				err
																																			);
																																			var message = err;
																																			if (
																																				err.message
																																			) {
																																				message =
																																					err.message;
																																			}
																																			res
																																				.status(
																																					200
																																				)
																																				.json({
																																					status: 0,
																																					message: message,
																																				});
																																		} else {
																																			PartnerCashier.findByIdAndUpdate(
																																				cashier._id,
																																				{
																																					cash_received:
																																						Number(
																																							cashier.cash_received
																																						) +
																																						Number(
																																							result.amount
																																						) +
																																						Number(
																																							result.fee
																																						),
																																					cash_in_hand:
																																						Number(
																																							cashier.cash_in_hand
																																						) +
																																						Number(
																																							result.amount
																																						) +
																																						Number(
																																							result.fee
																																						),
																																					fee_generated:
																																						Number(
																																							result.sendFee
																																						) +
																																						Number(
																																							cashier.fee_generated
																																						),

																																					total_trans:
																																						Number(
																																							cashier.total_trans
																																						) +
																																						1,
																																				},
																																				function (
																																					e,
																																					v
																																				) {}
																																			);

																																			CashierLedger.findOne(
																																				{
																																					cashier_id:
																																						cashier._id,
																																					trans_type:
																																						"CR",
																																					created_at: {
																																						$gte: new Date(
																																							start
																																						),
																																						$lte: new Date(
																																							end
																																						),
																																					},
																																				},
																																				function (
																																					err,
																																					c
																																				) {
																																					if (
																																						err ||
																																						c ==
																																							null
																																					) {
																																						let data = new CashierLedger();
																																						data.amount =
																																							Number(
																																								result.amount
																																							) +
																																							Number(
																																								result.fee
																																							);
																																						data.trans_type =
																																							"CR";
																																						data.transaction_details = JSON.stringify(
																																							{
																																								fee:
																																									result.fee,
																																							}
																																						);
																																						data.cashier_id =
																																							cashier._id;
																																						data.save(
																																							function (
																																								err,
																																								c
																																							) {}
																																						);
																																					} else {
																																						var amt =
																																							Number(
																																								c.amount
																																							) +
																																							Number(
																																								result.amount
																																							) +
																																							Number(
																																								result.fee
																																							);
																																						CashierLedger.findByIdAndUpdate(
																																							c._id,
																																							{
																																								amount: amt,
																																							},
																																							function (
																																								err,
																																								c
																																							) {}
																																						);
																																					}
																																				}
																																			);
																																			await txstate.completed(
																																				master_code
																																			);
																																			res
																																				.status(
																																					200
																																				)
																																				.json({
																																					status: 1,
																																					message:
																																						receiverIdentificationAmount +
																																						"XOF amount is Transferred",
																																				});
																																		}
																																	}
																																);
																															} else {
																																res
																																	.status(200)
																																	.json({
																																		status: 0,
																																		message: result.toString(),
																																	});
																															}
																														})
																														.catch((err) => {
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
																					});
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
	jwtAuthentication("cashier", req, async function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			// Initiate transaction state
			const master_code = await txstate.initiate(
				categoryConst.MAIN,
				cashier.bank_id,
				"Inter Bank Non Wallet to Operational",
				cashier._id,
				""
			);
			Branch.findOne({ _id: cashier.branch_id }, (err, branch) => {
				let result = errorMessage(err, branch, "Branch not found");
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					Bank.findOne({ _id: branch.bank_id }, (err, bank) => {
						let result = errorMessage(err, bank, "Bank not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							Infra.findOne({ _id: bank.user_id }, (err, infra) => {
								let result = errorMessage(err, infra, "Infra not found");
								if (result.status == 0) {
									res.status(200).json(result);
								} else {
									const find = {
										bank_id: branch.bank_id,
										trans_type: "Non Wallet to Operational",
										status: 1,
										active: "Active",
									};
									const Collection = getTypeClass(code);
									Collection.findOne(
										{
											_id: { $ne: branch._id },
											"wallet_ids.operational": wallet_id,
										},
										(err, toBranch) => {
											let result = errorMessage(
												err,
												toBranch,
												"Invalid wallet ID"
											);
											if (result.status == 0) {
												res.status(200).json(result);
											} else {
												Bank.findOne(
													{ _id: toBranch.bank_id },
													(err, toBank) => {
														let result = errorMessage(
															err,
															toBank,
															"To Branch's bank not found"
														);
														if (result.status == 0) {
															res.status(200).json(result);
														} else {
															var find = {
																bank_id: bank._id,
																type: "IBNWO",
																status: 1,
																active: 1,
															};
															InterBankRule.findOne(
																find,
																function (err, rule1) {
																	let result = errorMessage(
																		err,
																		rule1,
																		"Inter Bank Revenue Rule Not Found"
																	);
																	if (result.status == 0) {
																		res.status(200).json(result);
																	} else {
																		Fee.findOne(find, (err, rule2) => {
																			let errMsg = errorMessage(
																				err,
																				rule2,
																				"Rule not found"
																			);
																			if (errMsg.status == 0) {
																				res.status(200).json(errMsg);
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
																					(err, cs) => {
																						if (err) {
																							res
																								.status(200)
																								.json(catchError(err));
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
																								.catch((err) => {
																									txstate.failed(
																										categoryConst.MAIN,
																										master_code
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
			Partner.findOne({ _id: cashier.partner_id }, (err, partner) => {
				let result = errorMessage(err, partner, "Partner Not Found");
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					PartnerBranch.findOne({ _id: cashier.branch_id }, (err, branch) => {
						let result = errorMessage(err, branch, "Branch not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							Bank.findOne({ _id: branch.bank_id }, (err, bank) => {
								let result = errorMessage(err, bank, "Bank not found");
								if (result.status == 0) {
									res.status(200).json(result);
								} else {
									Infra.findOne({ _id: bank.user_id }, (err, infra) => {
										let result = errorMessage(err, infra, "Infra not found");
										if (result.status == 0) {
											res.status(200).json(result);
										} else {
											const Collection = getTypeClass(code);
											Collection.findOne(
												{
													_id: { $ne: branch._id },
													"wallet_ids.operational": wallet_id,
												},
												(err, toBranch) => {
													let result = errorMessage(
														err,
														toBranch,
														"Invalid wallet ID"
													);
													if (result.status == 0) {
														res.status(200).json(result);
													} else {
														Bank.findOne(
															{ _id: toBranch.bank_id },
															(err, toBank) => {
																let result = errorMessage(
																	err,
																	toBank,
																	"To Branch's bank not found"
																);
																if (result.status == 0) {
																	res.status(200).json(result);
																} else {
																	var find = {
																		bank_id: bank._id,
																		type: "IBNWO",
																		status: 1,
																		active: 1,
																	};
																	InterBankRule.findOne(
																		find,
																		function (err, rule1) {
																			let result = errorMessage(
																				err,
																				rule1,
																				"Inter Bank Revenue Rule Not Found"
																			);
																			if (result.status == 0) {
																				res.status(200).json(result);
																			} else {
																				const find = {
																					bank_id: bank._id,
																					trans_type:
																						"Non Wallet to Operational",
																					status: 1,
																					active: "Active",
																				};
																				Fee.findOne(find, (err, rule2) => {
																					let result = errorMessage(
																						err,
																						rule,
																						"Rule not found"
																					);
																					if (result.status == 0) {
																						res.status(200).json(result);
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
																							(err, cs) => {
																								if (err) {
																									res
																										.status(200)
																										.json(catchError(err));
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
