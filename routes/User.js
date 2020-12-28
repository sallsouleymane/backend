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

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const makeid = require("./utils/idGenerator");
const makeotp = require("./utils/makeotp");
const blockchain = require("../services/Blockchain");

const walletToWallet = require("./transactions/intraBank/walletToWallet");
const walletToCashier = require("./transactions/intraBank/walletToCashier");

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
						return catchError(err);
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
					return catchError(err);
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

router.post("/user/sendMoneyToWallet", jwtTokenAuth, function (req, res) {
	const username = req.sign_creds.username;

	const { receiverMobile, sending_amount, isInclusive } = req.body;

	User.findOneAndUpdate(
		{
			username,
			status: 1,
		},
		{
			$addToSet: {
				contact_list: receiverMobile,
			},
		},
		async function (err, sender) {
			let result = errorMessage(
				err,
				sender,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				User.findOne(
					{
						mobile: receiverMobile,
					},
					(err, receiver) => {
						let result = errorMessage(
							err,
							receiver,
							"Receiver's wallet do not exist"
						);
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							Bank.findOne(
								{
									_id: sender.bank_id,
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
														trans_type: "Wallet to Wallet",
														status: 1,
														active: "Active",
													};
													Fee.findOne(find, function (err, fe) {
														let result = errorMessage(
															err,
															fe,
															"Revenue Rule Not Found"
														);
														if (result.status == 0) {
															res.status(200).json(result);
														} else {
															transfer = {
																amount: sending_amount,
																isInclusive: isInclusive,
															};

															walletToWallet(
																transfer,
																infra,
																bank,
																sender,
																receiver
															)
																.then(function (result) {
																	console.log("Result: " + result);
																	if (result.length == 1) {
																		res.status(200).json({
																			status: 1,
																			message:
																				sending_amount +
																				" XOF is transferred to " +
																				receiver.name,
																			balance:
																				result.balance -
																				(result.amount + result.fee),
																		});
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
														//infra
													});
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
});

router.post("/user/sendMoneyToNonWallet", jwtTokenAuth, function (req, res) {
	const username = req.sign_creds.username;

	const {
		note,
		withoutID,
		requireOTP,
		receiverMobile,
		receiverGivenName,
		receiverFamilyName,
		receiverCountry,
		receiverEmail,
		receiverIdentificationType,
		receiverIdentificationNumber,
		receiverIdentificationValidTill,
		sending_amount,
		isInclusive,
	} = req.body;

	User.findOneAndUpdate(
		{
			username,
			status: 1,
		},
		{
			$addToSet: {
				contact_list: receiverMobile,
			},
		},
		async function (err, sender) {
			let result = errorMessage(err, sender, "Sender not found");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				try {
					receiver = {
						name: receiverGivenName,
						last_name: receiverFamilyName,
						mobile: receiverMobile,
						email: receiverEmail,
						country: receiverCountry,
					};

					await NWUser.create(receiver, function (err) {});

					Bank.findOne(
						{
							_id: sender.bank_id,
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
										let result = errorMessage(err, infra, "Infra Not Found");
										if (result.status == 0) {
											res.status(200).json(result);
										} else {
											const find = {
												bank_id: bank._id,
												trans_type: "Wallet to Non Wallet",
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
													let data = new CashierSend();
													temp = {
														mobile: sender.mobile,
														note: note,
														givenname: sender.name,
														familyname: sender.last_name,
														address1: sender.address,
														state: sender.state,
														country: sender.country,
														email: sender.email,
													};
													data.sender_info = JSON.stringify(temp);
													temp = {
														mobile: receiverMobile,
														// ccode: receiverccode,
														givenname: receiverGivenName,
														familyname: receiverFamilyName,
														country: receiverCountry,
														email: receiverEmail,
													};
													data.receiver_info = JSON.stringify(temp);
													temp = {
														country: receiverCountry,
														type: receiverIdentificationType,
														number: receiverIdentificationNumber,
														valid: receiverIdentificationValidTill,
													};
													data.receiver_id = JSON.stringify(temp);
													data.amount = sending_amount;
													data.is_inclusive = isInclusive;
													const transactionCode = makeid(8);
													data.transaction_code = transactionCode;
													data.rule_type = "Wallet to Non Wallet";

													data.without_id = withoutID ? 1 : 0;
													if (requireOTP) {
														data.require_otp = 1;
														data.otp = makeotp(6);
														content =
															data.otp + " - Send this OTP to the Receiver";
														if (sender.mobile && sender.mobile != null) {
															sendSMS(content, sender.mobile);
														}
														if (sender.email && sender.email != null) {
															sendMail(
																content,
																"Transaction OTP",
																receiver.email
															);
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
															const transfer = {
																amount: sending_amount,
																is_inclusive: isInclusive,
															};
															walletToCashier(
																transfer,
																infra,
																bank,
																sender,
																rule
															)
																.then(function (result) {
																	console.log("Result: " + result);
																	if (result.length == 1) {
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
																				master_code: result.master_code,
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
																						message:
																							sending_amount +
																							" XOF is transferred to branch",
																						balance:
																							result.balance -
																							(result.amount + result.fee),
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
												//infra
											});
										}
									}
								);
							}
						}
					); //branch
				} catch (err) {
					console.log(err);
					res.status(200).json({ status: 0, message: err.message });
				}
			}
		}
	);
});

module.exports = router;
