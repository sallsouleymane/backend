const express = require("express");
const router = express.Router();
const config = require("../config.json");

//services
const {
	getStatement,
	transferThis,
	initiateTransfer,
} = require("../services/Blockchain.js");

const Infra = require("../models/Infra");
const Bank = require("../models/Bank");
const OTP = require("../models/OTP");
const Branch = require("../models/Branch");
const BankUser = require("../models/BankUser");
const Cashier = require("../models/Cashier");
const CashierPending = require("../models/CashierPending");
const CashierLedger = require("../models/CashierLedger");
const BranchSend = require("../models/BranchSend");
const BranchClaim = require("../models/BranchClaim");
const BranchLedger = require("../models/BranchLedger");

router.post("/branch/transferMasterToOp", function (req, res) {
	const { token, amount } = req.body;
	Branch.findOne(
		{
			token,
			status: 1,
		},
		function (err, branch) {
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
			} else if (branch == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Bank.findOne(
					{
						_id: branch.bank_id,
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
						} else if (bank == null) {
							res.status(200).json({
								status: 0,
								message:
									"Token changed or user not valid. Try to login again or contact system administrator.",
							});
						} else {
							const masterWallet = branch.bcode + "_master@" + bank.name;
							const opWallet = branch.bcode + "_operational@" + bank.name;
							const trans = {
								from: masterWallet,
								to: opWallet,
								amount: Number(amount),
								note: "Master to operational",
								email1: branch.email,
								mobile1: branch.mobile,
								from_name: branch.name,
								to_name: branch.name,
								master_code: "",
								child_code: ""
							}
							initiateTransfer(trans).then((result) => {
								res.status(200).json(result)
							});
						}
					});
			}
		});
});


router.post("/getBranchDashStats", function (req, res) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";

	const { token } = req.body;
	Branch.findOne(
		{
			token,
			status: 1,
		},
		function (err, user) {
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
			} else if (user == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
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
							// let fe = JSON.parse(post2.transaction_details);
							// console.log(fe);
							received = Number(post2.amount);
							//fee = Number(fe.fee);
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
												{
													$group: {
														_id: null,
														total: {
															$sum: "$cash_in_hand",
														},
													},
												},
											],
											(e, post5) => {
												let cin = 0;
												if (
													post5 != undefined &&
													post5 != null &&
													post5.length > 0
												) {
													cin = post5[0].total;
												}

												res.status(200).json({
													totalCashier: post4,
													cashPaid: paid == null ? 0 : paid,
													cashReceived: received == null ? 0 : received,
													cashInHand: cin,
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

router.post("/addBranchCashier", (req, res) => {
	let data = new Cashier();
	const {
		name,
		bcode,
		working_from,
		working_to,
		per_trans_amt,
		max_trans_amt,
		max_trans_count,
		token,
	} = req.body;

	Branch.findOne(
		{
			token,
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
			} else if (bank == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
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
						// let content = "<p>You are added as Cashier in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://"+config.mainIP+"/cashier/"+bankName+"'>http://"+config.mainIP+"/cashier/"+bankName+"</a></p><p><p>Your username: " + data.username + "</p><p>Your password: " + data.password + "</p>";
						// sendMail(content, "Bank Account Created", email);
						// let content2 = "You are added as Cashier in E-Wallet application Login URL: http://"+config.mainIP+"/cashier/"+bankName+" Your username: " + data.username + " Your password: " + data.password;
						// sendSMS.js(content2, mobile);
						return res.status(200).json(data);
					}
				});
			}
		}
	);
});

router.post("/addOpeningBalance", (req, res) => {
	const {
		cashier_id,
		denom10,
		denom20,
		denom50,
		denom100,
		denom1000,
		denom2000,
		total,
		token,
	} = req.body;
	Branch.findOne(
		{
			token,
			status: 1,
		},
		function (err, otpd) {
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
			} else if (otpd == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
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
								return res.status(200).json(true);
							}
						);
					}
				});
			}
		}
	);
});

router.post("/getBranch", function (req, res) {
	//res.send("hi");
	const { token, branch_id } = req.body;
	Bank.findOne(
		{
			token,
			status: 1,
		},
		function (err, user) {
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
			} else if (user == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Branch.findOne(
					{
						_id: branch_id,
					},
					function (err, branch) {
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
								branches: branch,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/getBranchInfo", function (req, res) {
	//res.send("hi");
	const { token } = req.body;

	Branch.findOne(
		{
			token: token,
			status: 1,
		},
		function (err, branch) {
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
			} else if (branch == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				BankUser.find(
					{
						branch_id: branch._id,
					},
					function (err, users) {
						res.status(200).json({
							branches: branch,
							bankUsers: users,
						});
					}
				);
			}
		}
	);
});

router.post("/branchSetupUpdate", function (req, res) {
	const { username, password, token } = req.body;
	Branch.findOne(
		{
			token,
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
								success: "Updated successfully",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/checkBranchFee", function (req, res) {
	const { amount, token, bankName } = req.body;

	Branch.findOne(
		{
			token,
			status: 1,
		},
		function (err, f2) {
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
			} else if (f2 == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Bank.findOne(
					{
						_id: f2.bank_id,
					},
					function (err, f3) {
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
						} else if (f3 == null) {
							res.status(200).json({
								status: 0,
								message: "Bank not Found",
							});
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
								} else if (fe == null) {
									res.status(200).json({
										fee: "Transaction cannot be done at this time",
									});
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

router.post("/updateCashierTransferStatus", function (req, res) {
	const { transfer_id, cashier_id, token, status } = req.body;

	Branch.findOne(
		{
			token,
			status: 1,
		},
		function (err, f) {
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
			} else if (f == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				CashierPending.findByIdAndUpdate(
					transfer_id,
					{ status: status },
					function (err, d) {
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
						} else if (d == null) {
							res.status(200).json({
								status: 0,
								message: err.toString(),
							});
						} else {
							Cashier.findOne({ _id: cashier_id }, function (err, da) {
								let pending = Number(da.pending_trans) - 1;
								Cashier.findByIdAndUpdate(
									cashier_id,
									{ pending_trans: pending },
									function (err, d) {
										res.status(200).json({
											success: "true",
										});
									}
								);
							});
						}
					}
				);
			}
		}
	);
});

router.post("/branchVerifyClaim", function (req, res) {
	const { otpId, token, otp } = req.body;

	Branch.findOne(
		{
			token,
			status: 1,
		},
		function (err, f) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else if (f == null) {
				res.status(200).json({
					status: 0,
					message: "Branch not found",
				});
			} else {
				OTP.findOne(
					{
						_id: otpId,
						otp: otp,
					},
					function (err, otpd) {
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
						} else if (otpd == null) {
							res.status(200).json({
								status: 0,
								message: "OTP Missmatch",
							});
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

router.post("/branchClaimMoney", function (req, res) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";

	const {
		token,
		transferCode,
		proof,
		givenname,
		familyname,
		receiverGivenName,
		receiverFamilyName,
	} = req.body;

	Branch.findOne(
		{
			token,
			status: 1,
		},
		function (err, f) {
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
			} else if (f == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				BranchSend.findOne(
					{
						transaction_code: transferCode,
					},
					function (err, otpd) {
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
						} else if (otpd == null) {
							res.status(200).json({
								status: 0,
								message: "Transaction Not Found",
							});
						} else {
							Branch.findOne(
								{
									_id: f._id,
								},
								function (err, f2) {
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
									} else if (f2 == null) {
										res.status(200).json({
											status: 0,
											message: "Branch Not Found",
										});
									} else {
										Bank.findOne(
											{
												_id: f.bank_id,
											},
											function (err, f3) {
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
												} else if (f3 == null) {
													res.status(200).json({
														status: 0,
														message: "Bank Not Found",
													});
												} else {
													Infra.findOne(
														{
															_id: f3.user_id,
														},
														function (err, f4) {
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
															} else if (f4 == null) {
																res.status(200).json({
																	status: 0,
																	message: "Infra Not Found",
																});
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
																		const branchOpWallet =
																			f2.bcode + "_operational@" + f3.name;
																		const bankEsWallet = "escrow@" + f3.name;
																		let trans1 = {};
																		trans1.from = bankEsWallet;
																		trans1.to = branchOpWallet;
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
																		transferThis(trans1).then(function (
																			result
																		) {
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
																										) { });
																									} else {
																										var amt =
																											Number(c.amount) +
																											Number(oamount);
																										BranchLedger.findByIdAndUpdate(
																											c._id,
																											{ amount: amt },
																											function (err, c) { }
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

router.post("/branchVerifyOTPClaim", function (req, res) {
	const { transferCode, token, otp } = req.body;

	Branch.findOne(
		{
			token,
			status: 1,
		},
		function (err, f) {
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
			} else if (f == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				BranchSend.findOne(
					{
						transaction_code: transferCode,
						otp: otp,
					},
					function (err, otpd) {
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
						} else if (otpd == null) {
							res.status(200).json({
								status: 0,
								message: "OTP Missmatch",
							});
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

router.post("/getBranchClaimMoney", function (req, res) {
	const { transferCode, token } = req.body;

	Branch.findOne(
		{
			token,
			status: 1,
		},
		function (err, f) {
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
			} else if (f == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
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

router.post("/getBranchHistory", function (req, res) {
	const { from, token } = req.body;

	Branch.findOne(
		{
			token,
			status: 1,
		},
		function (err, b) {
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
			} else if (b == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Bank.findOne(
					{
						_id: b.bank_id,
					},
					function (err, b2) {
						const wallet = b.bcode + "_" + from + "@" + b2.name;
						console.log(wallet);
						getStatement(wallet).then(function (result) {
							res.status(200).json({
								status: 1,
								history: result,
							});
						});
					}
				);
			}
		}
	);
});

module.exports = router;
