const express = require("express");
const router = express.Router();

const jwtTokenAuth = require("./middleware")

//models
const User = require("../models/User");
const NWUser = require("../models/NonWalletUsers");
const OTP = require("../models/OTP");
const Bank = require("../models/Bank");
const Infra = require("../models/Infra");
const Fee = require("../models/Fee");
const UserLedger = require("../models/UserLedger");

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const makeid = require("./utils/makeotp");
const makeotp = require("./utils/makeotp");
const blockchain = require("../services/Blockchain");

router.get("/deleteUser", (req, res) => {
	const { mobile } = req.query;
	User.deleteOne({ mobile }, (err, result) => {
		if (err) {
			console.log(err);
				return res.status(500).json({
					status: 0,
					error: "Internal Server Error"
				});
		}
		res.status(200).json({
			status: 1,
			result: result
		});
	}
	)
});

router.get("/user/getBalance", jwtTokenAuth, (req, res) => {
	const username = req.username;
	User.findOne(
		{
			username,
			status: 1
		},
		function(err, user) {
			if (err) {
				console.log(err)
				return res.status(500).json({
					error: "Internal Server Error"
				});
			}
			if(user == null ){
				 return res.status(403).json({
					error: "User not found"
				});
			}
			 else {
				const wallet_id = user.mobile + "@" + user.bank;
				blockchain.getBalance(wallet_id).then(function(result) {
					return res.status(200).json({
						status: 1,
						balance: result
					});
				});
			}
		}
	);
});


router.post("/user/updatePassword", (req,res) => {
	const { username, password } = req.body;
	User.findOneAndUpdate({
		username
	},
	{
		password: password
	},
	function(err, user){
		if(err) {
			res.status(500).json({
				status:0,
				error: "Internal Server Error"
			})
		}
		res.status(200).json({
			status: 1,
			message: "Updated password successfully"
		})
	})
	
});

router.post("/user/updateEmail", jwtTokenAuth, (req,res) => {
	const { email } = req.body;
	const username = req.username;
	User.findOneAndUpdate({
		username
	},
	{
		email: email
	},
	function(err, user){
		if(err) {
			res.status(500).json({
				status:0,
				error: "Internal Server Error"
			})
		}
		res.status(200).json({
			status: 1
		})
	})
	
});

router.post("/user/updateName", jwtTokenAuth, (req,res) => {
	const { name } = req.body;
	const username = req.username;
	User.findOneAndUpdate({
		username
	},
	{
		name: name
	},
	function(err, user){
		if(err) {
			res.status(500).json({
				status:0,
				error: "Internal Server Error"
			})
		}
		res.status(200).json({
			status: 1,
			message: "Updated name successfully"
		})
	})
	
});

router.get("/user/getDetails", jwtTokenAuth, (req,res) => {
	const username = req.username;
	User.findOne({
		username
	},
	function(err, user){
		if(err) {
			console.log(err)
			res.status(500).json({
				status:0,
				error: "Internal Server Error"
			})
		}
		res.status(200).json({
			status: 1,
			user: user
		})
	})
	
});

router.post("/user/verify", (req, res) => {
	const { mobile, email } = req.body;

	User.find(
		{
			$or: [{ mobile: mobile }, { email: email }]
		},
		function (err, user) {
			if (err) {
				return res.status(500).json({
					status: 0,
					error: "Internal Server Error"
				});
			}
			if (user.length > 0) {
				return res.status(403).json({
					status: 0,
					error: "User already exist with either same email id or mobile number."
				});
			}
			let otp = makeotp(6);

			OTP.findOneAndUpdate({ page: "signup", mobile: mobile, user_id: email }, { $set: { otp: otp } },async (err, result) => {
				if (err) {
					return res.send(500).json({
						error: "Internal Server Error"
					});
				}
				console.log(result)
				if (result == null) {
					let otpSchema = new OTP();

					otpSchema.page = "signup";
					otpSchema.mobile = mobile;
					otpSchema.user_id = email;
					otpSchema.otp = otp;

					await otpSchema.save();
					
				}
				let mailContent = "<p>Your OTP to verify your mobile number is " + otp + "</p>";
				sendMail(mailContent, "OTP", email);
				let SMSContent = "Your OTP to verify your mobile number is " + otp;
				sendSMS(SMSContent, mobile);
				res.status(200).json({
					status: 1,
					message: "OTP sent to the email and mobile"
				});
			});
		}
	);
});

router.post("/user/signup", (req, res) => {
	const { name, mobile, email, address, password, otp } = req.body;
	OTP.findOne({ page: "signup", mobile: mobile, otp: otp, user_id: email }, function(
		err,
		result
	) {
		if (err) {
			console.log(err);
			return res.status(500).json({
				status: 0,
				error: "Internal Server Error"
			});
		}
		if (result == null) {
			return res.status(403).json({
				status: 0,
				error: "OTP Mismatch"
			});
		}
		OTP.deleteOne(result, function(err, obj) {
			if (err) {
				console.log(err);
				return res.status(500).json({
					status: 0,
					error: "Internal Server Error"
				});
			}
			console.log("document deleted: ", result);
		});
		let user = new User();
		user.name = name;
		user.mobile = mobile;
		user.email = email;
		user.address = address;
		user.username = mobile;
		user.password = password;
		user.status = 2;

		user.save(err => {
			if (err)
				return res.status(403).json({
					status: 0,
					error: "User already exist with either same email id or mobile number."
				});
			res.status(200).json({
				status: 1,
				message: "OTP has been sent successfully"
			});
		});
	});
});

router.post("/user/assignBank", jwtTokenAuth, (req, res) => {
	const { bank } = req.body;
	const username = req.username;
	User.findOne({ username , status: 2}, (err, user) => {
		if (err) {
			console.log(err);
			return res.status(500).json({
				status: 0,
				error: "Internal Server Error",
			});
		}
		if (user == null) {
			return res.status(403).json({
				status: 0,
				error: "You are not allowed to assign bank.",
			});
		}
		Bank.findOne({ name: bank.name }, (err, result) => {
			if (err) {
				console.log(err);
				return res.status(500).json({
					status: 0,
					error: "Internal Server Error",
				});
			}
			if (result == null) {
				return res.status(403).json({
					status: 0,
					error: "This bank do not exist",
				});
			}
			User.update({ username }, { $set: { bank: bank } }, (err, user) => {
				if (err) {
					console.log(err);
					return res.status(500).json({
						status: 0,
						error: "Internal Server Error",
					});
				}
				if (user == null) {
					return res.status(403).json({
						status: 0,
						error: "You are either not authorised or not logged in.",
					});
				}
				res.status(200).json({
					status: 1,
					message: "Bank is assigned"
				});
			});
		});
	});
});

router.post("/user/saveUploadedDocsHash", jwtTokenAuth, (req, res) => {
	const { hashes } = req.body;
	const username = req.username;
	User.findOneAndUpdate(
		{ username, status: 2 },
		{ $set: { docs_hash: hashes, status: 3 } }, //Status 3: Waiting for cashier approval
		(err, result) => {
			if (err) {
				console.log(err);
				return res.status(500).json({
					status: 0,
					error: "Internal Server Error"
				});
			}
			if (result == null) {
				return res.status(403).json({
					status: 0,
					error: "You are either not authorised or not logged in."
				});
			}
			res.status(200).json({
				status: 1
			});
		}
	);
});

router.post("/user/skipDocsUpload", jwtTokenAuth, (req, res) => {
	const username = req.username;
	User.findOneAndUpdate({ username: username, status: 2 }, { $set: { status: 4 } }, (err, result) => {
		//status 4: Go to the nearest branch and get docs uploaded
		if (err) {
			console.log(err);
			return res.status(500).json({
				status: 0,
				error: "Internal Server Error"
			});
		}
		if (result == null) {
			return res.status(403).json({
				status: 0,
				error: "You can not perform this step. Either the docs are already uploaded or you are not authorised,login again and try."
			});
		}
		res.status(200).json({
			status: 1,
			message: "Document upload is skipped. Go to the nearest branch and get them uploaded"
		});
	});
});

router.get("/user/getBanks", jwtTokenAuth, function(req, res) {
	const username = req.username;
	User.findOne(
		{
			username,
		},
		function(err, user) {
			if (err) {
				console.log(err);
				return res.status(500).json({
					status: 0,
					error: "Internal Server Error"
				});
			}
			if (user == null) {
				return res.status(403).json({
					status: 0,
					error: "You are either not authorised or not logged in."
				});
			} else {
				Bank.find({ initial_setup: { $eq: true } }, function(err, approvedBanks) {
					if (err) {
						console.log(err);
						return res.status(500).json({
							status: 0,
							error: "Internal Server Error"
						});
					}
					res.status(200).json({
						status: 1,
						banks: approvedBanks
					});
				});
			}
		}
	);
});

router.get("/user/getTransactionHistory", jwtTokenAuth, function(req, res) {
	const username = req.username;
	User.findOne(
		{
			username,
			status: 1
		},
		async function(err, user) {
			if (err) {
				console.log(err);
				return res.status(500).json({
					status: 0,
					error: "Internal Server Error"
				});
			}
			if (user == null) {
				return res.status(403).json({
					status: 0,
					error: "You are either not authorised or not logged in."
				});
			} else {
				const wallet = user.mobile + "@" + user.bank;
				let result = await blockchain.getStatement(wallet)
				res.status(200).json({
					status: 1,
					history: result
				});
			}
		}
	);
});

router.get("/user/getContactList", jwtTokenAuth, function(req, res) {
	const username = req.username;
	User.findOne(
		{
			username,
			status: 1
		},
		function(err, user) {
			if (err) {
				console.log(err);
				return res.status(500).json({
					status: 0,
					error: "Internal Server Error"
				});
			}
			if (user == null) {
				res.status(403).json({
					status: 0,
					error: "You are either not authorised or not logged in."
				});
			} else {
				User.find({ mobile: { $in: user.contact_list } }, 'mobile name', (err, walletUsers) => {
					if (err) {
						console.log(err);
						return res.status(500).json({
							status: 0,
							error: "Internal Server Error"
						});
					}
					NWUser.find({ mobile: { $in: user.contact_list } }, ( err, nonWalletUsers ) => {
						if (err) {
							console.log(err);
							return res.status(500).json({
								status: 0,
								error: "Internal Server Error"
							});
						}
						res.status(200).json({
							status: 1,
							contacts: { wallet: walletUsers, non_wallet: nonWalletUsers }
						});

					})
				})
					
			}
		}
	);
});

router.post("/user/sendMoneyToWallet", jwtTokenAuth, function (req, res) {
	var now = new Date().getTime();
	const username = req.username;

	const { receiverMobile, note, sending_amount } = req.body;

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
		function (err, sender) {
			if(err) {
				console.log(err);
				res.status(500).json({
					status: 0,
					error: "Internal Server Error",
				});
			}
			if ( sender == null ) {
				res.status(403).json({
					status: 0,
					error: "Unauthorized",
				});
			} else {
				User.findOne(
					{
						mobile: receiverMobile,
					},
					(err, receiver) => {
						if (err || receiver == null) {
							res.status(403).json({
								status: 0,
								error: "Receiver's wallet do not exist",
							});
						} else {
							Bank.findOne(
								{
									name: sender.bank,
								},
								async function (err, bank) {
									if (err || bank == null) {
										res.status(403).json({
											status: 0,
											error: "Bank Not Found",
										});
									} else {
										const senderWallet = sender.mobile + "@" + bank.name;
										var bal = await blockchain.getBalance(senderWallet);
										if (Number(bal) < sending_amount) {
											return res.status(403).json({
												status: 0,
												error: "Not enough balance. Recharge Your wallet.",
											});
										}
										Infra.findOne(
											{
												_id: bank.user_id,
											},
											function (err, infra) {
												if (err || infra == null) {
													return res.status(403).json({
														status: 0,
														error: "Infra Not Found",
													});
												} else {
													const find = {
														bank_id: bank._id,
														trans_type: "Wallet to Wallet",
														status: 1,
														active: "Active",
													};
													Fee.findOne(find, function (err, fe) {
														if (err || fe == null) {
															return res.status(403).json({
																status: 0,
																error: "Revenue Rule Not Found",
															});
														} else {
															var fee = 0;
															var temp;
															oamount = Number(sending_amount);
															fe.ranges.map((range) => {
																if (oamount >= range.trans_from && oamount <= range.trans_to) {
																	temp = (oamount * range.percentage) / 100;
																	fee = temp + range.fixed_amount;
																	let data = new UserLedger();

																	data.sender_mobile = sender.mobile;
																	data.note = note;
																	data.receiver_mobile = receiverMobile;
																	data.amount = oamount;
																	data.fee = fee;
																	const transactionCode = makeid(8);
																	data.transaction_code = transactionCode;
																	var mns = sender.mobile.slice(-2);
																	var mnr = receiver.mobile.slice(-2);
																	var master_code = child_code = mns + mnr + now;
																	data.master_code = master_code;

																	//send transaction sms after actual transaction

																	data.save((err, d) => {
																		if (err)
																			return res.json({
																				error: err.toString(),
																			});

																		const bankEsWallet = receiverMobile + "@" + bank.name;
																		const bankOpWallet = "operational@" + bank.name;
																		const infraOpWallet = "infra_operational@" + bank.name;
																		const { infra_share } = fe.revenue_sharing_rule;

																		let trans1 = {};
																		trans1.from = senderWallet;
																		trans1.to = bankEsWallet;
																		trans1.amount = oamount;
																		trans1.note = "Transfer from " + sender.name + " to " + receiver.name;
																		trans1.email1 = sender.email;
																		trans1.email2 = receiver.email;
																		trans1.mobile1 = sender.mobile;
																		trans1.mobile2 = receiver.mobile;
																		trans1.master_code = master_code;
																		trans1.child_code = child_code + "1";

																		let trans2 = {};
																		trans2.from = senderWallet;
																		trans2.to = bankOpWallet;
																		trans2.amount = fee;
																		trans2.note = "Bank Fee";
																		trans2.email1 = sender.email;
																		trans2.email2 = bank.email;
																		trans2.mobile1 = sender.mobile;
																		trans2.mobile2 = bank.mobile;
																		trans2.master_code = master_code;
																		now = new Date().getTime();
																		child_code = mns + "" + mnr + "" + now;
																		trans2.child_code = child_code + "2";

																		var infraShare = 0;
																		var temp = (fee * Number(infra_share.percentage)) / 100;
																		var infraShare = temp + Number(infra_share.fixed);

																		let trans3 = {};
																		trans3.from = bankOpWallet;
																		trans3.to = infraOpWallet;
																		trans3.amount = infraShare;
																		trans3.note = "Infra Fee";
																		trans3.email1 = bank.email;
																		trans3.email2 = infra.email;
																		trans3.mobile1 = bank.mobile;
																		trans3.mobile2 = infra.mobile;
																		trans3.master_code = master_code;
																		mns = bank.mobile.slice(-2);
																		mnr = infra.mobile.slice(-2);
																		now = new Date().getTime();
																		child_code = mns + "" + mnr + "" + now + "3";
																		trans3.child_code = child_code;

																		blockchain
																			.transferThis(trans1, trans2, trans3)
																			.then(function (result) {
																				console.log("Result: " + result);
																				if (result.length <= 0) {
																					let content =
																						"Your Transaction Code is " + transactionCode;
																					if (receiverMobile && receiverMobile != null) {
																						sendSMS(content, receiverMobile);
																					}
																					if (receiver.email && receiver.email != null) {
																						sendMail(content, "Transaction Code", receiver.email);
																					}

																					UserLedger.findByIdAndUpdate(
																						d._id,
																						{
																							status: 1,
																							fee: fee,
																						},
																						(err) => {
																							console.log(err);
																							if (err) {
																								return res.status(500).json({
																									status: 0,
																									error: "Internal Server Error",
																								});
																							}

																							res.status(200).json({
																								status: 1,
																								message: sending_amount + " XOF is transferred to " + sender.name
																							});
																						}
																					);
																				} else {
																					res.status(500).json({
																						status: 0,
																						error: result.toString(),
																					});
																				}
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
							);
						}
					}
				); //branch
			}
		}
	);
});

router.post("/user/sendMoneyToNonWallet", jwtTokenAuth, function (req, res) {

	var now = new Date().getTime();

	const username = req.username;

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
		sending_amount, } = req.body;

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
			if(err) {
				console.log(err);
				res.status(500).json({
					status: 0,
					error: "Internal Server Error",
				});
			}
			if ( sender == null) {
				res.status(403).json({
					status: 0,
					error: "Sender not found",
				});
			} else {
				receiver = {
					name: receiverGivenName,
					last_name: receiverFamilyName,
					mobile: receiverMobile,
					email: receiverEmail,
					country: receiverCountry,
					id_type: receiverIdentificationType,
					valid_till: receiverIdentificationValidTill,
					id_number: receiverIdentificationNumber,
					status: 0
				};

				await NWUser.create(receiver, function (err) { })

				
				
				Bank.findOne(
					{
						name: sender.bank,
					},
					async function (err, bank) {
						if (err || bank == null) {
							res.status(403).json({
								status: 0,
								error: "Bank Not Found",
							});
						} else {
							const senderWallet = sender.mobile + "@" + bank.name;
				var bal = await blockchain.getBalance(senderWallet);
				if (Number(bal) < sending_amount) {
					res.status(403).json({
						status: 0,
						error: "Not enough balance. Recharge Your wallet.",
					});
				}
							Infra.findOne(
								{
									_id: bank.user_id,
								},
								function (err, infra) {
									if (err || infra == null) {
										res.status(403).json({
											status: 0,
											error: "Infra Not Found",
										});
									} else {
										const find = {
											bank_id: bank._id,
											trans_type: "Wallet to Non Wallet",
											status: 1,
											active: "Active",
										};
										Fee.findOne(find, function (err, fe) {
											if (err || fe == null) {
												res.status(403).json({
													status: 0,
													error: "Revenue Rule Not Found",
												});
											} else {
												var fee = 0;
												var temp;

												oamount = Number(sending_amount);
												fe.ranges.map((range) => {
													if (oamount >= range.trans_from && oamount <= range.trans_to) {
														temp = (oamount * range.percentage) / 100;
														fee = temp + range.fixed_amount;

														let data = new UserLedger();
														data.sender_mobile = sender.mobile;
														data.note = note;
														data.receiver_mobile = receiver.mobile;
														data.amount = sending_amount;
														data.fee = fee;
														const transactionCode = makeid(8);
																	data.transaction_code = transactionCode;
														var mns = sender.mobile.slice(-2);
														var mnr = receiver.mobile.slice(-2);
														var master_code = child_code = mns + mnr + now;
														data.master_code = master_code;

														data.without_id = withoutID ? 1 : 0;
														if (requireOTP) {
															data.require_otp = 1;
															data.otp = makeotp(6);
															content = data.otp + " - Send this OTP to the Receiver";
															if (sender.mobile && sender.mobile != null) {
																sendSMS(content, sender.mobile);
															}
															if (sender.email && sender.email != null) {
																sendMail(content, "Transaction OTP", receiver.email);
															}
														}

														//send transaction sms after actual transaction

														data.save((err, d) => {
															if (err)
																return res.json({
																	error: err.toString(),
																});

															const bankEsWallet = "escrow@" + bank.name;
															const bankOpWallet = "operational@" + bank.name;
															const infraOpWallet = "infra_operational@" + bank.name;


															const { infra_share } = fe.revenue_sharing_rule;

															let trans1 = {};
															trans1.from = senderWallet;
															trans1.to = bankEsWallet;
															trans1.amount = oamount;
															trans1.note = "Transferred Money to " + receiverFamilyName;
															trans1.email1 = sender.email;
															trans1.email2 = receiver.email;
															trans1.mobile1 = sender.mobile;
															trans1.mobile2 = receiver.mobile;
															trans1.master_code = master_code;
															trans1.child_code = child_code + "1";

															let trans2 = {};
															trans2.from = senderWallet;
															trans2.to = bankOpWallet;
															trans2.amount = fee;
															trans2.note = "Deducted Bank Fee";
															trans2.email1 = sender.email;
															trans2.email2 = bank.email;
															trans2.mobile1 = sender.mobile;
															trans2.mobile2 = bank.mobile;
															trans2.master_code = master_code;
															now = new Date().getTime();
															child_code = mns + "" + mnr + "" + now;
															trans2.child_code = child_code + "2";

															var infraShare = 0;
															var temp = (fee * Number(infra_share.percentage)) / 100;
															var infraShare = temp + Number(infra_share.fixed);

															let trans3 = {};
															trans3.from = bankOpWallet;
															trans3.to = infraOpWallet;
															trans3.amount = infraShare;
															trans3.note = "Deducted Infra Fee";
															trans3.email1 = bank.email;
															trans3.email2 = infra.email;
															trans3.mobile1 = bank.mobile;
															trans3.mobile2 = infra.mobile;
															trans3.master_code = master_code;
															mns = bank.mobile.slice(-2);
															mnr = infra.mobile.slice(-2);
															now = new Date().getTime();
															child_code = mns + "" + mnr + "" + now + "3";
															trans3.child_code = child_code;

															
															blockchain
																.transferThis(trans1, trans2, trans3)
																.then(function (result) {
																	console.log("Result: " + result);
																	if (result.length <= 0) {
																		let content =
																			"Your Transaction Code is " + transactionCode;
																		if (receiverMobile && receiverMobile != null) {
																			sendSMS(content, receiverMobile);
																		}
																		if (receiverEmail && receiverEmail != null) {
																			sendMail(content, "Transaction Code", receiverEmail);
																		}

																		UserLedger.findByIdAndUpdate(
																			d._id,
																			{
																				status: 1,
																				fee: fee,
																			},
																			(err) => {
																				if (err) {
																				console.log(err);
																					return res.status(500).json({
																						status: 0,
																						error: "Internal Server Error",
																					});
																				}

																				return res.status(200).json({
																					status: 1,
																				});
																			}
																		);
																	} else {
																		res.status(500).json({
																			status: 0,
																			error: result.toString(),
																		});
																	}
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
			}
		}
	);
});

module.exports = router;
