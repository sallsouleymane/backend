//utils
const makeid = require("../../routes/utils/idGenerator");
const sendSMS = require("../../routes/utils/sendSMS");
const sendMail = require("../../routes/utils/sendMail");
const makeotp = require("../../routes/utils/makeotp");
const getTypeClass = require("../../routes/utils/getTypeClass");
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");

const Infra = require("../../models/Infra");
const Fee = require("../../models/Fee");
const User = require("../../models/User");
const Bank = require("../../models/Bank");
const OTP = require("../../models/OTP");
const Branch = require("../../models/Branch");
const BankUser = require("../../models/BankUser");
const Cashier = require("../../models/Cashier");
const CashierSend = require("../../models/CashierSend");
const CashierPending = require("../../models/CashierPending");
const CashierClaim = require("../../models/CashierClaim");
const CashierLedger = require("../../models/CashierLedger");
const CashierTransfer = require("../../models/CashierTransfer");
const Merchant = require("../../models/merchant/Merchant");
const MerchantSettings = require("../../models/merchant/MerchantSettings");

// transactions
const txstate = require("../transactions/states");
// const cashierToOperational = require("../transactions/intraBank/cashierToOperational");
const cashierToCashier = require("../transactions/intraBank/cashierToCashier");
// const cashierToWallet = require("../transactions/intraBank/cashierToWallet");
const cashierClaimMoney = require("../transactions/intraBank/cashierClaimMoney");
// const partnerCashierClaimMoney = require("../../routes/transactions/intraBank/partnerCashierClaimMoney");

function addCashierSendRecord(reqData, otherData, next) {
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
		withoutID,
		requireOTP,
		receiverMobile,
		receiverccode,
		receiverGivenName,
		receiverFamilyName,
		receiverCountry,
		receiverEmail,
		receiverIdentificationCountry,
		receiverIdentificationType,
		receiverIdentificationNumber,
		receiverIdentificationValidTill,
		receiverIdentificationAmount,
		isInclusive,
	} = reqData;

	const {
		cashierId,
		branchId,
		transactionCode,
		ruleType,
		masterCode,
	} = otherData;

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
	data.sender_info = JSON.stringify(temp);
	temp = {
		country: senderIdentificationCountry,
		type: senderIdentificationType,
		number: senderIdentificationNumber,
		valid: senderIdentificationValidTill,
	};
	data.sender_id = JSON.stringify(temp);
	temp = {
		mobile: receiverMobile,
		ccode: receiverccode,
		givenname: receiverGivenName,
		familyname: receiverFamilyName,
		country: receiverCountry,
		email: receiverEmail,
	};
	data.receiver_info = JSON.stringify(temp);
	temp = {
		country: receiverIdentificationCountry,
		type: receiverIdentificationType,
		number: receiverIdentificationNumber,
		valid: receiverIdentificationValidTill,
	};
	data.receiver_id = JSON.stringify(temp);
	data.amount = receiverIdentificationAmount;
	data.is_inclusive = isInclusive;
	data.cashier_id = cashierId;
	data.send_branch_id = branchId;
	data.transaction_code = transactionCode;
	data.rule_type = ruleType;
	data.master_code = masterCode;

	//send transaction sms after actual transaction

	data.without_id = withoutID ? 1 : 0;
	if (requireOTP) {
		data.require_otp = 1;
		data.otp = makeotp(6);
		content = data.otp + " - Send this OTP to the Receiver";
		if (mobile && mobile != null) {
			sendSMS(content, mobile);
		}
		if (email && email != null) {
			sendMail(content, "Transaction OTP", email);
		}
	}

	data.save((err, d) => {
		return next(err, d);
	});
}

function updateCashierRecords(model, data, next) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";

	const { cashierId, csId, amount, fee, sendFee } = data;
	const Model = getTypeClass(model);

	let totalAmount = Number(amount) + Number(fee);

	CashierSend.findByIdAndUpdate(
		csId,
		{
			status: 1,
			fee: fee,
		},
		(err) => {
			if (err) {
				next(err);
			} else {
				Model.findByIdAndUpdate(
					cashierId,
					{
						$inc: {
							cash_received: totalAmount,
							cash_in_hand: totalAmount,
							fee_generated: Number(sendFee),
							total_trans: 1,
						},
					},
					function (err) {
						if (err) {
							next(err);
						} else {
							CashierLedger.findOneAndUpdate(
								{
									cashier_id: cashierId,
									trans_type: "CR",
									created_at: {
										$gte: new Date(start),
										$lte: new Date(end),
									},
								},
								{ $inc: { amount: totalAmount } },
								function (err, c) {
									if (err) {
										next(err);
									} else if (c == null) {
										let data = new CashierLedger();
										data.amount = totalAmount;
										data.trans_type = "CR";
										data.transaction_details = JSON.stringify({
											fee: fee,
										});
										data.cashier_id = cashierId;
										data.save(function (err) {
											next(null);
										});
									} else {
										next(null);
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

function addClaimRecord(reqData, otherData, next) {
	const {
		transferCode,
		proof,
		givenname,
		familyname,
		receiverGivenName,
		receiverFamilyName,
		mobile,
	} = reqData;

	const { cashierId, sendRecord } = otherData;

	let data = new CashierClaim();
	data.transaction_code = transferCode;
	data.proof = proof;
	data.cashier_id = cashierId;
	data.amount = sendRecord.amount;
	data.fee = sendRecord.fee;
	data.is_inclusive = sendRecord.is_inclusive;
	data.sender_name = givenname + " " + familyname;
	data.sender_mobile = mobile;
	data.receiver_name = receiverGivenName + " " + receiverFamilyName;
	data.master_code = sendRecord.master_code;

	data.save((err, cashierClaimObj) => {
		return next(err, cashierClaimObj);
	});
}

function updateClaimRecord(model, data, next) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";

	const { cashierId, claimId, amount, claimFee } = data;
	const Model = getTypeClass(model);

	CashierClaim.findByIdAndUpdate(
		claimId,
		{
			status: 1,
		},
		(err) => {
			if (err) {
				next(err);
			} else {
				Model.findByIdAndUpdate(
					cashierId,
					{
						$inc: {
							cash_paid: Number(amount),
							cash_in_hand: -Number(amount),
							fee_generated: Number(claimFee),
							total_trans: 1,
						},
					},
					function (err) {
						if (err) {
							next(err);
						} else {
							CashierLedger.findOneAndUpdate(
								{
									cashier_id: cashierId,
									trans_type: "DR",
									created_at: {
										$gte: new Date(start),
										$lte: new Date(end),
									},
								},
								{
									$inc: {
										amount: amount,
									},
								},
								function (err, c) {
									if (err) {
										next(err);
									} else if (c == null) {
										let data = new CashierLedger();
										data.amount = amount;
										data.trans_type = "DR";
										data.cashier_id = cashierId;
										data.save(function (err) {
											next(err);
										});
									} else {
										next(null);
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
													Branch.findOne(
														{
															_id: sendRecord.send_branch_id,
														},
														function (err, sendBranch) {
															let errRes = errorMessage(
																err,
																sendBranch,
																"Sending Branch Not Found"
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
																									claimerType: "claimBranch",
																									claimerCode: branch.bcode,
																								};

																								cashierClaimMoney(
																									transfer,
																									bank,
																									branch,
																									sendBranch,
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
																															master_code
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
																											console.log(
																												result.toString()
																											);
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
																			}); //save
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
		}
	);
};

module.exports.partnerSendMoney = async function (req, res) {
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
																							otherInfo.amount = result.amount;
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
																								claimerType: "claimPartner",
																								claimerCode: partner.code,
																							};
																							cashierClaimMoney(
																								transfer,
																								bank,
																								branch,
																								receiver,
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
																														master_code
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
