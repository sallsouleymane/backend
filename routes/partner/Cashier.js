const express = require("express");
const router = express.Router();
const config = require("../../config.json");
const jwtTokenAuth = require("../JWTTokenAuth");

//utils
const { errorMessage, catchError } = require("../utils/errorHandler");
const getWalletIds = require("../utils/getWalletIds");
const blockchain = require("../../services/Blockchain");
const sendMail = require("../utils/sendMail");
const sendSMS = require("../utils/sendSMS");

//models
const TxState = require("../../models/TxState");
const Partner = require("../../models/partner/Partner");
const PartnerBranch = require("../../models/partner/Branch");
const PartnerCashier = require("../../models/partner/Cashier");
const PartnerUser = require("../../models/partner/User");
const Bank = require("../../models/Bank");
const Fee = require("../../models/Fee");
const CashierSend = require("../../models/CashierSend");
const CashierPending = require("../../models/CashierPending");
const CashierClaim = require("../../models/CashierClaim");
const CashierLedger = require("../../models/CashierLedger");
const CashierTransfer = require("../../models/CashierTransfer");
const OTP = require("../../models/OTP");
const Merchant = require("../../models/merchant/Merchant");
const MerchantSettings = require("../../models/merchant/MerchantSettings");
const User = require("../../models/User");

//controllers
const cashSendTransCntrl = require("../../controllers/cashier/sendTransaction");
const cashClaimTransCntrl = require("../../controllers/cashier/claimTransaction");
const { queryTxStates } = require("../../controllers/utils/common");

router.post(
	"/partnerCashier/sendToOperational",
	jwtTokenAuth,
	cashSendTransCntrl.partnerSendToOperational
);

router.post("/partnerCashier/queryTransactionStates", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { bank_id } = req.body;
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
				queryTxStates(
					bank_id,
					cashier._id,
					req,
					function (err, txstates) {
						if (err) {
							res.status(200).json(catchError(err));
						} else {
							res.status(200).json({
								status: 1,
								transactions: txstates,
							});
						}
					}
				);
			}
		}
	);
});

router.post(
	"/partnerCashier/getFailedTransactions",
	jwtTokenAuth,
	function (req, res) {
		const { bank_id } = req.body;
		const jwtusername = req.sign_creds.username;
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
					TxState.find({ bankId: bank_id }, (err, txstates) => {
						if (err) {
							res.status(200).json(catchError(err));
						} else {
							res.status(200).json({
								status: 1,
								transactions: txstates,
							});
						}
					});
				}
			}
		);
	}
);

router.post(
	"/partnerCashier/getUserByMobile",
	jwtTokenAuth,
	function (req, res) {
		const { mobile } = req.body;
		const jwtusername = req.sign_creds.username;
		PartnerCashier.findOne(
			{ username: jwtusername, status: 1 },
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
	}
);

router.post("/partnerCashier/getDetails", jwtTokenAuth, function (req, res) {
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
				PartnerUser.findOne(
					{ _id: cashier.partner_user_id },
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
						} else {
							res.status(200).json({
								cashier: cashier,
								user: user,
							});
						}
					}
				);
			}
		}
	);
});

router.post(
	"/partnerCashier/getMerchantPenaltyRule",
	jwtTokenAuth,
	function (req, res) {
		const jwtusername = req.sign_creds.username;
		const merchant_id = req.body.merchant_id;
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

router.post(
	"/partnerCashier/sendMoneyToWallet",
	jwtTokenAuth,
	cashSendTransCntrl.partnerSendMoneyToWallet
);

router.post(
	"/partnerCashier/sendMoney",
	jwtTokenAuth,
	cashSendTransCntrl.partnerSendMoney
);

router.post(
	"/partnerCashier/claimMoney",
	jwtTokenAuth,
	cashClaimTransCntrl.partnerClaimMoney
);

router.post("/partnerCashier/listMerchants", jwtTokenAuth, function (req, res) {
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

router.post("/partnerCashier/addClosingBalance", jwtTokenAuth, (req, res) => {
	const { denomination, total, note } = req.body;
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
				let data = new CashierLedger();
				data.amount = total;
				data.cashier_id = cashier._id;
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
						PartnerCashier.findByIdAndUpdate(
							cashier._id,
							{
								closing_balance: total,
								closing_time: new Date(),
								is_closed: true,
							},
							function (e, v) {}
						);

						return res
							.status(200)
							.json({ status: 1, message: "Added closing balance" });
					}
				});
			}
		}
	);
});

router.post(
	"/partnerCashier/getClosingBalance",
	jwtTokenAuth,
	function (req, res) {
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
					let cb = 0,
						c = cashier;
					cb = c.closing_balance;
					da = c.closing_time;
					var diff = Number(cb) - Number(cashier.cash_in_hand);
					res.status(200).json({
						cashInHand: cashier.cash_in_hand,
						balance1: cb,
						balance2: diff,
						lastdate: da,
						transactionStarted: c.transaction_started,
						isClosed: c.is_closed,
					});
				}
			}
		);
	}
);

router.post(
	"/partnerCashier/getIncomingTransfer",
	jwtTokenAuth,
	function (req, res) {
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
					CashierTransfer.find(
						{
							receiver_id: cashier._id,
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
	}
);

router.post("/partnerCashier/getTransfers", jwtTokenAuth, function (req, res) {
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
				CashierTransfer.find({
					$or: [{ sender_id: cashier._id }, { receiver_id: cashier._id }],
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

router.post("/partnerCashier/transferMoney", jwtTokenAuth, function (req, res) {
	const { otpId, otp, amount, receiver_id, receiver_name } = req.body;
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
							data.sender_id = cashier._id;
							data.branch_id = cashier.branch_id;
							data.receiver_id = receiver_id;
							data.sender_name = cashier.name;
							data.receiver_name = receiver_name;
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
									PartnerCashier.findByIdAndUpdate(
										cashier._id,
										{
											$inc: { cash_in_hand: -Number(amount) },
											cash_transferred: amount,
										},
										function (e, d) {
											if (e) {
												return res.status(200).json({
													status: 0,
													message: e.toString(),
												});
											} else {
												res.status(200).json({
													status: 1,
													message: "Money transferred record saved",
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
	); //branch
});

router.post("/partnerCashier/editUser", jwtTokenAuth, function (req, res) {
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

router.post("/partnerCashier/createUser", jwtTokenAuth, function (req, res) {
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

router.post("/partnerCashier/activateUser", jwtTokenAuth, function (req, res) {
	try {
		const { mobile } = req.body;
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
					Bank.findOne({ _id: cashier.bank_id }, async (err, bank) => {
						let errMsg = errorMessage(
							err,
							bank,
							"You are either not authorised or not logged in."
						);
						if (errMsg.status == 0) {
							res.status(200).json(errMsg);
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
											let errMsg = errorMessage(err, user, "User not found");
											if (errMsg.status == 0) {
												res.status(200).json(errMsg);
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

router.post(
	"/partnerCashier/acceptIncoming",
	jwtTokenAuth,
	function (req, res) {
		const { receiver_id, amount, transfer_id } = req.body;
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
					PartnerCashier.findByIdAndUpdate(
						{
							_id: receiver_id,
						},
						{
							$inc: { cash_in_hand: Number(amount) },
						},
						function (err, u) {
							let result = errorMessage(
								err,
								u,
								"Receiving partner cashier not found."
							);
							if (result.status == 0) {
								res.status(200).json(result);
							} else {
								CashierTransfer.findByIdAndUpdate(
									transfer_id,
									{
										status: 1,
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
												message: "Accepted incoming cash",
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
);

router.post(
	"/partnerCashier/cancelTransfer",
	jwtTokenAuth,
	function (req, res) {
		const { otpId, otp, transfer_id } = req.body;

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
								CashierTransfer.findOneAndUpdate(
									{
										_id: transfer_id,
									},
									{ status: -1 },
									function (err, item) {
										let result = errorMessage(
											err,
											item,
											"No record of cashier transfer found"
										);
										if (result.status == 0) {
											res.status(200).json(result);
										} else {
											PartnerCashier.findOne(
												{
													_id: item.sender_id,
												},
												{
													$inc: { cash_in_hand: Number(item.amount) },
												},
												function (err, u) {
													let result = errorMessage(
														err,
														u,
														"Sending cashier not found"
													);
													if (result.status == 0) {
														res.status(200).json(result);
													} else {
														res.status(200).json({
															status: 1,
															message: "Cancelled transfer",
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
		); //branch
	}
);

router.post(
	"/partnerCashier/getPartnerUserByMobile",
	jwtTokenAuth,
	function (req, res) {
		const { mobile } = req.body;
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
					PartnerUser.findOne({ mobile }, "-password", function (err, user) {
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
	}
);

router.post("/partnerCashier/checkFee", jwtTokenAuth, function (req, res) {
	var { trans_type, amount } = req.body;
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

router.post(
	"/partnerCashier/getCashierTransLimit",
	jwtTokenAuth,
	function (req, res) {
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
					let limit =
						Number(cashier.max_trans_amt) -
						(Number(cashier.cash_received) + Number(cashier.cash_paid));
					limit = limit < 0 ? 0 : limit;
					res.status(200).json({
						limit: limit,
						closingTime: cashier.closing_time,
						openingTime: cashier.opening_time,
						transactionStarted: cashier.transaction_started,
						cashInHand: cashier.cash_in_hand,
						isClosed: cashier.is_closed,
					});
				}
			}
		);
	}
);

router.post(
	"/partnerCashier/verifyOTPClaim",
	jwtTokenAuth,
	function (req, res) {
		const { transferCode, otp } = req.body;
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
	}
);

router.post("/partnerCashier/verifyClaim", jwtTokenAuth, function (req, res) {
	const { otpId, otp } = req.body;
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

router.post(
	"/partnerCashier/sendMoneyPending",
	jwtTokenAuth,
	function (req, res) {
		const {
			type,
			interbank,
			givenname,
			transferCode,
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
						transferCode,
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
					data.cashier_id = cashier._id;
					data.trans_type = type;
					data.interbank = interbank;

					let pending = Number(cashier.pending_trans) + 1;

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
							PartnerCashier.findByIdAndUpdate(
								cashier._id,
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
	}
);

router.post("/partnerCashier/getClaimMoney", jwtTokenAuth, function (req, res) {
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

router.post("/partnerCashier/getHistory", jwtTokenAuth, function (req, res) {
	const { from } = req.body;
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
				CashierPending.find(
					{ cashier_id: cashier._id },
					async (err, pending) => {
						let errMsg = errorMessage(err, pending, "History not found.");
						if (errMsg.status == 0) {
							res.status(200).json(errMsg);
						} else {
							PartnerBranch.findOne(
								{ _id: cashier.branch_id },
								(err, branch) => {
									const wallet = branch.wallet_ids[from];
									blockchain
										.getStatement(wallet)
										.then(function (history) {
											res.status(200).json({
												status: 1,
												history: history,
												pending: pending,
											});
										})
										.catch((err) => {
											res.status(200).json(catchError(err));
										});
								}
							);
						}
					}
				);
			}
		}
	);
});

router.post(
	"/partnerCashier/getBranchByName",
	jwtTokenAuth,
	function (req, res) {
		const { name } = req.body;
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
					PartnerBranch.findOne(
						{
							name: name,
						},
						function (err, branch) {
							let result = errorMessage(err, branch, "Not found");
							if (result.status == 0) {
								res.status(200).json(result);
							} else {
								Partner.findOne(
									{
										_id: branch.partner_id,
									},
									function (err, partner) {
										let result = errorMessage(err, partner, "Not found");
										if (result.status == 0) {
											res.status(200).json(result);
										} else {
											var obj = {};
											obj["logo"] = partner.logo;
											obj["partnerName"] = partner.name;
											obj["name"] = branch.name;
											obj["mobile"] = branch.mobile;
											obj["_id"] = branch._id;
											obj["partnerCode"] = partner.code;

											res.status(200).json({
												status: 1,
												branch: obj,
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
);

router.post("/partnerCashier/getDashStats", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
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

router.post("/partnerCashier/openBalance", jwtTokenAuth, (req, res) => {
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
				var bal =
					Number(cashier.closing_balance) > 0
						? cashier.closing_balance
						: cashier.opening_balance;
				upd = {
					opening_balance: bal,
					cash_received: 0,
					fee_generated: 0,
					opening_time: new Date(),
					cash_paid: 0,
					closing_balance: 0,
					closing_time: null,
					transaction_started: true,
					is_closed: false,
				};

				PartnerCashier.findByIdAndUpdate(cashier._id, upd, (err) => {
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
							message: "Partner Cashier account is open now",
						});
					}
				});
			}
		}
	);
});

module.exports = router;
