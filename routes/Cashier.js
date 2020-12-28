const express = require("express");
const router = express.Router();
const config = require("../config.json");

//utils
const makeid = require("./utils/idGenerator");
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const makeotp = require("./utils/makeotp");
const getTypeClass = require("./utils/getTypeClass");
const getWalletIds = require("./utils/getWalletIds");
const jwtTokenAuth = require("./JWTTokenAuth");
const { errorMessage, catchError } = require("./utils/errorHandler");
// const { getTransactionCode } = require("./utils/calculateShare");

//services
const blockchain = require("../services/Blockchain.js");

const Infra = require("../models/Infra");
const Fee = require("../models/Fee");
const User = require("../models/User");
const Bank = require("../models/Bank");
const OTP = require("../models/OTP");
const Branch = require("../models/Branch");
const BankUser = require("../models/BankUser");
const Cashier = require("../models/Cashier");
const CashierSend = require("../models/CashierSend");
const CashierPending = require("../models/CashierPending");
const CashierClaim = require("../models/CashierClaim");
const CashierLedger = require("../models/CashierLedger");
const CashierTransfer = require("../models/CashierTransfer");
const Merchant = require("../models/merchant/Merchant");
const MerchantSettings = require("../models/merchant/MerchantSettings");
const cashierToOperational = require("./transactions/intraBank/cashierToOperational");

// transactions
// const state = require("./transactions/state");
const cashierToCashier = require("./transactions/intraBank/cashierToCashier");
const cashierToWallet = require("./transactions/intraBank/cashierToWallet");
const cashierClaimMoney = require("./transactions/intraBank/cashierClaimMoney");

router.post("/cashier/sendToOperational", jwtTokenAuth, function (req, res) {
	const { wallet_id, amount, is_inclusive } = req.body;

	var code = wallet_id.substr(0, 2);
	if (code != "PB") {
		res.status(200).json({
			status: 0,
			message: "You can only send to branch and partner branch",
		});
		return;
	}
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
				Branch.findOne({ _id: cashier.branch_id }, (err, branch) => {
					let result = errorMessage(err, branch, "Branch not found");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						const Collection = getTypeClass(code);
						Collection.findOne(
							{
								_id: { $ne: branch._id },
								bank_id: branch.bank_id,
								"wallet_ids.operational": wallet_id,
							},
							(err, toBranch) => {
								let result = errorMessage(err, toBranch, "Invalid wallet ID");
								if (result.status == 0) {
									res.status(200).json(result);
								} else {
									const find = {
										bank_id: branch.bank_id,
										trans_type: "Non Wallet to Operational",
										status: 1,
										active: "Active",
									};
									Fee.findOne(find, (err, rule) => {
										let result = errorMessage(err, rule, "Rule not found");
										if (result.status == 0) {
											res.status(200).json(result);
										} else {
											Bank.findOne({ _id: branch.bank_id }, (err, bank) => {
												let result = errorMessage(err, bank, "Bank not found");
												if (result.status == 0) {
													res.status(200).json(result);
												} else {
													Infra.findOne({ _id: bank.user_id }, (err, infra) => {
														let result = errorMessage(
															err,
															infra,
															"Infra not found"
														);
														if (result.status == 0) {
															res.status(200).json(result);
														} else {
															const transfer = {
																amount: amount,
																isInclusive: is_inclusive,
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
																	if (result == 1) {
																		CashierSend.findByIdAndUpdate(
																			d._id,
																			{
																				status: 1,
																				fee: result.fee,
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
																					Cashier.findByIdAndUpdate(
																						cashier._id,
																						{
																							cash_received:
																								Number(cashier.cash_received) +
																								Number(transfer.amount) +
																								Number(transfer.fee),
																							cash_in_hand:
																								Number(cashier.cash_in_hand) +
																								Number(trasfer.amount) +
																								Number(transfer.fee),
																							fee_generated:
																								Number(transfer.sendFee) +
																								Number(cashier.fee_generated),
																							total_trans:
																								Number(cashier.total_trans) + 1,
																						},
																						function (e, v) {}
																					);
																					CashierLedger.findOne(
																						{
																							cashier_id: cashier._id,
																							trans_type: "CR",
																							created_at: {
																								$gte: new Date(start),
																								$lte: new Date(end),
																							},
																						},
																						function (err, c) {
																							if (err || c == null) {
																								let data = new CashierLedger();
																								data.amount =
																									Number(transfer.amount) +
																									Number(transfer.fee);
																								data.trans_type = "CR";
																								data.transaction_details = JSON.stringify(
																									{
																										fee: transfer.fee,
																									}
																								);
																								data.cashier_id = cashier._id;
																								data.save(function (err, c) {});
																							} else {
																								var amt =
																									Number(c.amount) +
																									Number(transfer.amount) +
																									Number(transfer.fee);
																								CashierLedger.findByIdAndUpdate(
																									c._id,
																									{
																										amount: amt,
																									},
																									function (err, c) {}
																								);
																							}
																						}
																					);
																					res.status(200).json({
																						status: 1,
																						message:
																							transfer.amount +
																							"XOF amount is Transferred",
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
		}
	);
});

router.post(
	"/cashier/getTransactionHistory",
	jwtTokenAuth,
	function (req, res) {
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
					Branch.findOne({ _id: cashier.branch_id }, (err, branch) => {
						let result = errorMessage(err, branch, "Branch not found.");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							Bank.findOne({ _id: branch.bank_id }, async (err, bank) => {
								let result = errorMessage(err, bank, "Bank not found.");
								if (result.status == 0) {
									res.status(200).json(result);
								} else {
									try {
										let result = await blockchain.getStatement(
											branch.wallet_ids.operational,
											cashier._id
										);
										res.status(200).json({
											status: 1,
											message: "get cashier transaction history success",
											history: result,
										});
									} catch (err) {
										return catchError(err);
									}
								}
							});
						}
					});
				}
			}
		);
	}
);

router.post("/cashier/listMerchants", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
		{
			username: jwtusername,
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
				Merchant.find(
					{
						status: 1,
						$or: [
							{ is_private: { $exists: false } },
							{ is_private: false },
							{ $and: [{ is_private: true }, { bank_id: cashier.bank_id }] },
						],
					},
					"-password",
					(err, merchants) => {
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
								message: "Merchants List",
								list: merchants,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/cashier/getUser", jwtTokenAuth, function (req, res) {
	const { mobile } = req.body;
	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
		{
			username: jwtusername,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"You are either not authorised or not logged in."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				User.findOne({ mobile }, "-password", function (err, user) {
					let result = errorMessage(err, user, "User not found");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						res.status(200).json({
							status: 1,
							data: user,
						});
					}
				});
			}
		}
	);
});

router.post(
	"/cashier/getMerchantPenaltyRule",
	jwtTokenAuth,
	function (req, res) {
		const { merchant_id } = req.body;
		const jwtusername = req.sign_creds.username;
		Cashier.findOne(
			{
				username: jwtusername,
			},
			function (err, cashier) {
				let result = errorMessage(
					err,
					cashier,
					"You are either not authorised or not logged in."
				);
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					MerchantSettings.findOne(
						{ merchant_id: merchant_id },
						function (err, setting) {
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
									rule: setting.penalty_rule,
								});
							}
						}
					);
				}
			}
		);
	}
);

router.post("/cashier/createUser", jwtTokenAuth, function (req, res) {
	const {
		name,
		last_name,
		mobile,
		email,
		address,
		city,
		state,
		country,
		id_type,
		id_name,
		valid_till,
		id_number,
		dob,
		gender,
		bank,
		docs_hash,
	} = req.body;

	const password = makeid(10);
	var userDetails = {
		name: name,
		last_name: last_name,
		mobile: mobile,
		email: email,
		username: mobile,
		password: password,
		address: address,
		city: city,
		state: state,
		country: country,
		id_type: id_type,
		id_name: id_name,
		valid_till: valid_till,
		id_number: id_number,
		dob: dob,
		gender: gender,
		bank: bank,
		docs_hash: docs_hash,
		status: 2,
	};
	const jwtusername = req.sign_creds.username;

	Cashier.findOne({ username: jwtusername }, function (err, cashier) {
		let result = errorMessage(
			err,
			cashier,
			"You are either not authorised or not logged in."
		);
		if (result.status == 0) {
			res.status(200).json(result);
		} else {
			User.create(userDetails, function (err) {
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
					let content =
						"<p>You are added as a User in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
						config.mainIP +
						"/user/" +
						bank +
						"'>http://" +
						config.mainIP +
						"/user/" +
						bank +
						"</a></p><p><p>Your username: " +
						mobile +
						"</p><p>Your password: " +
						password +
						"</p>";
					sendMail(content, "Ewallet account created", email);
					let content2 =
						"You are added as a User in E-Wallet application Login URL: http://" +
						config.mainIP +
						"/user/" +
						bank +
						" Your username: " +
						mobile +
						" Your password: " +
						password;
					sendSMS(content2, mobile);
					res.status(200).json({
						status: 1,
						message: "User created",
					});
				}
			});
		}
	});
});

router.post("/cashier/editUser", jwtTokenAuth, function (req, res) {
	const {
		name,
		last_name,
		mobile,
		email,
		address,
		city,
		state,
		country,
		id_type,
		id_name,
		valid_till,
		id_number,
		dob,
		gender,
		docs_hash,
	} = req.body;
	var userDetails = {
		name: name,
		last_name: last_name,
		email: email,
		address: address,
		city: city,
		state: state,
		country: country,
		id_type: id_type,
		id_name: id_name,
		valid_till: valid_till,
		id_number: id_number,
		dob: dob,
		gender: gender,
		docs_hash: docs_hash,
	};
	for (let detail in userDetails) {
		if (userDetails[detail] == "" || userDetails[detail] == []) {
			delete userDetails[detail];
		}
	}
	const jwtusername = req.sign_creds.username;
	Cashier.findOne({ username: jwtusername }, function (err, cashier) {
		let result = errorMessage(
			err,
			cashier,
			"You are either not authorised or not logged in."
		);
		if (result.status == 0) {
			res.status(200).json(result);
		} else {
			User.findOneAndUpdate(
				{ mobile },
				{ $set: userDetails },
				function (err, user) {
					let result = errorMessage(err, user, "User not found");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						res.status(200).json({
							status: 1,
							message: "edit successfull",
						});
					}
				}
			);
		}
	});
});

router.post("/cashier/activateUser", jwtTokenAuth, function (req, res) {
	try {
		const { mobile } = req.body;
		const jwtusername = req.sign_creds.username;
		Cashier.findOne(
			{
				username: jwtusername,
			},
			function (err, cashier) {
				let result = errorMessage(
					err,
					cashier,
					"You are either not authorised or not logged in."
				);
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					Bank.findOne({ _id: cashier.bank_id }, async (err, bank) => {
						let result = errorMessage(
							err,
							cashier,
							"You are either not authorised or not logged in."
						);
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							try {
								let wallet_id = getWalletIds("user", mobile, bank.bcode);
								let result = await blockchain.createWallet([wallet_id]);
								if (result != "" && !result.includes("wallet already exists")) {
									console.log(result);
									res.status(200).json({
										status: 0,
										message:
											"Blockchain service was unavailable. Please try again.",
										result: result,
									});
								} else {
									User.findOneAndUpdate(
										{ mobile },
										{
											$set: {
												status: 1,
												wallet_id: wallet_id,
											},
										},
										function (err, user) {
											let result = errorMessage(err, user, "User not found");
											if (result.status == 0) {
												res.status(200).json(result);
											} else {
												let content =
													"<p>Your account is activated</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
													config.mainIP +
													"/user";
												"'>http://" +
													config.mainIP +
													"/user" +
													"</a></p><p><p>Your username: " +
													mobile +
													"</p><p>Your password: " +
													user.password +
													"</p>";
												sendMail(
													content,
													"Approved Ewallet Account",
													user.email
												);
												let content2 =
													"Your account is activated. Login URL: http://" +
													config.mainIP +
													"/user" +
													" Your username: " +
													mobile +
													" Your password: " +
													user.password;
												sendSMS(content2, mobile);
												res.status(200).json({
													status: 1,
													message: result.toString(),
												});
											}
										}
									);
								}
							} catch (err) {
								console.log(err);
								res.status(200).json({
									status: 0,
									message: err.message,
								});
							}
						}
					});
				}
			}
		);
	} catch (err) {
		console.log(err);
		var message = err.toString();
		if (err.message) {
			message = err.message;
		}
		res.status(200).json({
			status: 0,
			message: message,
			err: err,
		});
	}
});

router.post("/getCashierDashStats", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
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
				res.status(200).json({
					status: 1,
					openingBalance: user.opening_balance,
					closingBalance: user.closing_balance,
					cashPaid: user.cash_paid,
					cashReceived: user.cash_received,
					cashInHand: user.cash_in_hand,
					feeGenerated: user.fee_generated,
					commissionGenerated: user.commission_generated,
					closingTime: user.closing_time,
					transactionStarted: user.transaction_started,
					branchId: user.branch_id,
					isClosed: user.is_closed,
				});
			}
		}
	);
});

router.post("/getCashierIncomingTransfer", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
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
				CashierTransfer.find(
					{
						receiver_id: user._id,
						status: 0,
					},
					(e, data) => {
						res.status(200).json({
							status: 1,
							result: data,
						});
					}
				);
			}
		}
	);
});

router.post("/cashierAcceptIncoming", jwtTokenAuth, function (req, res) {
	const { item } = req.body;
	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
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
				Cashier.findOne(
					{
						_id: item.receiver_id,
					},
					function (err, u) {
						let result = errorMessage(
							err,
							u,
							"Token changed or user not valid. Try to login again or contact system administrator."
						);
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							let cashInHand = Number(u.cash_in_hand) + Number(item.amount);
							CashierTransfer.findByIdAndUpdate(
								item._id,
								{
									status: 1,
								},
								(e, data) => {
									Cashier.findByIdAndUpdate(
										item.receiver_id,
										{
											cash_in_hand: cashInHand,
										},
										(err, data) => {
											let result = errorMessage(
												err,
												data,
												"Cashier transfer record not found"
											);
											if (result.status == 0) {
												res.status(200).json(result);
											} else {
												res.status(200).json({
													status: 1,
													message: "Success",
												});
											}
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
});

router.post("/getClosingBalance", jwtTokenAuth, function (req, res) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";

	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
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
				let cb = 0,
					cr = 0,
					dr = 0;
				var c = user;

				cb = c.closing_balance;
				da = c.closing_time;
				var diff = Number(cb) - Number(user.cash_in_hand);
				res.status(200).json({
					status: 1,
					cashInHand: user.cash_in_hand,
					balance1: cb,
					balance2: diff,
					lastdate: da,
					transactionStarted: c.transaction_started,
					isClosed: c.is_closed,
				});
			}
		}
	);
});

router.post("/openCashierBalance", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, ba) {
			let result = errorMessage(
				err,
				ba,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				var bal =
					Number(ba.closing_balance) > 0
						? ba.closing_balance
						: ba.opening_balance;
				upd = {
					opening_balance: bal,
					cash_received: 0,
					fee_generated: 0,
					cash_paid: 0,
					closing_balance: 0,
					closing_time: null,
					transaction_started: true,
					is_closed: false,
				};
				console.log(upd);

				Cashier.findByIdAndUpdate(ba._id, upd, (err) => {
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
							message: "Cashier account is open now",
						});
					}
				});
			}
		}
	);
});

router.post("/addClosingBalance", jwtTokenAuth, function (req, res) {
	const { denomination, total, note } = req.body;
	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
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
				data.cashier_id = otpd._id;
				data.trans_type = "CB";
				let td = {
					denomination,
					note,
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
							otpd._id,
							{
								closing_balance: total,
								closing_time: new Date(),
								is_closed: true,
							},
							function (e, v) {}
						);

						res.status(200).json({
							status: 1,
							message: "Added Successfully",
						});
					}
				});
			}
		}
	);
});

router.post("/getCashierTransfers", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
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
				CashierTransfer.find({
					$or: [{ sender_id: f._id }, { receiver_id: f._id }],
				}).exec(function (err, b) {
					res.status(200).json({
						status: 1,
						history: b,
					});
				});
			}
		}
	);
});

router.post("/cashierCancelTransfer", jwtTokenAuth, function (req, res) {
	const { otpId, otp, transfer_id } = req.body;

	// const transactionCode = makeid(8);

	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
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
							CashierTransfer.findOne(
								{
									_id: transfer_id,
								},
								function (err, item) {
									let result = errorMessage(
										err,
										item,
										"Token changed or user not valid. Try to login again or contact system administrator."
									);
									if (result.status == 0) {
										res.status(200).json(result);
									} else {
										Cashier.findOne(
											{
												_id: item.sender_id,
											},
											function (err, u) {
												let result = errorMessage(
													err,
													u,
													"Token changed or user not valid. Try to login again or contact system administrator."
												);
												if (result.status == 0) {
													res.status(200).json(result);
												} else {
													let cashInHand =
														Number(u.cash_in_hand) + Number(item.amount);
													CashierTransfer.findByIdAndUpdate(
														item._id,
														{
															status: -1,
														},
														(e, data) => {
															Cashier.findByIdAndUpdate(
																item.sender_id,
																{
																	cash_in_hand: cashInHand,
																},
																(e, data) => {
																	res.status(200).json({
																		status: 1,
																	});
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
						}
					}
				);
			}
		}
	); //branch
});

router.post("/getCashierTransLimit", jwtTokenAuth, function (req, res) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";

	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, t1) {
			let result = errorMessage(
				err,
				t1,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				let limit =
					Number(t1.max_trans_amt) -
					(Number(t1.cash_received) + Number(t1.cash_paid));
				limit = limit < 0 ? 0 : limit;
				res.status(200).json({
					status: 1,
					limit: limit,
					closingTime: t1.closing_time,
					transactionStarted: t1.transaction_started,
					cashInHand: t1.cash_in_hand,
					isClosed: t1.is_closed,
				});
			}
		}
	);
});

router.post("/getCashier", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, t1) {
			let result = errorMessage(
				err,
				t1,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Cashier.findOne({ _id: t1._id }, function (err, data) {
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
						BankUser.findOne({ _id: data.bank_user_id }, function (err, data2) {
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
									row: data,
									row2: data2,
								});
							}
						});
					}
				});
			}
		}
	);
});

router.post("/checkCashierFee", jwtTokenAuth, function (req, res) {
	var { amount, trans_type } = req.body;

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
				const find = {
					bank_id: cashier.bank_id,
					trans_type: trans_type,
					status: 1,
					active: "Active",
				};
				Fee.findOne(find, function (err, fe) {
					let result = errorMessage(
						err,
						fe,
						"Transaction cannot be done at this time"
					);
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						amount = Number(amount);
						var temp;
						fe.ranges.map((range) => {
							console.log(range);
							if (amount >= range.trans_from && amount <= range.trans_to) {
								temp = (amount * range.percentage) / 100;
								fee = temp + range.fixed;
								res.status(200).json({
									status: 1,
									fee: fee,
								});
							}
						});
					}
				});
			}
		}
	);
});

router.post("/cashierVerifyOTPClaim", jwtTokenAuth, function (req, res) {
	const { transferCode, otp } = req.body;

	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
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
				CashierSend.findOne(
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
								message: "Claim OTP verified",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/cashierSendMoney", jwtTokenAuth, function (req, res) {
	// const master_code = getTransactionCode();
	// state.intiate(master_code);
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	var now = new Date().getTime();

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
	} = req.body;

	const transactionCode = makeid(8);

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
													data.cashier_id = cashier._id;
													data.transaction_code = transactionCode;
													data.rule_type = "Non Wallet to Non Wallet";
													// data.master_code = master_code;

													var mns = branch.mobile.slice(-2);
													var mnr = bank.mobile.slice(-2);
													var master_code = mns + "" + mnr + "" + now;
													var child_code = mns + "" + mnr + "" + now;
													data.master_code = master_code;
													data.child_code = child_code;

													//send transaction sms after actual transaction

													data.without_id = withoutID ? 1 : 0;
													if (requireOTP) {
														data.require_otp = 1;
														data.otp = makeotp(6);
														content =
															data.otp + " - Send this OTP to the Receiver";
														if (mobile && mobile != null) {
															sendSMS(content, mobile);
														}
														if (email && email != null) {
															sendMail(content, "Transaction OTP", email);
														}
													}

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
																	const transfer = {
																		amount: receiverIdentificationAmount,
																		isInclusive: isInclusive,
																		// master_code: master_code,
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

																				CashierSend.findByIdAndUpdate(
																					d._id,
																					{
																						status: 1,
																						fee: result.fee,
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
																							Cashier.findByIdAndUpdate(
																								cashier._id,
																								{
																									cash_received:
																										Number(
																											cashier.cash_received
																										) +
																										Number(result.amount) +
																										Number(result.fee),
																									cash_in_hand:
																										Number(
																											cashier.cash_in_hand
																										) +
																										Number(result.amount) +
																										Number(result.fee),
																									fee_generated:
																										Number(result.sendFee) +
																										Number(
																											cashier.fee_generated
																										),

																									total_trans:
																										Number(
																											cashier.total_trans
																										) + 1,
																								},
																								function (e, v) {}
																							);
																						}

																						CashierLedger.findOne(
																							{
																								cashier_id: cashier._id,
																								trans_type: "CR",
																								created_at: {
																									$gte: new Date(start),
																									$lte: new Date(end),
																								},
																							},
																							function (err, c) {
																								if (err || c == null) {
																									let data = new CashierLedger();
																									data.amount =
																										Number(result.amount) +
																										Number(result.fee);
																									data.trans_type = "CR";
																									data.transaction_details = JSON.stringify(
																										{
																											fee: result.fee,
																										}
																									);
																									data.cashier_id = cashier._id;
																									data.save(function (
																										err,
																										c
																									) {});
																								} else {
																									var amt =
																										Number(c.amount) +
																										Number(result.amount) +
																										Number(result.fee);
																									CashierLedger.findByIdAndUpdate(
																										c._id,
																										{ amount: amt },
																										function (err, c) {}
																									);
																								}
																							}
																						);
																						// state.waitForCompletion(
																						// 	master_code,
																						// 	result.transaction
																						// );
																						res.status(200).json({
																							status: 1,
																							message: "success",
																						});
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
		}
	);
});

router.post("/cashier/sendMoneyToWallet", jwtTokenAuth, function (req, res) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	var now = new Date().getTime();

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
																};
																data.receiver_info = JSON.stringify(temp);
																data.amount = receiverIdentificationAmount;
																data.is_inclusive = isInclusive;
																data.cashier_id = cashier._id;
																data.rule_type = "Non Wallet to Wallet";

																var mns = branch.mobile.slice(-2);
																var mnr = bank.mobile.slice(-2);
																var master_code = mns + "" + mnr + "" + now;
																var child_code = mns + "" + mnr + "" + now;
																data.master_code = master_code;
																data.child_code = child_code;

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
																		sendMail(content, "Transaction OTP", email);
																	}
																}

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
																				const transfer = {
																					amount: receiverIdentificationAmount,
																					isInclusive: isInclusive,
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
																						if (result.length == 1) {
																							CashierSend.findByIdAndUpdate(
																								d._id,
																								{
																									status: 1,
																									fee: result.fee,
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
																													Number(result.fee),
																												cash_in_hand:
																													Number(
																														cashier.cash_in_hand
																													) +
																													Number(
																														result.amount
																													) +
																													Number(result.fee),
																												fee_generated:
																													Number(sendFee) +
																													Number(
																														cashier.fee_generated
																													),

																												total_trans:
																													Number(
																														cashier.total_trans
																													) + 1,
																											},
																											function (e, v) {}
																										);

																										CashierLedger.findOne(
																											{
																												cashier_id: cashier._id,
																												trans_type: "CR",
																												created_at: {
																													$gte: new Date(start),
																													$lte: new Date(end),
																												},
																											},
																											function (err, c) {
																												if (err || c == null) {
																													let data = new CashierLedger();
																													data.amount =
																														Number(
																															result.amount
																														) +
																														Number(result.fee);
																													data.trans_type =
																														"CR";
																													data.transaction_details = JSON.stringify(
																														{
																															fee: result.fee,
																														}
																													);
																													data.cashier_id =
																														cashier._id;
																													data.save(function (
																														err,
																														c
																													) {});
																												} else {
																													var amt =
																														Number(c.amount) +
																														Number(
																															result.amount
																														) +
																														Number(result.fee);
																													CashierLedger.findByIdAndUpdate(
																														c._id,
																														{
																															amount: amt,
																														},
																														function (err, c) {}
																													);
																												}
																											}
																										);
																										res.status(200).json({
																											status: 1,
																											message:
																												receiverIdentificationAmount +
																												"XOF amount is Transferred",
																										});
																									}
																								}
																							);
																						} else {
																							res.status(200).json(result);
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
					}
				);
			}
		}
	);
});

router.post("/cashierSendMoneyPending", jwtTokenAuth, function (req, res) {
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
		livefee,
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
	} = req.body;

	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
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
				let data = new CashierPending();
				let temp = {
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
					livefee,
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
				};
				data.sender_name = givenname + " " + familyname;
				data.receiver_name = receiverGivenName + " " + receiverFamilyName;
				data.amount = receiverIdentificationAmount;
				data.transaction_details = JSON.stringify(temp);
				data.cashier_id = f._id;

				let pending = Number(f.pending_trans) + 1;

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
						Cashier.findByIdAndUpdate(
							f._id,
							{ pending_trans: pending },
							function (e, d) {
								if (e && d == null) {
									res.status(200).json({
										status: 0,
										message: e.toString(),
									});
								} else {
									res.status(200).json({
										status: 1,
										message: "Pending to send money record saved.",
									});
								}
							}
						);
					}
				}); //save
			}
		}
	);
});

router.post("/cashierTransferMoney", jwtTokenAuth, function (req, res) {
	const { otpId, otp, amount, receiver_id, receiver_name } = req.body;

	// const transactionCode = makeid(8);

	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
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
							let data = new CashierTransfer();
							data.amount = amount;
							data.sender_id = f._id;
							data.receiver_id = receiver_id;
							data.sender_name = f.name;
							data.receiver_name = receiver_name;
							let cashInHand = Number(f.cash_in_hand);
							cashInHand = cashInHand - Number(amount);
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
										f._id,
										{ cash_in_hand: cashInHand, cash_transferred: amount },
										function (e, d) {
											if (e)
												res.status(200).json({
													status: 0,
													message: e.toString(),
												});
											else
												res.status(200).json({
													status: 1,
													message: "Money transferred record saved",
												});
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
});

router.post("/cashierVerifyClaim", jwtTokenAuth, function (req, res) {
	const { otpId, otp } = req.body;

	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
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
								message: "Cashier verify claim success",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/cashierClaimMoney", jwtTokenAuth, function (req, res) {
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
		mobile,
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
								function (err, otpd) {
									let result = errorMessage(err, otpd, "Transaction Not Found");
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
																let data = new CashierClaim();
																data.transaction_code = transferCode;
																data.proof = proof;
																data.cashier_id = cashier._id;
																data.amount = otpd.amount;
																data.fee = otpd.fee;
																data.is_inclusive = otpd.is_inclusive;
																data.sender_name = givenname + " " + familyname;
																data.sender_mobile = mobile;
																data.receiver_name =
																	receiverGivenName + " " + receiverFamilyName;
																var mns = bank.mobile.slice(-2);
																var mnr = branch.mobile.slice(-2);
																var now = new Date().getTime();
																var child_code = mns + "" + mnr + "" + now;
																var master_code = otpd.master_code;
																data.master_code = master_code;
																data.child_code = child_code + "1";

																data.save((err, cashierClaimObj) => {
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
																			bank_id: cashier.bank_id,
																			trans_type: otpd.rule_type,
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
																				const transfer = {
																					amount: otpd.amount,
																					isInclusive: otpd.is_inclusive,
																				};
																				cashierClaimMoney(
																					transfer,
																					bank,
																					branch,
																					rule
																				)
																					.then(function (result) {
																						if (result.length == 1) {
																							CashierClaim.findByIdAndUpdate(
																								cashierClaimObj._id,
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
																										Cashier.findByIdAndUpdate(
																											f._id,
																											{
																												cash_paid:
																													Number(f.cash_paid) +
																													Number(result.amount),
																												cash_in_hand:
																													Number(
																														f.cash_in_hand
																													) -
																													Number(result.amount),
																												fee_generated:
																													Number(
																														f.fee_generated
																													) +
																													Number(
																														result.claimFee
																													),

																												total_trans:
																													Number(
																														f.total_trans
																													) + 1,
																											},
																											function (e, v) {}
																										);
																										CashierLedger.findOne(
																											{
																												cashier_id: f._id,
																												trans_type: "DR",
																												created_at: {
																													$gte: new Date(start),
																													$lte: new Date(end),
																												},
																											},
																											function (err, c) {
																												if (err || c == null) {
																													let data = new CashierLedger();
																													data.amount = Number(
																														result.amount
																													);
																													data.trans_type =
																														"DR";
																													data.cashier_id =
																														f._id;
																													data.save(function (
																														err,
																														c
																													) {
																														res
																															.status(200)
																															.json({
																																status: 1,
																																message:
																																	"Cashier claimed money",
																															});
																													});
																												} else {
																													var amt =
																														Number(c.amount) +
																														Number(
																															result.amount
																														);
																													CashierLedger.findByIdAndUpdate(
																														c._id,
																														{
																															amount: amt,
																														},
																														function (err, c) {
																															res
																																.status(200)
																																.json({
																																	status: 1,
																																	message:
																																		"Cashier claimed money",
																																});
																														}
																													);
																												}
																											}
																										);
																									}
																								}
																							);
																						} else {
																							console.log(result.toString());
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
																		});
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
});

router.post("/getClaimMoney", jwtTokenAuth, function (req, res) {
	const { transferCode } = req.body;

	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
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
				CashierClaim.findOne(
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
							CashierSend.findOne(
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

module.exports = router;
