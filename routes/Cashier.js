const express = require("express");
const router = express.Router();
const config = require("../config.json");

//utils
const makeid = require("./utils/idGenerator");
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");

//services
const { transferThis, getTransactionCount, getBalance } = require("../services/Blockchain.js");

const Infra = require("../models/Infra");
const Fee = require("../models/Fee");
const User = require("../models/User");
const Bank = require("../models/Bank");
const OTP = require("../models/OTP");
const Branch = require("../models/Branch");
const BankUser = require("../models/BankUser");
const Cashier = require("../models/Cashier");
const BankFee = require("../models/BankFee");
const CashierSend = require("../models/CashierSend");
const CashierPending = require("../models/CashierPending");
const CashierClaim = require("../models/CashierClaim");
const CashierLedger = require("../models/CashierLedger");
const CashierTransfer = require("../models/CashierTransfer");
const BranchSend = require("../models/BranchSend");

router.post("/cashier/getUser", function(req, res) {
	const { token, mobile } = req.body;
	Cashier.findOne({ token }, function(err, cashier) {
		if (err) {
			console.log(err);
			return res.status(200).json({
				error: "Internal Error"
			});
		}
		if (cashier == null) {
			res.status(200).json({
				error: "You are either not authorised or not logged in."
			});
		}
		User.findOne({ mobile }, function(err, user) {
			if (err) {
				console.log(err);
				return res.status(200).json({
					error: "Internal Error"
				});
			}
			if (user == null) {
				res.status(200).json({
					error: "User not found"
				});
			}
			res.status(200).json({
				status: "success",
				data: user
			});
		});
	});
});

router.post("/cashier/approveUser", function(req, res) {
	const { token, mobile, userDetails } = req.body;
	Cashier.findOne({ token }, function(err, cashier) {
		if (err) {
			console.log(err);
			return res.status(200).json({
				error: "Internal Error"
			});
		}
		if (cashier == null) {
			res.status(200).json({
				error: "You are either not authorised or not logged in."
			});
		}
		User.findOneAndUpdate({ mobile }, { $set: userDetails }, async function(err, user) {
			if (err) {
				console.log(err);
				return res.status(200).json({
					error: "Internal Error"
				});
			}
			if (user == null) {
				return res.status(200).json({
					error: "User not found"
				});
			}
			let wallet_id = mobile + "@" + user.bank;
            let result = await blockchain.createWallet([wallet_id]);
            console.log(result)
			let content =
				"<p>Your application is approved</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
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
			sendMail(content, "Approved Ewallet Account", email);
			let content2 =
				"Your application is approved Login URL: http://" +
				config.mainIP +
				"/user" +
				" Your username: " +
				mobile +
				" Your password: " +
				user.password;
			sendSMS(content2, mobile);
			res.status(200).json({
				status: "success",
				walletStatus: result.toString()
			});
		});
	});
});

router.post("/getCashierDashStats", function(req, res) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";

	const { token } = req.body;
	Cashier.findOne(
		{
			token,
			status: 1
		},
		function(err, user) {
			if (err || user == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				res.status(200).json({
					openingBalance: user.opening_balance,
					closingBalance: user.closing_balance,
					cashPaid: user.cash_paid,
					cashReceived: user.cash_received,
					cashInHand: user.cash_in_hand,
					feeGenerated: user.fee_generated,
					closingTime: user.closing_time,
					transactionStarted: user.transaction_started,
					branchId: user.branch_id,
					isClosed: user.is_closed
				});

				// CashierLedger.countDocuments({
				//   cashier_id: user._id,
				//   trans_type: "OB"
				// }, function (err, ob) {
				//   if (err || ob == null || ob <= 0) {
				//     res.status(200)
				//       .json({
				//         openingBalance: 0,
				//         cashPaid: 0,
				//         cashReceived: 0,
				//         feeGenerated: 0
				//       });
				//   } else {
				//     CashierLedger.countDocuments({
				//   cashier_id: user._id,
				//   trans_type: "CB"
				//     }, function (err, cb) {
				//     if(cb > 0){
				//       CashierLedger.findOne({cashier_id: user._id, trans_type: "CB"}).sort({created_at: -1}).exec(function(err, post) {
				//         CashierLedger.findOne({
				//             created_at: { $gte: new Date(start), $lte: new Date(end) },
				//             cashier_id: user._id, trans_type: "CR",
				//             status : 1
				//           },(e, post2) => {
				//
				//             let received = 0, fee =0;
				//             if(post2 != null){
				//               let fe = JSON.parse(post2.transaction_details);
				//               console.log(fe);
				//                 received = Number(post2.amount);
				//                 fee = Number(fe.fee);
				//             }
				//             CashierLedger.findOne({
				//               cashier_id: user._id, trans_type: "DR",
				//             created_at: { $gte: new Date(start), $lte: new Date(end) },
				//             status: 1
				//           },(e, post3) => {
				//
				//             let paid = 0;
				//               if(post3 != null && post3 != ''){
				//                 paid = Number(post3.amount);
				//                 if(paid == null || paid == ''){
				//                   paid = 0;
				//                 }
				//             }
				//             console.log(received);
				//               res.status(200).json({
				//                 openingBalance: post.amount,
				//                 cashPaid:  paid == null ? 0 : paid,
				//                 cashReceived: received == null ? 0 : received ,
				//                 feeGenerated: fee
				//               });
				//
				//               });
				//           });
				//
				//       });
				//     }else{
				//
				//         CashierLedger.findOne({cashier_id: user._id, trans_type: "OB"}).sort({created_at: -1}).exec(function(err, post) {
				//           if(err || post == null){
				//             res.status(200).json({
				//                 openingBalance: 0,
				//                 cashPaid: 0,
				//                 cashReceived: 0,
				//                 feeGenerated: 0
				//               });
				//           }else{
				//
				//           CashierLedger.findOne({
				//             created_at: { $gte: new Date(start), $lte: new Date(end) },
				//             cashier_id: user._id, trans_type: "CR",
				//             status : 1
				//           },(e, post2) => {
				//
				//             let received = 0, fee =0;
				//             if(post2 != null){
				//               let fe = JSON.parse(post2.transaction_details);
				//               console.log(fe);
				//                 received = Number(post2.amount);
				//                 fee = Number(fe.fee);
				//             }
				//             CashierLedger.findOne({
				//               cashier_id: user._id, trans_type: "DR",
				//               created_at: { $gte: new Date(start), $lte: new Date(end) },
				//               status: 1
				//             },(e, post3) => {
				//
				//               let paid = 0;
				//                 if(post3 != null && post3 != ''){
				//                   paid = Number(post3.amount);
				//                   if(paid == null || paid == ''){
				//                     paid = 0;
				//                   }
				//               }
				//               res.status(200).json({
				//                 openingBalance: post.amount,
				//                 cashPaid:  paid == null ? 0 : paid,
				//                 cashReceived: received == null ? 0 : received ,
				//                 feeGenerated: fee
				//               });
				//
				//               });
				//           });
				//
				//         }
				//         });
				//     }
				//   });
				// }
				//
				// });
			}
		}
	);
});

router.post("/getCashierIncomingTransfer", function(req, res) {
	const { token } = req.body;
	Cashier.findOne(
		{
			token,
			status: 1
		},
		function(err, user) {
			if (err || user == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				CashierTransfer.find(
					{
						receiver_id: user._id,
						status: 0
					},
					(e, data) => {
						res.status(200).json({
							result: data
						});
					}
				);
			}
		}
	);
});

router.post("/cashierAcceptIncoming", function(req, res) {
	const { token, item } = req.body;
	Cashier.findOne(
		{
			token,
			status: 1
		},
		function(err, user) {
			if (err || user == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				Cashier.findOne(
					{
						_id: item.receiver_id
					},
					function(err, u) {
						if (err || u == null) {
							res.status(401).json({
								error: "Unauthorized"
							});
						} else {
							let cashInHand = Number(u.cash_in_hand) + Number(item.amount);
							CashierTransfer.findByIdAndUpdate(
								item._id,
								{
									status: 1
								},
								(e, data) => {
									Cashier.findByIdAndUpdate(
										item.receiver_id,
										{
											cash_in_hand: cashInHand
										},
										(e, data) => {
											res.status(200).json({
												success: true
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
});

router.post("/getClosingBalance", function(req, res) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";

	const { token } = req.body;
	Cashier.findOne(
		{
			token,
			status: 1
		},
		function(err, user) {
			if (err || user == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				let cb = 0,
					cr = 0,
					dr = 0;
				// CashierLedger.findOne({
				//   created_at: { $gte: new Date(start), $lte: new Date(end) },
				//   cashier_id: user._id, trans_type: "CB"
				// }, function (err, c) {
				var c = user;

				cb = c.closing_balance;
				da = c.closing_time;
				var diff = Number(cb) - Number(user.cash_in_hand);
				res.status(200).json({
					cashInHand: user.cash_in_hand,
					balance1: cb,
					balance2: diff,
					lastdate: da,
					transactionStarted: c.transaction_started,
					isClosed: c.is_closed
				});

				// });
			}
		}
	);
});

router.post("/openCashierBalance", (req, res) => {
	const { token } = req.body;
	Cashier.findOne(
		{
			token,
			status: 1
		},
		function(err, ba) {
			if (err || ba == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				// if( ba.closing_time != null){
				// var ct = new Date(ba.closing_time);
				// ct = ct.getTime();
				// console.log(ct);
				// console.log(start);
				// if(ct < start) {
				var bal = Number(ba.closing_balance) > 0 ? ba.closing_balance : ba.opening_balance;
				upd = {
					opening_balance: bal,
					cash_received: 0,
					fee_generated: 0,
					cash_paid: 0,
					closing_balance: 0,
					closing_time: null,
					transaction_started: true,
					is_closed: false
				};
				console.log(upd);

				Cashier.findByIdAndUpdate(ba._id, upd, err => {
					if (err)
						return res.status(400).json({
							error: err
						});
					res.status(200).json({
						status: true
					});
				});

				//}
				// }
			}
		}
	);
});

router.post("/addClosingBalance", (req, res) => {
	const { denomination, total, token, note } = req.body;
	Cashier.findOne(
		{
			token,
			status: 1
		},
		function(err, otpd) {
			if (err || otpd == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				let data = new CashierLedger();
				data.amount = total;
				data.cashier_id = otpd._id;
				data.trans_type = "CB";
				let td = {
					denomination,
					note
				};
				data.transaction_details = JSON.stringify(td);

				data.save(err => {
					if (err)
						return res.status(200).json({
							error: err.toString()
						});

					Cashier.findByIdAndUpdate(
						otpd._id,
						{
							closing_balance: total,
							closing_time: new Date(),
							is_closed: true
						},
						function(e, v) {}
					);

					return res.status(200).json(true);
				});
			}
		}
	);
});

router.post("/getCashierTransfers", function(req, res) {
	const { token } = req.body;

	Cashier.findOne(
		{
			token,
			status: 1
		},
		function(err, f) {
			if (err || f == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				CashierTransfer.find({ $or: [{ sender_id: f._id }, { receiver_id: f._id }] }).exec(function(
					err,
					b
				) {
					res.status(200).json({
						status: "success",
						history: b
					});
				});
			}
		}
	);
});

router.post("/cashierCancelTransfer", function(req, res) {
	const { otpId, token, otp, transfer_id } = req.body;

	// const transactionCode = makeid(8);

	Cashier.findOne(
		{
			token,
			status: 1
		},
		function(err, f) {
			if (err || f == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				OTP.findOne(
					{
						_id: otpId,
						otp: otp
					},
					function(err, otpd) {
						if (err || otpd == null) {
							res.status(402).json({
								error: "OTP Missmatch"
							});
						} else {
							CashierTransfer.findOne(
								{
									_id: transfer_id
								},
								function(err, item) {
									if (err || item == null) {
										res.status(401).json({
											error: "Unauthorized"
										});
									} else {
										Cashier.findOne(
											{
												_id: item.sender_id
											},
											function(err, u) {
												if (err || u == null) {
													res.status(401).json({
														error: "Unauthorized"
													});
												} else {
													//   CashierTransfer.findByIdAndUpdate(transfer_id, {
													//           status: -1
													//         }, (err) => {
													//           if (err) return res.status(200).json({
													//             error: err
													//           });
													//             res.status(200)
													// .json({
													//   success: "true"
													// });
													//         });

													let cashInHand = Number(u.cash_in_hand) + Number(item.amount);
													CashierTransfer.findByIdAndUpdate(
														item._id,
														{
															status: -1
														},
														(e, data) => {
															Cashier.findByIdAndUpdate(
																item.sender_id,
																{
																	cash_in_hand: cashInHand
																},
																(e, data) => {
																	res.status(200).json({
																		success: true
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

router.post("/getCashierTransLimit", function(req, res) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";

	const { token } = req.body;

	Cashier.findOne(
		{
			token,
			status: 1
		},
		function(err, t1) {
			if (err || t1 == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				let limit = Number(t1.max_trans_amt) - (Number(t1.cash_received) + Number(t1.cash_paid));
				limit = limit < 0 ? 0 : limit;
				res.status(200).json({
					limit: limit,
					closingTime: t1.closing_time,
					transactionStarted: t1.transaction_started,
					cashInHand: t1.cash_in_hand,
					isClosed: t1.is_closed
				});
				// console.log(t1._id );

				// CashierLedger.findOne({
				//   cashier_id: t1._id,
				//   created_at: {$gte: new Date(start), $lte: new Date(end)},
				//   trans_type: "CR",
				//   status : 1
				// }, function (err, data) {

				//           CashierLedger.findOne({
				//           cashier_id : t1._id,
				//           created_at: {$gte: new Date(start), $lte: new Date(end)},
				//           trans_type : "DR",
				//           status : 1
				//         }, function (err, data2) {

				//           var d1 = (data && data.amount != undefined  && data.amount != null && data.amount != '') ? Number(data.amount) : 0;
				//          var d2 =  (data2 && data2.amount != undefined && data2.amount != null && data2.amount != '') ? Number(data2.amount) : 0;

				//         let limit = Number(t1.max_trans_amt) - (d1+d2);
				//         res.status(200)
				//           .json({
				//             limit: limit
				//           });

				//     });

				//   });
			}
		}
	);
});

router.post("/getCashier", function(req, res) {
	const { token } = req.body;

	Cashier.findOne(
		{
			token,
			status: 1
		},
		function(err, t1) {
			if (err || t1 == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				Cashier.findOne({ _id: t1._id }, function(err, data) {
					if (err) {
						res.status(404).json({
							error: err
						});
					} else {
						BankUser.findOne({ _id: data.bank_user_id }, function(err, data2) {
							res.status(200).json({
								row: data,
								row2: data2
							});
						});
					}
				});
			}
		}
	);
});

router.post("/checkCashierFee", function(req, res) {
	const { amount, token, bankName } = req.body;

	Cashier.findOne(
		{
			token,
			status: 1
		},
		function(err, f) {
			if (err || f == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				Branch.findOne(
					{
						_id: f.branch_id
					},
					function(err, f2) {
						if (err || f2 == null) {
							res.status(402).json({
								error: "Not Found"
							});
						} else {
							Bank.findOne(
								{
									_id: f.bank_id
								},
								function(err, f3) {
									if (err || f3 == null) {
										res.status(402).json({
											error: "Not Found"
										});
									} else {
										const branchOpWallet = f2.bcode + "_operational@" + f3.name;
										oamount = Number(amount);

										getTransactionCount(branchOpWallet).then(function(count) {
											count = Number(count) + 1;
											const find = {
												bank_id: f3._id,
												trans_type: "Non Wallet to Non Wallet",
												status: 1,
												active: "Active"
											};
											console.log(find);
											BankFee.findOne(find, function(err, fe) {
												if (err || fe == null) {
													res.status(200).json({
														fee: "(Transaction cannot be done at this time)1"
													});
												} else {
													if (
														Number(amount) >= Number(fe.trans_from) &&
														Number(amount) <= Number(fe.trans_to)
													) {
														var ranges = JSON.parse(fe.ranges);
														var found = 0,
															fee = 0;

														if (ranges.length > 0) {
															ranges.map(function(v) {
																if (found == 1) {
																} else {
																	if (
																		Number(count) >= Number(v.trans_from) &&
																		Number(count) <= Number(v.trans_to)
																	) {
																		var temp = (oamount * Number(v.percentage)) / 100;
																		fee = temp + Number(v.fixed_amount);
																		found = 1;
																	}
																}
															});
															if (found == 1) {
																res.status(200).json({
																	fee: fee
																});
															} else {
																res.status(200).json({
																	fee: "(Transaction cannot be done at this time)2"
																});
															}
														}
													} else {
														res.status(200).json({
															fee: "(Transaction cannot be done at this time) "
														});
													}
												}
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
	);
});

router.post("/cashierSendMoney", function(req, res) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	var now = new Date().getTime();

	const {
		otpId,
		token,
		otp,
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
		receiverIdentificationAmount
	} = req.body;

	const transactionCode = makeid(8);

	Cashier.findOne(
		{
			token,
			status: 1
		},
		function(err, f) {
			if (err || f == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				Branch.findOne(
					{
						_id: f.branch_id
					},
					function(err, f2) {
						if (err || f2 == null) {
							res.status(402).json({
								error: "Branch Not Found"
							});
						} else {
							Bank.findOne(
								{
									_id: f.bank_id
								},
								function(err, f3) {
									if (err || f3 == null) {
										res.status(402).json({
											error: "Bank Not Found"
										});
									} else {
										Infra.findOne(
											{
												_id: f3.user_id
											},
											function(err, f4) {
												if (err || f4 == null) {
													res.status(402).json({
														error: "Infra Not Found"
													});
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
														note: note
													};
													data.sender_info = JSON.stringify(temp);
													temp = {
														country: senderIdentificationCountry,
														type: senderIdentificationType,
														number: senderIdentificationNumber,
														valid: senderIdentificationValidTill
													};
													data.sender_id = JSON.stringify(temp);
													temp = {
														mobile: receiverMobile,
														ccode: receiverccode,
														givenname: receiverGivenName,
														familyname: receiverFamilyName,
														country: receiverCountry,
														email: receiverEmail
													};
													data.receiver_info = JSON.stringify(temp);
													temp = {
														country: receiverIdentificationCountry,
														type: receiverIdentificationType,
														number: receiverIdentificationNumber,
														valid: receiverIdentificationValidTill
													};
													data.receiver_id = JSON.stringify(temp);
													data.amount = receiverIdentificationAmount;
													data.fee = livefee;
													data.cashier_id = f._id;
													data.transaction_code = transactionCode;

													var mns = f2.mobile.slice(-2);
													var mnr = f3.mobile.slice(-2);
													var master_code = mns + "" + mnr + "" + now;
													var child_code = mns + "" + mnr + "" + now;
													data.master_code = master_code;
													data.child_code = child_code;

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
														if (err)
															return res.json({
																error: err.toString()
															});

														const branchOpWallet = f2.bcode + "_operational@" + f3.name;
														const bankEsWallet = "escrow@" + f3.name;
														const bankOpWallet = "operational@" + f3.name;
														const infraOpWallet = "infra_operational@" + f3.name;

														const amount = receiverIdentificationAmount;
														oamount = Number(amount);

														getTransactionCount(branchOpWallet).then(function(count) {
															count = Number(count) + 1;
															const find = {
																bank_id: f3._id,
																trans_type: "Non Wallet to Non Wallet",
																status: 1,
																active: "Active"
															};
															BankFee.findOne(find, function(err, fe) {
																if (err || fe == null) {
																	res.status(402).json({
																		error: "Revenue Rule Not Found"
																	});
																} else {
																	if (
																		Number(amount) >= Number(fe.trans_from) &&
																		Number(amount) <= Number(fe.trans_to)
																	) {
																		var ranges = JSON.parse(fe.ranges);
																		var found = 0,
																			fee = 0;

																		if (ranges.length > 0) {
																			ranges.map(function(v) {
																				if (found == 1) {
																				} else {
																					if (
																						Number(count) >= Number(v.trans_from) &&
																						Number(count) <= Number(v.trans_to)
																					) {
																						var temp = (oamount * Number(v.percentage)) / 100;
																						fee = temp + Number(v.fixed_amount);
																						found = 1;
																					}
																				}
																			});

																			if (found == 1) {
																				let trans1 = {};
																				trans1.from = branchOpWallet;
																				trans1.to = bankEsWallet;
																				trans1.amount = oamount;
																				trans1.note = "Cashier Send Money";
																				trans1.email1 = f2.email;
																				trans1.email2 = f3.email;
																				trans1.mobile1 = f2.mobile;
																				trans1.mobile2 = f3.mobile;
																				trans1.master_code = master_code;
																				trans1.child_code = child_code + "1";

																				let trans2 = {};
																				trans2.from = branchOpWallet;
																				trans2.to = bankOpWallet;
																				trans2.amount = fee;
																				trans2.note = "Cashier Send Money Fee";
																				trans2.email1 = f2.email;
																				trans2.email2 = f3.email;
																				trans2.mobile1 = f2.mobile;
																				trans2.mobile2 = f3.mobile;
																				trans2.master_code = master_code;
																				now = new Date().getTime();
																				child_code = mns + "" + mnr + "" + now;
																				trans2.child_code = child_code + "2";

																				getBalance(branchOpWallet).then(function(bal) {
																					if (
																						Number(bal) + Number(f2.credit_limit) >=
																						oamount + fee
																					) {
																						getTransactionCount(bankOpWallet).then(function(count) {
																							count = Number(count) + 1;
																							const find = {
																								bank_id: f3._id,
																								trans_type: "Non Wallet to Non Wallet",
																								status: 1,
																								active: "Active"
																							};
																							Fee.findOne(find, function(err, fe) {
																								if (err || fe == null) {
																									res.status(200).json({
																										error: "Revenue Rule Not Found"
																									});
																								} else {
																									var ranges = JSON.parse(fe.ranges);
																									var found = 0,
																										amt = 0;

																									if (ranges.length > 0) {
																										ranges.map(function(v) {
																											console.log(v);
																											if (found == 1) {
																											} else {
																												//  if(Number(count) >= Number(v.trans_from) && Number(count) <= Number(v.trans_to)){
																												if (true) {
																													var temp =
																														(fee * Number(v.percentage)) / 100;
																													amt = temp + Number(v.fixed_amount);
																													found = 1;
																												}
																											}
																										});
																									}

																									let trans3 = {};
																									trans3.from = bankOpWallet;
																									trans3.to = infraOpWallet;
																									trans3.amount = amt;
																									trans3.note = "Cashier Send Money Infra Fee";
																									trans3.email1 = f3.email;
																									trans3.email2 = f4.email;
																									trans3.mobile1 = f3.mobile;
																									trans3.mobile2 = f4.mobile;
																									trans3.master_code = master_code;
																									mns = f3.mobile.slice(-2);
																									mnr = f4.mobile.slice(-2);
																									now = new Date().getTime();
																									child_code = mns + "" + mnr + "" + now + "3";
																									trans3.child_code = child_code;

																									//Code by Hatim

																									//what i need
																									//branchId
																									//feeId

																									const {
																										standardRevenueSharingRule,
																										branchWithSpecificRevenue
																									} = fe;
																									let feeObject;
																									let sendFee = 0;

																									if (branchWithSpecificRevenue) {
																										feeObject = branchWithSpecificRevenue.filter(
																											bwsf => bwsf.branchId == f2.bcode
																										)[0];
																									}

																									if (!feeObject) {
																										feeObject = standardRevenueSharingRule;
																									}

																									if (feeObject) {
																										const { send } = feeObject;
																										sendFee = (send * fee) / 100;
																									}

																									let trans4 = {};
																									trans4.from = bankOpWallet;
																									trans4.to = branchOpWallet;
																									//cacluat the revene here and replace with fee below.
																									trans4.amount = Number(sendFee).toFixed(2);
																									// trans4.amount = 1 ;
																									trans4.note =
																										"Bank Send Revenue Branch for Sending money";
																									trans4.email1 = f2.email;
																									trans4.email2 = f3.email;
																									trans4.mobile1 = f2.mobile;
																									trans4.mobile2 = f3.mobile;
																									trans4.master_code = master_code;
																									now = new Date().getTime();
																									child_code = mns + "" + mnr + "" + now;
																									trans4.child_code = child_code + "4";
																									//End
																									console.log(
																										found,
																										sendFee,
																										feeObject,
																										standardRevenueSharingRule,
																										branchWithSpecificRevenue,
																										f2.bcode
																									);

																									if (found == 1) {
																										transferThis(
																											trans1,
																											trans2,
																											trans3,
																											trans4
																										).then(function(result) {
																											console.log("Result: " + result);
																											if (result.length <= 0) {
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
																														fee: fee
																													},
																													err => {
																														if (err)
																															return res.status(200).json({
																																error: err
																															});
																														Cashier.findByIdAndUpdate(
																															f._id,
																															{
																																cash_received:
																																	Number(f.cash_received) +
																																	Number(oamount) +
																																	Number(fee),
																																cash_in_hand:
																																	Number(f.cash_in_hand) +
																																	Number(oamount) +
																																	Number(fee),
																																fee_generated:
																																	Number(sendFee) +
																																	Number(f.fee_generated),

																																total_trans:
																																	Number(f.total_trans) + 1
																															},
																															function(e, v) {}
																														);

																														CashierLedger.findOne(
																															{
																																cashier_id: f._id,
																																trans_type: "CR",
																																created_at: {
																																	$gte: new Date(start),
																																	$lte: new Date(end)
																																}
																															},
																															function(err, c) {
																																if (err || c == null) {
																																	let data = new CashierLedger();
																																	data.amount =
																																		Number(oamount) + Number(fee);
																																	data.trans_type = "CR";
																																	data.transaction_details = JSON.stringify(
																																		{ fee: fee }
																																	);
																																	data.cashier_id = f._id;
																																	data.save(function(err, c) {});
																																} else {
																																	var amt =
																																		Number(c.amount) +
																																		Number(oamount) +
																																		Number(fee);
																																	CashierLedger.findByIdAndUpdate(
																																		c._id,
																																		{ amount: amt },
																																		function(err, c) {}
																																	);
																																}
																															}
																														);
																														res.status(200).json({
																															status: "success"
																														});
																													}
																												);
																											} else {
																												res.status(200).json({
																													error: result.toString()
																												});
																											}
																										});
																									}
																								}
																							});
																						});
																					}
																				});
																			} else {
																				res.status(200).json({
																					error: "Revenue Rule Not Found"
																				});
																			}
																		}
																	} else {
																		res.status(200).json({
																			error: "Revenue Rule Not Found"
																		});
																	}
																}
															});
														});
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
});

router.post("/cashierSendMoneyPending", function(req, res) {
	const {
		otpId,
		token,
		otp,
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
		receiverIdentificationAmount
	} = req.body;

	Cashier.findOne(
		{
			token,
			status: 1
		},
		function(err, f) {
			if (err || f == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
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
					receiverIdentificationAmount
				};
				data.sender_name = givenname + " " + familyname;
				data.receiver_name = receiverGivenName + " " + receiverFamilyName;
				data.amount = receiverIdentificationAmount;
				data.transaction_details = JSON.stringify(temp);
				data.cashier_id = f._id;

				let pending = Number(f.pending_trans) + 1;

				data.save((err, d) => {
					if (err)
						return res.json({
							error: err.toString()
						});

					Cashier.findByIdAndUpdate(f._id, { pending_trans: pending }, function(e, d) {
						if (e && d == null) {
							res.status(200).json({
								error: e.toString()
							});
						} else {
							res.status(200).json({
								status: "success"
							});
						}
					});
				}); //save
			}
		}
	);
});

router.post("/cashierTransferMoney", function(req, res) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	var now = new Date().getTime();

	const { otpId, token, otp, amount, receiver_id, receiver_name } = req.body;

	// const transactionCode = makeid(8);

	Cashier.findOne(
		{
			token,
			status: 1
		},
		function(err, f) {
			if (err || f == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				OTP.findOne(
					{
						_id: otpId,
						otp: otp
					},
					function(err, otpd) {
						if (err || otpd == null) {
							res.status(402).json({
								error: "OTP Missmatch"
							});
						} else {
							let data = new CashierTransfer();
							data.amount = amount;
							data.sender_id = f._id;
							data.receiver_id = receiver_id;
							data.sender_name = f.name;
							data.receiver_name = receiver_name;
							let cashInHand = Number(f.cash_in_hand);
							cashInHand = cashInHand - Number(amount);
							data.save(err => {
								if (err)
									return res.status(200).json({
										error: err.toString()
									});

								Cashier.findByIdAndUpdate(
									f._id,
									{ cash_in_hand: cashInHand, cash_transferred: amount },
									function(e, d) {
										if (e)
											return res.status(200).json({
												error: e.toString()
											});
										res.status(200).json({
											status: "success"
										});
									}
								);
							});
						}
					}
				);
			}
		}
	); //branch
});

router.post("/cashierVerifyClaim", function(req, res) {
	const { otpId, token, otp } = req.body;

	Cashier.findOne(
		{
			token,
			status: 1
		},
		function(err, f) {
			if (err || f == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				OTP.findOne(
					{
						_id: otpId,
						otp: otp
					},
					function(err, otpd) {
						if (err || otpd == null) {
							res.status(402).json({
								error: "OTP Missmatch"
							});
						} else {
							res.status(200).json({
								status: "success"
							});
						}
					}
				);
			}
		}
	);
});

router.post("/branchVerifyOTPClaim", function(req, res) {
	const { transferCode, token, otp } = req.body;

	Branch.findOne(
		{
			token,
			status: 1
		},
		function(err, f) {
			if (err || f == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				BranchSend.findOne(
					{
						transaction_code: transferCode,
						otp: otp
					},
					function(err, otpd) {
						if (err || otpd == null) {
							res.status(402).json({
								error: "OTP Missmatch"
							});
						} else {
							res.status(200).json({
								status: "success"
							});
						}
					}
				);
			}
		}
	);
});

router.post("/cashierClaimMoney", function(req, res) {
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
		receiverFamilyName
	} = req.body;

	Cashier.findOne(
		{
			token,
			status: 1
		},
		function(err, f) {
			if (err || f == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				CashierSend.findOne(
					{
						transaction_code: transferCode
					},
					function(err, otpd) {
						if (err || otpd == null) {
							res.status(402).json({
								error: "Transaction Not Found"
							});
						} else {
							Branch.findOne(
								{
									_id: f.branch_id
								},
								function(err, f2) {
									if (err || f2 == null) {
										res.status(200).json({
											error: "Branch Not Found"
										});
									} else {
										Bank.findOne(
											{
												_id: f.bank_id
											},
											function(err, f3) {
												if (err || f3 == null) {
													res.status(200).json({
														error: "Bank Not Found"
													});
												} else {
													Infra.findOne(
														{
															_id: f3.user_id
														},
														function(err, f4) {
															if (err || f4 == null) {
																res.status(200).json({
																	error: "Infra Not Found"
																});
															} else {
																let data = new CashierClaim();
																data.transaction_code = transferCode;
																data.proof = proof;
																data.cashier_id = f._id;
																data.amount = otpd.amount;
																data.fee = otpd.fee;
																data.sender_name = givenname + " " + familyname;
																data.receiver_name = receiverGivenName + " " + receiverFamilyName;
																var mns = f3.mobile.slice(-2);
																var mnr = f2.mobile.slice(-2);
																var now = new Date().getTime();
																var child_code = mns + "" + mnr + "" + now;
																var master_code = otpd.master_code;
																data.master_code = master_code;
																data.child_code = child_code + "1";

																const oamount = otpd.amount;
																data.save((err, cashierClaimObj) => {
																	if (err)
																		return res.json({
																			error: err.toString()
																		});

																	const branchOpWallet = f2.bcode + "_operational@" + f3.name;
																	const bankEsWallet = "escrow@" + f3.name;
																	let trans1 = {};
																	trans1.from = bankEsWallet;
																	trans1.to = branchOpWallet;
																	trans1.amount = oamount;
																	trans1.note = "Cashier claim Money";
																	trans1.email1 = f3.email;
																	trans1.email2 = f2.email;
																	trans1.mobile1 = f3.mobile;
																	trans1.mobile2 = f2.mobile;
																	trans1.master_code = master_code;
																	trans1.child_code = child_code;

																	//Code by hatim

																	//req
																	//branchId
																	//feeId
																	//bankFee

																	let amount = oamount;

																	getTransactionCount(branchOpWallet).then(function(count) {
																		count = Number(count) + 1;
																		const find = {
																			bank_id: f.bank_id,
																			trans_type: "Non Wallet to Non Wallet",
																			status: 1,
																			active: "Active"
																		};
																		BankFee.findOne(find, function(err, fe) {
																			if (err || fe == null) {
																				res.status(402).json({
																					error: "Revenue Rule Not Found"
																				});
																			} else {
																				if (amount >= fe.trans_from && amount <= fe.trans_to) {
																					var ranges = JSON.parse(fe.ranges);
																					var found = 0,
																						fee = 0;

																					if (ranges.length > 0) {
																						ranges.map(function(v) {
																							if (found == 1) {
																							} else {
																								if (
																									Number(count) >= Number(v.trans_from) &&
																									Number(count) <= Number(v.trans_to)
																								) {
																									var temp = (oamount * Number(v.percentage)) / 100;
																									fee = temp + Number(v.fixed_amount);

																									found = 1;
																								}
																							}
																						});

																						const sendFeeOptions = {
																							bankFeeId: fe._id
																						};

																						Fee.findOne(sendFeeOptions).then(d => {
																							// const { standardRevenueSharingRule, branchWithSpecificRevenue } = d;
																							// let feeObject;
																							// let claimFee = 0;

																							// if(branchWithSpecificRevenue) {

																							//   feeObject = branchWithSpecificRevenue.filter(bwsf => bwsf.branchId == f2.bcode)[0];

																							// }else {
																							//   feeObject = standardRevenueSharingRule;
																							// }

																							// if(feeObject) {
																							//   const {claim} = feeObject;
																							//   claimFee = (claim * fee / 100)
																							// }

																							const {
																								standardRevenueSharingRule,
																								branchWithSpecificRevenue
																							} = d;
																							let feeObject;
																							let claimFee = 0;

																							if (branchWithSpecificRevenue) {
																								feeObject = branchWithSpecificRevenue.filter(
																									bwsf => bwsf.branchId == f2.bcode
																								)[0];
																							}

																							if (!feeObject) {
																								feeObject = standardRevenueSharingRule;
																							}

																							if (feeObject) {
																								const { claim } = feeObject;
																								claimFee = (claim * fee) / 100;
																							}

																							const bankOpWallet = "operational@" + f3.name;
																							let trans2 = {};
																							trans2.from = bankOpWallet;
																							trans2.to = branchOpWallet;
																							//Replace the amount with the Claim Revenue below
																							trans2.amount = claimFee;
																							trans2.note = "Revenue for claim Money";
																							trans2.email1 = f2.email;
																							trans2.email2 = f3.email;
																							trans2.mobile1 = f2.mobile;
																							trans2.mobile2 = f3.mobile;
																							trans2.master_code = master_code;
																							trans1.child_code = data.child_code + "2";

																							//End of hatim Code

																							transferThis(trans1, trans2).then(function(result) {
																								if (result.length <= 0) {
																									CashierClaim.findByIdAndUpdate(
																										cashierClaimObj._id,
																										{
																											status: 1
																										},
																										err => {
																											if (err)
																												return res.status(200).json({
																													error: err.toString()
																												});
																											Cashier.findByIdAndUpdate(
																												f._id,
																												{
																													cash_paid:
																														Number(f.cash_paid) + Number(oamount),
																													cash_in_hand:
																														Number(f.cash_in_hand) -
																														Number(oamount),
																													fee_generated:
																														Number(f.fee_generated) +
																														Number(claimFee),

																													total_trans: Number(f.total_trans) + 1
																												},
																												function(e, v) {}
																											);
																											CashierLedger.findOne(
																												{
																													cashier_id: f._id,
																													trans_type: "DR",
																													created_at: {
																														$gte: new Date(start),
																														$lte: new Date(end)
																													}
																												},
																												function(err, c) {
																													if (err || c == null) {
																														let data = new CashierLedger();
																														data.amount = Number(oamount);
																														data.trans_type = "DR";
																														data.cashier_id = f._id;
																														data.save(function(err, c) {});
																													} else {
																														var amt =
																															Number(c.amount) + Number(oamount);
																														CashierLedger.findByIdAndUpdate(
																															c._id,
																															{ amount: amt },
																															function(err, c) {}
																														);
																													}
																												}
																											);

																											res.status(200).json({
																												status: "success"
																											});
																										}
																									);
																								} else {
																									res.status(200).json({
																										error: result.toString()
																									});
																								}
																							});
																						});
																					}
																				}
																			}
																		});
																	});
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

router.post("/getClaimMoney", function(req, res) {
	const { transferCode, token } = req.body;

	Cashier.findOne(
		{
			token,
			status: 1
		},
		function(err, f) {
			if (err || f == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				CashierClaim.findOne(
					{
						transaction_code: transferCode,
						status: 1
					},
					function(err, cs) {
						if (err || cs == null) {
							CashierSend.findOne(
								{
									transaction_code: transferCode
								},
								function(err, cs) {
									if (err || cs == null) {
										res.status(402).json({
											error: "Record Not Found"
										});
									} else {
										res.status(200).json({
											row: cs
										});
									}
								}
							);
						} else {
							res.status(200).json({
								error: "This transaction was already claimed"
							});
						}
					}
				);
			}
		}
	);
});

module.exports = router;
