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
const cashierCommonContrl = require("../controllers/cashier/common");

//services
const blockchain = require("../services/Blockchain.js");

const Infra = require("../models/Infra");
const TxState = require("../models/TxState");
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
const DailyReport = require("../models/cashier/DailyReport");
const Invoice = require("../models/merchant/Invoice");

//controllers
const cashSendTransCntrl = require("../controllers/cashier/sendTransaction");
const cashClaimTransCntrl = require("../controllers/cashier/claimTransaction");
const cashCancelTransCntrl = require("../controllers/cashier/cancelTransaction");

router.post(
	"/:user/checkCancelReqStatus",
	jwtTokenAuth,
	cashCancelTransCntrl.checkApprovalStatus
);

router.post(
	"/:user/sendCancelReqForApproval",
	jwtTokenAuth,
	cashCancelTransCntrl.sendForApproval
);
router.post(
	"/:user/cancelTransaction",
	jwtTokenAuth,
	cashCancelTransCntrl.cancelTransaction
);
router.post(
	"/cashier/sendToOperational",
	jwtTokenAuth,
	cashSendTransCntrl.cashierSendToOperational
);

router.post(
	"/cashier/queryTransactionStates",
	jwtTokenAuth,
	cashierCommonContrl.queryTransactionStates
);

router.post(
	"/cashier/addDailyReport",
	jwtTokenAuth,
	cashierCommonContrl.addDailyReport
);

router.post(
	"/cashier/queryDailyReport",
	jwtTokenAuth,
	cashierCommonContrl.queryDailyReport
);

router.post(
	"/cashier/getDailyReport",
	jwtTokenAuth,
	function (req, res) {
		const { start, end } = req.body;
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
					DailyReport.find(
						{ 	cashier_id: cashier._id,
							created_at: {
								$gte: new Date(
									start
								),
								$lte: new Date(
									end
								),
							},
						},
						(err1, reports) => {
							if (err1) {
								res.status(200).json(catchError(err1));
							} else {
								res.status(200).json({ status: 1, reports: reports });
							}
						}
					);
				}
			}
		);
	}
);

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
				let errMsg = errorMessage(
					err,
					cashier,
					"Token changed or user not valid. Try to login again or contact system administrator."
				);
				if (errMsg.status == 0) {
					res.status(200).json(errMsg);
				} else {
					Branch.findOne({ _id: cashier.branch_id }, (err1, branch) => {
						let errMsg1 = errorMessage(err1, branch, "Branch not found.");
						if (errMsg1.status == 0) {
							res.status(200).json(errMsg1);
						} else {
							Bank.findOne({ _id: branch.bank_id }, (err2, bank) => {
								let errMsg2 = errorMessage(err2, bank, "Bank not found.");
								if (errMsg2.status == 0) {
									res.status(200).json(errMsg2);
								} else {
									CashierPending.find(
										{ cashier_id: cashier._id },
										async (err3, pending) => {
											let errMsg3 = errorMessage(
												err3,
												pending,
												"History not found."
											);
											if (errMsg.status == 0) {
												res.status(200).json(errMsg3);
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
														pending: pending,
													});
												} catch (error) {
													res.status(200).json(catchError(error));
												}
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
					(err1, merchants) => {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
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
				User.findOne({ mobile }, "-password", function (err1, user) {
					let result1 = errorMessage(err1, user, "User not found");
					if (result1.status == 0) {
						res.status(200).json(result1);
					}else if(user.bank_id == null || user.bank_id == undefined ){
						res.status(200).json({
							status: 0,
							message: "User Not Found",
						});
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
						function (err1, setting) {
							if (err1) {
								console.log(err1);
								var message1 = err1;
								if (err1.message) {
									message1 = err1.message;
								}
								res.status(200).json({
									status: 0,
									message: message1,
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
			User.create(userDetails, function (err1) {
				if (err1) {
					console.log(err1);
					var message1 = err1;
					if (err1.message) {
						message1 = err1.message;
					}
					res.status(200).json({
						status: 0,
						message: message1,
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
				function (err1, user) {
					let result1 = errorMessage(err1, user, "User not found");
					if (result1.status == 0) {
						res.status(200).json(result1);
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
				let errMsg = errorMessage(
					err,
					cashier,
					"You are either not authorised or not logged in."
				);
				if (errMsg.status == 0) {
					res.status(200).json(errMsg);
				} else {
					Bank.findOne({ _id: cashier.bank_id }, async (err1, bank) => {
						let errMsg1 = errorMessage(
							err1,
							cashier,
							"You are either not authorised or not logged in."
						);
						if (errMsg.status == 0) {
							res.status(200).json(errMsg1);
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
										function (err2, user) {
											let errMsg2 = errorMessage(err2, user, "User not found");
											if (errMsg2.status == 0) {
												res.status(200).json(errMsg2);
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
							} catch (errot) {
								console.log(error);
								res.status(200).json({
									status: 0,
									message: error.message,
								});
							}
						}
					});
				}
			}
		);
	} catch (error) {
		console.log(error);
		var message0 = error.toString();
		if (error.message) {
			message0 = error.message;
		}
		res.status(200).json({
			status: 0,
			message: message0,
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
					function (err1, u) {
						let result1 = errorMessage(
							err1,
							u,
							"Token changed or user not valid. Try to login again or contact system administrator."
						);
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							let cashInHand = Number(u.cash_in_hand) + Number(item.amount);
							CashierTransfer.findByIdAndUpdate(
								item._id,
								{
									status: 1,
								},
								(e2, data) => {
									Cashier.findByIdAndUpdate(
										item.receiver_id,
										{
											cash_in_hand: cashInHand,
										},
										(err2, data2) => {
											let result2 = errorMessage(
												err2,
												data2,
												"Cashier transfer record not found"
											);
											if (result2.status == 0) {
												res.status(200).json(result2);
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
	let today = new Date();
	today = today.toISOString();

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
				let cb = 0;
				var c = user;

				cb = c.closing_balance;
				let da = c.closing_time;
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
				const upd = {
					opening_balance: bal,
					cash_received: 0,
					fee_generated: 0,
					commission_generated: 0,
					cash_paid: 0,
					closing_balance: 0,
					cash_paid_fee: 0,
					cash_paid_commission: 0,
					cash_received_fee: 0,
					cash_received_commission: 0,
					closing_time: null,
					opening_time: new Date(),
					transaction_started: true,
					is_closed: false,
				};
				console.log(upd);

				Cashier.findByIdAndUpdate(ba._id, upd, (err1) => {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message) {
							message1 = err1.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
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
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				let data = new DailyReport();
				data.cashier_id = cashier._id;
				data.branch_id = cashier.branch_id;
				data.bank_id = cashier.bank_id;
				data.created_at = new Date();
				data.user = "Cashier";
				data.total_trans = cashier.total_trans;
				data.denomination = denomination;
				data.note = note;
				data.cash_received_fee = cashier.cash_received_fee;
				data.cash_received_commission = cashier.cash_received_commission;
				data.cash_paid_fee = cashier.cash_paid_fee;
				data.cash_paid_commission = cashier.cash_paid_commission;
				data.paid_in_cash = cashier.cash_paid;
				data.cash_received = cashier.cash_received;
				data.fee_generated = cashier.fee_generated;
				data.comm_generated = cashier.commission_generated;
				data.opening_balance = cashier.opening_balance;
				data.closing_balance =  total;
				data.cash_in_hand = cashier.cash_in_hand;
				data.opening_time = cashier.opening_time;
				data.closing_time = new Date();
				data.descripency =  total - cashier.cash_in_hand;
					data.save((err1) => {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
					} else {
						Cashier.findByIdAndUpdate(
							cashier._id,
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
				}).exec(function (err1, b) {
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
					function (err1, otpd) {
						let result1 = errorMessage(err1, otpd, "OTP Missmatch");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							CashierTransfer.findOne(
								{
									_id: transfer_id,
								},
								function (err2, item) {
									let result2 = errorMessage(
										err2,
										item,
										"Token changed or user not valid. Try to login again or contact system administrator."
									);
									if (result2.status == 0) {
										res.status(200).json(result2);
									} else {
										Cashier.findOne(
											{
												_id: item.sender_id,
											},
											function (err3, u) {
												let result3 = errorMessage(
													err3,
													u,
													"Token changed or user not valid. Try to login again or contact system administrator."
												);
												if (result3.status == 0) {
													res.status(200).json(result3);
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
																(e2, data2) => {
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
	let today = new Date();
	today = today.toISOString();

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
					openingTime: t1.opening_time,
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
				Cashier.findOne({ _id: t1._id }, function (err1, data) {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message) {
							message1 = err1.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else {
						BankUser.findOne({ _id: data.bank_user_id }, function (err2, data2) {
							if (err2) {
								console.log(err2);
								var message2 = err2;
								if (err2.message) {
									message2 = err2.message;
								}
								res.status(200).json({
									status: 0,
									message: message2,
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
				Fee.findOne(find, function (err1, fe) {
					let result1 = errorMessage(
						err1,
						fe,
						"Transaction cannot be done at this time"
					);
					if (result1.status == 0) {
						res.status(200).json(result1);
					} else {
						amount = Number(amount);
						var temp;
						fe.ranges.map((range) => {
							console.log(range);
							if (amount >= range.trans_from && amount <= range.trans_to) {
								temp = (amount * range.percentage) / 100;
								let fee = temp + range.fixed;
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
					function (err1, otpd) {
						let result1 = errorMessage(err1, otpd, "OTP Missmatch");
						if (result1.status == 0) {
							res.status(200).json(result1);
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

router.post(
	"/cashierSendMoney",
	jwtTokenAuth,
	cashSendTransCntrl.cashierSendMoney
);

router.post(
	"/cashier/sendMoneyToWallet",
	jwtTokenAuth,
	cashSendTransCntrl.cashierSendMoneyToWallet
);

router.post("/cashierSendMoneyPending", jwtTokenAuth, function (req, res) {
	const {
		type,
		interbank,
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
		transferCode,
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
					transferCode,
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
				data.trans_type = type;
				data.interbank = interbank;

				let pending = Number(f.pending_trans) + 1;

				data.save((err1, de) => {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message) {
							message1 = err1.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
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
					function (err1, otpd) {
						let result1 = errorMessage(err1, otpd, "OTP Missmatch");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							let data = new CashierTransfer();
							data.amount = amount;
							data.sender_id = f._id;
							data.branch_id = f.branch_id;
							data.receiver_id = receiver_id;
							data.sender_name = f.name;
							data.receiver_name = receiver_name;
							let cashInHand = Number(f.cash_in_hand);
							cashInHand = cashInHand - Number(amount);
							data.save((err2) => {
								if (err2) {
									console.log(err2);
									var message2 = err2;
									if (err2.message) {
										message2 = err2.message;
									}
									res.status(200).json({
										status: 0,
										message: message2,
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
					function (err10, otpd) {
						let result1 = errorMessage(err1, otpd, "OTP Missmatch");
						if (result1.status == 0) {
							res.status(200).json(result1);
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

router.post(
	"/cashierClaimMoney",
	jwtTokenAuth,
	cashClaimTransCntrl.cashierClaimMoney
);

router.post("/cashierSearchPaidInvoiceByMobile", jwtTokenAuth, function (req, res) {
	const { mobile } = req.body;
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
				Invoice.find(
					{ 	paid: 1,
						mobile: mobile,
					},
					(err1, invoices) => {
						if (err1) {
							res.status(200).json(catchError(err1));
						} else {
							res.status(200).json({
								status: 1,
								message: "List of paid invoices",
								invoices: invoices,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/cashierSearchPaidInvoiceByBillNumber", jwtTokenAuth, function (req, res) {
	const { number } = req.body;
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
				Invoice.find(
					{ 	paid: 1,
						$or: [{ number: number }, { reference_invoice: number }],
					},
					(err1, invoices) => {
						if (err1) {
							res.status(200).json(catchError(err1));
						} else {
							res.status(200).json({
								status: 1,
								message: "List of paid invoices",
								invoices: invoices,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/cashierSearchPaidInvoiceByCustomerCode", jwtTokenAuth, function (req, res) {
	const { customer_code } = req.body;
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
				Invoice.find(
					{ 	paid: 1,
						customer_code: customer_code,
					},
					(err1, invoices) => {
						if (err1) {
							res.status(200).json(catchError(err1));
						} else {
							res.status(200).json({
								status: 1,
								message: "List of paid invoices",
								invoices: invoices,
							});
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
					function (err1, cs) {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						} else if (cs == null) {
							CashierSend.findOne(
								{
									transaction_code: transferCode,
								},
								function (err2, cs2) {
									if (err2) {
										console.log(err2);
										var message2 = err2;
										if (err2.message) {
											message2 = err2.message;
										}
										res.status(200).json({
											status: 0,
											message: message2,
										});
									} else if (cs2 == null) {
										res.status(200).json({
											status: 0,
											message: "Record Not Found",
										});
									} else {
										res.status(200).json({
											status: 1,
											row: cs2,
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
