const express = require("express");
const router = express.Router();

const jwtTokenAuth = require("./JWTTokenAuth");
const { errorMessage, catchError } = require("./utils/errorHandler");

//models
const User = require("../models/User");
const NWUser = require("../models/NonWalletUsers");
const OTP = require("../models/OTP");
const Bank = require("../models/Bank");
const Infra = require("../models/Infra");
const Fee = require("../models/Fee");
const CashierSend = require("../models/CashierSend");
const Merchant = require("../models/merchant/Merchant");
const MerchantSettings = require("../models/merchant/MerchantSettings");
const Invoice = require("../models/merchant/Invoice");
const TxState = require("../models/TxState");

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const makeid = require("./utils/idGenerator");
const makeotp = require("./utils/makeotp");
const blockchain = require("../services/Blockchain");

//controllers
const userSendTransCntrl = require("../controllers/user/sendTransaction");
const cancelTransCntrl = require("../controllers/cashier/cancelTransaction");

router.post(
	"/user/checkCancelReqStatus",
	jwtTokenAuth,
	cancelTransCntrl.checkApprovalStatus
);

router.post(
	"/user/sendCancelReqForApproval",
	jwtTokenAuth,
	cancelTransCntrl.sendForApproval
);

router.post(
	"/user/cancelTransaction",
	jwtTokenAuth,
	cancelTransCntrl.cancelTransaction
);

router.post("/user/getFailedTransactions", jwtTokenAuth, function (req, res) {
	const { bank_id } = req.body;
	const jwtusername = req.sign_creds.username;
	User.findOne(
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
});

router.post("/user/getMerchantPenaltyRule", jwtTokenAuth, function (req, res) {
	const { merchant_id } = req.body;
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
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
});

router.post("/user/getMerchantDetails", jwtTokenAuth, function (req, res) {
	const { merchant_id } = req.body;
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
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
				Merchant.findOne(
					{ _id: merchant_id },
					"name logo description bank_id",
					(err, merchant) => {
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
							Invoice.find(
								{ merchant_id: merchant_id, mobile: user.mobile },
								(err, invoices) => {
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
											merchant: merchant,
											invoices: invoices,
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

router.get("/user/listMerchants", jwtTokenAuth, function (req, res) {
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
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
				Merchant.find(
					{
						status: 1,
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
								message: "Merchant List",
								list: merchants,
							});
						}
					}
				);
			}
		}
	);
});

router.get("/user/listAddedMerchants", jwtTokenAuth, function (req, res) {
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
			status: 1,
		},
		async function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const list = await user.merchant_list.map(a => a.merchant_id);
				Merchant.find({
					'_id': { $in: list}
				},
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
								message: "Merchant List",
								list: merchants,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/user/addMerchant", jwtTokenAuth, function (req, res) {
	const username = req.sign_creds.username;
	const { merchant_id } = req.body;
	User.findOne(
		{
			username,
			status: 1,
		},
		async function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				User.updateOne(
					{
						_id: user._id,
					},
					{
						$push: {
							merchant_list: {
								merchant_id: merchant_id,
							},
						},
					},
					function (err, update) {
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
								message: "Merchant Added Successfully",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/user/checkFee", jwtTokenAuth, function (req, res) {
	var { amount, trans_type } = req.body;
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
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
				const find = {
					bank_id: user.bank_id,
					trans_type: trans_type,
					status: 1,
					active: "Active",
				};
				Fee.findOne(find, function (err, fe) {
					let result = errorMessage(err, fe, "Fee rule not found");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						amount = Number(amount);
						var temp;
						fe.ranges.map((range) => {
							if (amount >= range.trans_from && amount <= range.trans_to) {
								temp = (amount * range.percentage) / 100;
								fee = temp + range.fixed;
								res.status(200).json({
									status: 1,
									message: trans_type + " fee",
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

router.post("/user/getUser", jwtTokenAuth, function (req, res) {
	const { mobile } = req.body;
	const username = req.sign_creds.username;
	User.findOne({ username }, function (err, user) {
		let result = errorMessage(
			err,
			user,
			"You are either not authorised or not logged in."
		);
		if (result.status == 0) {
			res.status(200).json(result);
		} else {
			User.findOne(
				{ mobile },
				"-password -docs_hash -contact_list",
				function (err, user) {
					let result = errorMessage(err, user, "User not found");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						res.status(200).json({
							status: 1,
							message: "Details of a user for a given mobie no.",
							user: user,
						});
					}
				}
			);
		}
	});
});

router.get("/deleteUser", (req, res) => {
	const { mobile } = req.query;
	User.deleteOne({ mobile }, (err, result) => {
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
				message: "deleted user successfully",
				result: result,
			});
		}
	});
});

router.get("/user/getBalance", jwtTokenAuth, (req, res) => {
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(err, user, "User not found");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const wallet_id = user.wallet_id;
				blockchain
					.getBalance(wallet_id)
					.then(function (result) {
						res.status(200).json({
							status: 1,
							message: "User wallet balance",
							balance: result,
						});
					})
					.catch((err) => {
						res.status(200).json(catchError(err));
					});
			}
		}
	);
});

router.post("/user/updatePassword", (req, res) => {
	const { username, password } = req.body;
	User.findOneAndUpdate(
		{
			username,
		},
		{
			password: password,
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
			} else {
				res.status(200).json({
					status: 1,
					message: "Updated password successfully",
				});
			}
		}
	);
});

router.post("/user/updateEmail", jwtTokenAuth, (req, res) => {
	const { email } = req.body;
	const username = req.sign_creds.username;
	User.findOneAndUpdate(
		{
			username,
		},
		{
			email: email,
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
			} else {
				res.status(200).json({
					status: 1,
					message: "Updated Email successfully",
				});
			}
		}
	);
});

router.post("/user/updateName", jwtTokenAuth, (req, res) => {
	const { name } = req.body;
	const username = req.sign_creds.username;
	User.findOneAndUpdate(
		{
			username,
		},
		{
			name: name,
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
			} else {
				res.status(200).json({
					status: 1,
					message: "Updated name successfully",
				});
			}
		}
	);
});

router.get("/user/getDetails", jwtTokenAuth, (req, res) => {
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
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
			} else {
				res.status(200).json({
					status: 1,
					message: "Get user details success",
					user: user,
				});
			}
		}
	);
});

router.post("/user/verify", (req, res) => {
	const { mobile, email } = req.body;
	User.find(
		{
			$or: [{ mobile: mobile }, { email: email }],
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
			} else if (user.length > 0) {
				res.status(200).json({
					status: 0,
					message:
						"User already exist with either same email id or mobile number.",
				});
			} else {
				let otp = makeotp(6);

				OTP.findOneAndUpdate(
					{ page: "signup", mobile: mobile, user_id: email },
					{ $set: { otp: otp } },
					async (err, result) => {
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
							console.log(result);
							try {
								if (result == null) {
									let otpSchema = new OTP();

									otpSchema.page = "signup";
									otpSchema.mobile = mobile;
									otpSchema.user_id = email;
									otpSchema.otp = otp;

									await otpSchema.save();
								}

								let mailContent =
									"<p>Your OTP to verify your mobile number is " + otp + "</p>";
								sendMail(mailContent, "OTP", email);
								let SMSContent =
									"Your OTP to verify your mobile number is " + otp;
								sendSMS(SMSContent, mobile);
								res.status(200).json({
									status: 1,
									message: "OTP sent to the email and mobile",
								});
							} catch (err) {
								console.log(err);
								res.status(200).json({ status: 0, message: err.message });
							}
						}
					}
				);
			}
		}
	);
});

router.post("/user/signup", (req, res) => {
	const { name, mobile, email, address, password, otp } = req.body;
	OTP.findOne(
		{ page: "signup", mobile: mobile, otp: otp, user_id: email },
		function (err, otpres) {
			let result = errorMessage(err, otpres, "OTP Mismatch");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				OTP.deleteOne(otpres, function (err, obj) {
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
						console.log("document deleted: ", otpres);
						let user = new User();
						user.name = name;
						user.mobile = mobile;
						user.email = email;
						user.address = address;
						user.username = mobile;
						user.password = password;
						user.status = 0;

						user.save((err) => {
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
									message: "Signup completed",
								});
							}
						});
					}
				});
			}
		}
	);
});

router.post("/user/assignBank", jwtTokenAuth, (req, res) => {
	const { bank_id } = req.body;
	const username = req.sign_creds.username;
	User.findOne({ username, status: 0 }, (err, user) => {
		let result = errorMessage(err, user, "You are not allowed to assign bank.");
		if (result.status == 0) {
			res.status(200).json(result);
		} else {
			Bank.findOne({ _id: bank_id }, (err, bank) => {
				let result = errorMessage(err, bank, "This bank do not exist");
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					User.updateOne(
						{ username },
						{ $set: { bank_id: bank_id } },
						(err, user) => {
							let result = errorMessage(
								err,
								user,
								"You are either not authorised or not logged in."
							);
							if (result.status == 0) {
								res.status(200).json(result);
							} else {
								res.status(200).json({
									status: 1,
									message: "Bank is assigned",
								});
							}
						}
					);
				}
			});
		}
	});
});

router.post("/user/saveUploadedDocsHash", jwtTokenAuth, (req, res) => {
	const { hashes } = req.body;
	const username = req.sign_creds.username;
	User.findOneAndUpdate(
		{ username, status: 0 },
		{ $set: { docs_hash: hashes, status: 2 } }, //Status 2: Waiting for cashier approval
		(err, user) => {
			let result = errorMessage(
				err,
				user,
				"You are either not authorised or not logged in."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				res.status(200).json({
					status: 1,
					message: "Saved uploaded doc's hash value",
				});
			}
		}
	);
});

router.post("/user/skipDocsUpload", jwtTokenAuth, (req, res) => {
	const username = req.sign_creds.username;
	User.findOneAndUpdate(
		{ username: username, status: 2 },
		{ $set: { status: 3 } },
		(err, user) => {
			//status 3: Go to the nearest branch and get docs uploaded
			let result = errorMessage(
				err,
				user,
				"You can not perform this step. Either the docs are already uploaded or you are not authorised,login again and try."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				res.status(200).json({
					status: 1,
					message:
						"Document upload is skipped. Go to the nearest branch and get them uploaded",
				});
			}
		}
	);
});

router.get("/user/getBanks", jwtTokenAuth, function (req, res) {
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"You are either not authorised or not logged in."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.find(
					{ initial_setup: { $eq: true } },
					function (err, approvedBanks) {
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
								message: "Get all approved bank list success",
								banks: approvedBanks,
							});
						}
					}
				);
			}
		}
	);
});

router.get("/user/getMessages", jwtTokenAuth, function (req, res) {
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"You are either not authorised or not logged in."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				res.status(200).json({
					status: 1,
					user: user,
				});
			}
		}
	);
});

router.get("/user/getTransactionHistory", jwtTokenAuth, function (req, res) {
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
			status: 1,
		},
		async function (err, user) {
			let result = errorMessage(
				err,
				user,
				"You are either not authorised or not logged in."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				try {
					const wallet = user.wallet_id;
					let result = await blockchain.getStatement(wallet);
					res.status(200).json({
						status: 1,
						message: "get user wallets transaction history success",
						history: result,
					});
				} catch (err) {
					res.status(200).json(catchError(err));
				}
			}
		}
	);
});

router.get("/user/getContactList", jwtTokenAuth, function (req, res) {
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"You are either not authorised or not logged in."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				User.find(
					{ mobile: { $in: user.contact_list } },
					"mobile name",
					(err, walletUsers) => {
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
							NWUser.find(
								{ mobile: { $in: user.contact_list } },
								(err, nonWalletUsers) => {
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
											message:
												"Fetched all wallet and non wallet user contacts",
											contacts: {
												wallet: walletUsers,
												non_wallet: nonWalletUsers,
											},
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

router.post(
	"/user/sendMoneyToWallet",
	jwtTokenAuth,
	userSendTransCntrl.sendMoneyToWallet
);

router.post(
	"/user/sendMoneyToNonWallet",
	jwtTokenAuth,
	userSendTransCntrl.sendMoneyToNonWallet
);

module.exports = router;
