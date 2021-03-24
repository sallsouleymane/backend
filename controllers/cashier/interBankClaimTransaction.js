//utils
const makeid = require("../../routes/utils/idGenerator");
const sendSMS = require("../../routes/utils/sendSMS");
const sendMail = require("../../routes/utils/sendMail");
const makeotp = require("../../routes/utils/makeotp");
const getTypeClass = require("../../routes/utils/getTypeClass");
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");

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
const cashierClaimMoney = require("../transactions/interBank/cashierClaimMoney");

module.exports.cashierClaimMoney = function (req, res) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";

	const { transferCode } = req.body;

	jwtAuthentication(req, async function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			CashierClaim.findOne(
				{
					transaction_code: transferCode,
					status: 1,
				},
				function (err, cc) {
					let errMsg = errorMessage(err, cc, "Money is already claimed");
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
																{ _id: cs.sending_bank_id },
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
																			type: cs.inter_bank_rule_type,
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
																						trans_type: cs.rule_type,
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
																											var transfer = {
																												master_code: master_code,
																												amount: cs.amount,
																												isInclusive:
																													cs.is_inclusive,
																												cashierId: cashier._id,
																											};
																											interCashierClaimMoney(
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
																														console.log(
																															result.toString()
																														);
																														res
																															.status(200)
																															.json(result);
																													}
																												})
																												.catch((err) => {
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
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";

	const jwtusername = req.sign_creds.username;

	const {
		transferCode,
		proof,
		givenname,
		familyname,
		receiverGivenName,
		receiverFamilyName,
		mobile,
	} = req.body;

	PartnerCashier.findOne(
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
				CashierClaim.findOne(
					{
						transaction_code: transferCode,
						status: 1,
					},
					function (err, cc) {
						let errMsg = errorMessage(
							err,
							cc,
							"Money is already claimed",
							true
						);
						if (errMsg.status == 0) {
							res.status(200).json(errMsg);
						} else {
							CashierSend.findOne(
								{
									transaction_code: transferCode,
								},
								function (err, cs) {
									let errMsg = errorMessage(
										err,
										cs,
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
																				{ _id: cs.sending_bank_id },
																				(err, sendingBank) => {
																					let errMsg = errorMessage(
																						err,
																						bank,
																						"Sending Bank not Found"
																					);
																					if (errMsg.status == 0) {
																						res.status(200).json(errMsg);
																					} else {
																						var amount = cs.amount;
																						if (cs.is_inclusive) {
																							amount = cs.amount - cs.fee;
																						}
																						let data = new CashierClaim();
																						data.transaction_code = transferCode;
																						data.proof = proof;
																						data.cashier_id = cashier._id;
																						data.amount = cs.amount;
																						data.fee = cs.fee;
																						data.is_inclusive = cs.is_inclusive;
																						data.sender_name =
																							givenname + " " + familyname;
																						data.sender_mobile = mobile;
																						data.receiver_name =
																							receiverGivenName +
																							" " +
																							receiverFamilyName;
																						var master_code = cs.master_code;
																						data.master_code = master_code;
																						data.child_code =
																							master_code + "-1";

																						data.save(
																							(err, cashierClaimObj) => {
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
																									const find = {
																										bank_id: sendingBank._id,
																										type:
																											cs.inter_bank_rule_type,
																										status: 1,
																										active: 1,
																									};
																									InterBankRule.findOne(
																										find,
																										function (err, rule1) {
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
																											} else if (
																												rule1 == null
																											) {
																												res.status(200).json({
																													status: 0,
																													message:
																														"Inter Bank Fee Rule Not Found",
																												});
																											} else {
																												const find = {
																													bank_id:
																														cashier.bank_id,
																													trans_type:
																														cs.rule_type,
																													status: 1,
																													active: "Active",
																												};
																												Fee.findOne(
																													find,
																													function (
																														err,
																														rule2
																													) {
																														if (err) {
																															console.log(err);
																															var message = err;
																															if (err.message) {
																																message =
																																	err.message;
																															}
																															res
																																.status(200)
																																.json({
																																	status: 0,
																																	message: message,
																																});
																														} else if (
																															rule2 == null
																														) {
																															res
																																.status(200)
																																.json({
																																	status: 0,
																																	message:
																																		"Revenue Rule Not Found",
																																});
																														} else {
																															var transfer = {
																																master_code: master_code,
																																amount:
																																	cs.amount,
																																isInclusive:
																																	cs.is_inclusive,
																																partnerCode:
																																	partner.code,
																																cashierId:
																																	cashier._id,
																															};
																															interPartnerCashierClaimMoney(
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
																																		CashierClaim.findByIdAndUpdate(
																																			cashierClaimObj._id,
																																			{
																																				status: 1,
																																			},
																																			(err) => {
																																				if (
																																					err
																																				) {
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
																																						.json(
																																							{
																																								status: 0,
																																								message: message,
																																							}
																																						);
																																				} else {
																																					PartnerCashier.findByIdAndUpdate(
																																						cashier._id,
																																						{
																																							cash_paid:
																																								Number(
																																									cashier.cash_paid
																																								) +
																																								Number(
																																									amount
																																								),
																																							cash_in_hand:
																																								Number(
																																									cashier.cash_in_hand
																																								) -
																																								Number(
																																									amount
																																								),
																																							fee_generated:
																																								Number(
																																									cashier.fee_generated
																																								) +
																																								Number(
																																									result.claimFee
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
																																								"DR",
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
																																								data.amount = Number(
																																									amount
																																								);
																																								data.trans_type =
																																									"DR";
																																								data.cashier_id =
																																									cashier._id;
																																								data.save(
																																									async function (
																																										err,
																																										c
																																									) {
																																										await txstate.completed(
																																											master_code
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
																																								);
																																							} else {
																																								var amt =
																																									Number(
																																										c.amount
																																									) +
																																									Number(
																																										amount
																																									);
																																								CashierLedger.findByIdAndUpdate(
																																									c._id,
																																									{
																																										amount: amt,
																																									},
																																									function (
																																										err,
																																										c
																																									) {
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
																																								);
																																							}
																																						}
																																					);
																																				}
																																			}
																																		);
																																	} else {
																																		console.log(
																																			result.toString()
																																		);
																																		res
																																			.status(
																																				200
																																			)
																																			.json(
																																				result
																																			);
																																	}
																																})
																																.catch(
																																	(err) => {
																																		console.log(
																																			err.toString()
																																		);
																																		res
																																			.status(
																																				200
																																			)
																																			.json({
																																				status: 0,
																																				message:
																																					err.message,
																																			});
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
		}
	);
};
