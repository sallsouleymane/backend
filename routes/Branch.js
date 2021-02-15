const express = require("express");
const router = express.Router();

//services
const { getStatement, initiateTransfer } = require("../services/Blockchain.js");
const jwtTokenAuth = require("./JWTTokenAuth");
const { errorMessage, catchError } = require("./utils/errorHandler");

const Infra = require("../models/Infra");
const Bank = require("../models/Bank");
const OTP = require("../models/OTP");
const Branch = require("../models/Branch");
const BankUser = require("../models/BankUser");
const Cashier = require("../models/Cashier");
const CashierTransfer = require("../models/CashierTransfer");
const CashierPending = require("../models/CashierPending");
const CashierLedger = require("../models/CashierLedger");
const BranchSend = require("../models/BranchSend");
const BranchClaim = require("../models/BranchClaim");
const BranchLedger = require("../models/BranchLedger");

router.post("/getBranchDashStats", jwtTokenAuth, function (req, res) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";

	const jwtusername = req.sign_creds.username;
	Branch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				console.log({ $gte: new Date(start), $lte: new Date(end) });
				BranchLedger.findOne(
					{
						created_at: { $gte: new Date(start), $lte: new Date(end) },
						branch_id: user._id,
						trans_type: "CR",
					},
					(e, post2) => {
						let received = 0,
							fee = 0;
						if (post2 != null) {
							received = Number(post2.amount);
						}
						BranchLedger.findOne(
							{
								branch_id: user._id,
								trans_type: "DR",
								created_at: { $gte: new Date(start), $lte: new Date(end) },
							},
							(e, post3) => {
								let paid = 0;
								if (post3 != null && post3 != "") {
									paid = Number(post3.amount);
									if (paid == null || paid == "") {
										paid = 0;
									}
								}
								Cashier.countDocuments(
									{
										branch_id: user._id,
									},
									(e, post4) => {
										if (post4 == null || !post4) {
											post4 = 0;
										}

										Cashier.aggregate(
											[
												{ $match : {branch_id: user._id}},
												{
													$group: {
														_id: "$branch_id",
														total: {
															$sum: "$cash_in_hand",
														},
														totalFee: {
															$sum: "$fee_generated",
														},
														totalCommission: {
															$sum: "$commission_generated",
														},
														openingBalance: {
															$sum: "$opening_balance",
														},
													},
												},
											],
											async (e, post5) => {
												let cin = 0;
												if (
													post5 != undefined &&
													post5 != null &&
													post5.length > 0
												) {
													cin = post5[0].total;
													fg = post5[0].totalFee;
													cg = post5[0].totalCommission;
													ob = post5[0].openingBalance;
												}
												var totalPendingTransfers = await CashierTransfer.countDocuments({status: 0, branch_id: user._id});
												var totalAcceptedTransfers = await CashierTransfer.countDocuments({status: 1, branch_id: user._id});
												var totalcancelledTransfers = await CashierTransfer.countDocuments({status: -1, branch_id: user._id});

												res.status(200).json({
													status: 1,
													totalCashier: post4,
													cashPaid: paid == null ? 0 : paid,
													cashReceived: received == null ? 0 : received,
													cashInHand: cin,
													feeGenerated : fg,
													commissionGenerated: cg,
													openingBalance: ob,
													cancelled: totalcancelledTransfers,
													pending: totalPendingTransfers,
													accepted: totalAcceptedTransfers,
												});
											}
										);
									}
								);
							}
						);
					}
				);
			}
		}
	);
});

router.post("/addBranchCashier", jwtTokenAuth, function (req, res) {
	let data = new Cashier();
	const {
		name,
		bcode,
		working_from,
		working_to,
		per_trans_amt,
		max_trans_amt,
		max_trans_count,
	} = req.body;

	const jwtusername = req.sign_creds.username;
	Branch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			let result = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				data.name = name;
				data.bcode = bcode;
				data.working_from = working_from;
				data.working_to = working_to;
				data.per_trans_amt = per_trans_amt;
				data.max_trans_amt = max_trans_amt;
				data.max_trans_count = max_trans_count;
				data.branch_id = bank._id;
				data.bank_id = bank.bank_id;

				data.save((err, d) => {
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
						res.status(200).json({
							status: 1,
							message: "Added cashier successfully",
							data: data,
						});
					}
				});
			}
		}
	);
});

router.post("/addOpeningBalance", jwtTokenAuth, function (req, res) {
	const {
		cashier_id,
		denom10,
		denom20,
		denom50,
		denom100,
		denom1000,
		denom2000,
		total,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Branch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, otpd) {
			let result = errorMessage(
				err,
				otpd,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				let data = new CashierLedger();
				data.amount = total;
				data.cashier_id = cashier_id;
				data.trans_type = "OB";
				let td = {
					denom10,
					denom20,
					denom50,
					denom100,
					denom1000,
					denom2000,
				};
				data.transaction_details = JSON.stringify(td);

				data.save((err) => {
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
						Cashier.findByIdAndUpdate(
							cashier_id,
							{
								opening_balance: total,
								cash_in_hand: total,
							},
							(err, d) => {
								res.status(200).json({
									status: 1,
									message: "Added successfully",
								});
							}
						);
					}
				});
			}
		}
	);
});

router.post("/getBranch", jwtTokenAuth, function (req, res) {
	res.status(200).json({
		status: 0,
		message: "This API is removed",
		Replace: "/getOne api",
	});
});

router.post("/getBranchInfo", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Branch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, branch) {
			let result = errorMessage(
				err,
				branch,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				BankUser.find(
					{
						branch_id: branch._id,
					},
					function (err, users) {
						res.status(200).json({
							status: 1,
							branches: branch,
							bankUsers: users,
						});
					}
				);
			}
		}
	);
});

router.post("/branchSetupUpdate", jwtTokenAuth, function (req, res) {
	const { password } = req.body;
	const jwtusername = req.sign_creds.username;
	Branch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
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
			} else if (!bank) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Branch.findByIdAndUpdate(
					bank._id,
					{
						password: password,
						initial_setup: true,
					},
					(err) => {
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
							res.status(200).json({
								status: 1,
								message: "Updated successfully",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/checkBranchFee", jwtTokenAuth, function (req, res) {
	const { amount } = req.body;

	const jwtusername = req.sign_creds.username;
	Branch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, f2) {
			let result = errorMessage(
				err,
				f2,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.findOne(
					{
						_id: f2.bank_id,
					},
					function (err, f3) {
						let result = errorMessage(err, f3, "Bank not Found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							var oamount = Number(amount);

							const find = {
								bank_id: f3._id,
								trans_type: "Non Wallet to Non Wallet",
								status: 1,
								active: "Active",
							};
							console.log(find);
							Fee.findOne(find, function (err, fe) {
								let result = errorMessage(
									err,
									fe,
									"Transaction cannot be done at this time"
								);
								if (result.status == 0) {
									res.status(200).json(result);
								} else {
									let fee = 0;

									fe.ranges.map((range) => {
										if (
											oamount >= range.trans_from &&
											oamount <= range.trans_to
										) {
											temp = (oamount * range.percentage) / 100;
											fee = temp + range.fixed;
										}

										res.status(200).json({
											status: 1,
											fee: fee,
										});
									});
								}
							});
						}
					}
				);
			}
		}
	);
});

router.post("/updateCashierTransferStatus", jwtTokenAuth, function (req, res) {
	const { transfer_id, cashier_id, status } = req.body;

	const jwtusername = req.sign_creds.username;
	Branch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, f) {
			let result = errorMessage(
				err,
				f,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				CashierPending.findByIdAndUpdate(
					transfer_id,
					{ status: status },
					function (err, d) {
						let result = errorMessage(err, d, "History not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							Cashier.findByIdAndUpdate(
								cashier_id,
								{ $inc: {pending_trans: -1}},
								function (err, cashier) {
									let result = errorMessage(err, cashier, "Cashier not found");
									if (result.status == 0) {
										res.status(200).json(result);
									} else {
										res.status(200).json({
											status: 1,
											message: "Updated successfully",
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
});

router.post("/branchVerifyClaim", jwtTokenAuth, function (req, res) {
	const { otpId, otp } = req.body;

	const jwtusername = req.sign_creds.username;
	Branch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, f) {
			let result = errorMessage(
				err,
				f,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				OTP.findOne(
					{
						_id: otpId,
						otp: otp,
					},
					function (err, otpd) {
						let result = errorMessage(err, otpd, "OTP Missmatch");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							res.status(200).json({
								status: 1,
								message: "Claim verified",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/branchClaimMoney", jwtTokenAuth, function (req, res) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";

	const {
		transferCode,
		proof,
		givenname,
		familyname,
		receiverGivenName,
		receiverFamilyName,
	} = req.body;

	const jwtusername = req.sign_creds.username;
	Branch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, f) {
			let result = errorMessage(
				err,
				f,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				BranchSend.findOne(
					{
						transaction_code: transferCode,
					},
					function (err, otpd) {
						let result = errorMessage(err, otpd, "Transaction Not Found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							Branch.findOne(
								{
									_id: f._id,
								},
								function (err, f2) {
									let result = errorMessage(err, f2, "Branch Not Found");
									if (result.status == 0) {
										res.status(200).json(result);
									} else {
										Bank.findOne(
											{
												_id: f.bank_id,
											},
											function (err, f3) {
												let result = errorMessage(err, f3, "Bank Not Found");
												if (result.status == 0) {
													res.status(200).json(result);
												} else {
													Infra.findOne(
														{
															_id: f3.user_id,
														},
														function (err, f4) {
															let result = errorMessage(
																err,
																f4,
																"Infra Not Found"
															);
															if (result.status == 0) {
																res.status(200).json(result);
															} else {
																let data = new BranchClaim();
																data.transaction_code = transferCode;
																data.proof = proof;
																data.branch_id = f._id;
																data.amount = otpd.amount;
																data.fee = otpd.fee;
																data.sender_name = givenname + " " + familyname;
																data.receiver_name =
																	receiverGivenName + " " + receiverFamilyName;
																var mns = f3.mobile.slice(-2);
																var mnr = f2.mobile.slice(-2);
																var now = new Date().getTime();
																var child_code = mns + "" + mnr + "" + now;
																var master_code = otpd.master_code;
																data.master_code = master_code;
																data.child_code = child_code;

																const oamount = otpd.amount;
																data.save((err, d) => {
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
																		let trans1 = {};
																		trans1.from = f3.wallet_ids.escrow;
																		trans1.to = f2.wallet_ids.operational;
																		trans1.amount = oamount;
																		trans1.note = "Branch claim Money";
																		trans1.email1 = f3.email;
																		trans1.email2 = f2.email;
																		trans1.mobile1 = f3.mobile;
																		trans1.mobile2 = f2.mobile;
																		trans1.from_name = f3.name;
																		trans1.to_name = f2.name;
																		trans1.user_id = "";
																		trans1.master_code = master_code;
																		trans1.child_code = child_code;
																		initiateTransfer(trans1)
																			.then(function (result) {
																				if (result.length <= 0) {
																					BranchClaim.findByIdAndUpdate(
																						d._id,
																						{
																							status: 1,
																						},
																						(err) => {
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
																								BranchLedger.findOne(
																									{
																										branch_id: f._id,
																										trans_type: "DR",
																										created_at: {
																											$gte: new Date(start),
																											$lte: new Date(end),
																										},
																									},
																									function (err, c) {
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
																										} else if (c == null) {
																											let data = new BranchLedger();
																											data.amount = Number(
																												oamount
																											);
																											data.trans_type = "DR";
																											data.branch_id = f._id;
																											data.save(function (
																												err,
																												c
																											) {});
																										} else {
																											var amt =
																												Number(c.amount) +
																												Number(oamount);
																											BranchLedger.findByIdAndUpdate(
																												c._id,
																												{ amount: amt },
																												function (err, c) {}
																											);
																										}
																									}
																								);

																								res.status(200).json({
																									status: 1,
																									message: "Money claimed",
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
																}); //save
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
});

router.post("/branchVerifyOTPClaim", jwtTokenAuth, function (req, res) {
	const { transferCode, otp } = req.body;

	const jwtusername = req.sign_creds.username;
	Branch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, f) {
			let result = errorMessage(
				err,
				f,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				BranchSend.findOne(
					{
						transaction_code: transferCode,
						otp: otp,
					},
					function (err, otpd) {
						let result = errorMessage(err, otpd, "OTP Missmatch");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							res.status(200).json({
								status: 1,
								message: "Claim otp verified",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/getBranchClaimMoney", jwtTokenAuth, function (req, res) {
	const { transferCode } = req.body;

	const jwtusername = req.sign_creds.username;
	Branch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, f) {
			let result = errorMessage(
				err,
				f,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				BranchClaim.findOne(
					{
						transaction_code: transferCode,
						status: 1,
					},
					function (err, cs) {
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
						} else if (cs == null) {
							BranchSend.findOne(
								{
									transaction_code: transferCode,
								},
								function (err, cs) {
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
									} else if (cs == null) {
										res.status(200).json({
											status: 0,
											message: "Record Not Found",
										});
									} else {
										res.status(200).json({
											status: 1,
											row: cs,
										});
									}
								}
							);
						} else {
							res.status(200).json({
								status: 0,
								message: "This transaction was already claimed",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/getBranchHistory", jwtTokenAuth, function (req, res) {
	const { from } = req.body;

	const jwtusername = req.sign_creds.username;
	Branch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, b) {
			let result = errorMessage(
				err,
				b,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const wallet = b.wallet_ids[from];
				console.log(wallet);
				getStatement(wallet)
					.then(function (result) {
						res.status(200).json({
							status: 1,
							history: result,
						});
					})
					.catch((err) => {
						res.status(200).json(catchError(err));
					});
			}
		}
	);
});

module.exports = router;
