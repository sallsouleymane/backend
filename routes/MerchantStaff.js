const express = require("express");
const router = express.Router();

const jwtTokenAuth = require("./JWTTokenAuth");
const cashierCommonContrl = require("../controllers/merchantCashier/common");
const { errorMessage, catchError } = require("./utils/errorHandler");

//models
const Merchant = require("../models/merchant/Merchant");
const MerchantBranch = require("../models/merchant/MerchantBranch");
const MerchantPosition = require("../models/merchant/Position");
const InvoiceGroup = require("../models/merchant/InvoiceGroup");
const Invoice = require("../models/merchant/Invoice");
const Offering = require("../models/merchant/Offering");
const User = require("../models/User");
const Tax = require("../models/merchant/Tax");
const OTP = require("../models/OTP");
const MerchantSettings = require("../models/merchant/MerchantSettings");
const Customer = require("../models/merchant/Customer");
const CashierLedger = require("../models/CashierLedger");
const CashierTransfer = require("../models/CashierTransfer");
const DailyReport = require("../models/cashier/DailyReport");

router.post(
	"/merchantStaff/queryTransactionStates",
	jwtTokenAuth,
	cashierCommonContrl.queryTransactionStates
);

router.post(
	"/merchantStaff/queryDailyReport",
	jwtTokenAuth,
	cashierCommonContrl.queryDailyReport
);

router.post(
	"/merchantStaff/getDailyReport",
	jwtTokenAuth,
	function (req, res) {
		const { start, end } = req.body;
		const jwtusername = req.sign_creds.username;
		MerchantPosition.findOne(
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
					DailyReport.find(
						{ 	cashier_id: user._id,
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
	"/merchantStaff/getClosingBalance",
	jwtTokenAuth,
	function (req, res) {

		const jwtusername = req.sign_creds.username;
		MerchantPosition.findOne(
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
					var da = c.closing_time;
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
	}
);

router.post(
	"/merchantStaff/addClosingBalance",
	jwtTokenAuth,
	function (req, res) {
		const { total } = req.body;
		const jwtusername = req.sign_creds.username;
		MerchantPosition.findOne(
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
					let data = new DailyReport();
					data.cashier_id = otpd._id;
					data.created_at = new Date();
					data.user = "Merchant Cashier";
					data.opening_balance = otpd.opening_balance;
					data.closing_balance = otpd.opening_balance + total;
					data.cash_in_hand = otpd.cash_in_hand;
					data.opening_time = otpd.opening_time;
					data.closing_time = new Date();
					data.descripency =  total - otpd.cash_in_hand - otpd.opening_balance;
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
							MerchantPosition.findByIdAndUpdate(
								otpd._id,
								{
									closing_balance: otpd.opening_balance + total,
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
	}
);

router.post(
	"/merchantStaff/openCashierBalance",
	jwtTokenAuth,
	function (req, res) {
		const jwtusername = req.sign_creds.username;
		MerchantPosition.findOne(
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
					var bal = ba.closing_balance;
					const upd = {
						cash_in_hand: bal,
						opening_balance: bal,
						closing_balance: 0,
						opening_time: new Date(),
						closing_time: null,
						is_closed: false,
					};
					console.log(upd);

					MerchantPosition.findByIdAndUpdate(ba._id, upd, (err1) => {
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
								message: "Cashier is open now",
							});
						}
					});
				}
			}
		);
	}
);

router.post(
	"/merchantStaff/openstaff",
	jwtTokenAuth,
	function (req, res) {
		const jwtusername = req.sign_creds.username;
		MerchantPosition.findOne(
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
					const upd = {
						is_closed: false,
						opening_time: new Date(),
					};
					console.log(upd);

					MerchantPosition.findByIdAndUpdate(ba._id, upd, (err1) => {
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
								message: "Cashier is open now",
							});
						}
					});
				}
			}
		);
	}
);

router.post(
	"/merchantStaff/closeStaff",
	jwtTokenAuth,
	function (req, res) {
		const jwtusername = req.sign_creds.username;
		MerchantPosition.findOne(
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
					const upd = {
						is_closed: true,
					};
					console.log(upd);

					MerchantPosition.findByIdAndUpdate(ba._id, upd, (err1) => {
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
								message: "Cashier is closed now",
							});
						}
					});
				}
			}
		);
	}
);

router.post(
	"/merchantStaff/getCashierIncomingTransfer",
	jwtTokenAuth,
	function (req, res) {
		const jwtusername = req.sign_creds.username;
		MerchantPosition.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err1, user) {
				let result1 = errorMessage(
					err1,
					user,
					"Token changed or user not valid. Try to login again or contact system administrator."
				);
				if (result1.status == 0) {
					res.status(200).json(result1);
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
	}
);

router.post(
	"/merchantStaff/cashierTransferMoney",
	jwtTokenAuth,
	function (req, res) {
		const { otpId, otp, amount, receiver_id, receiver_name } = req.body;

		// const transactionCode = makeid(8);

		const jwtusername = req.sign_creds.username;
		MerchantPosition.findOne(
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
										MerchantPosition.findByIdAndUpdate(
											f._id,
											{ cash_transferred: amount },
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
	}
);

router.post(
	"/merchantStaff/cashierAcceptIncoming",
	jwtTokenAuth,
	function (req, res) {
		const { item } = req.body;
		const jwtusername = req.sign_creds.username;
		MerchantPosition.findOne(
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
					MerchantPosition.findOne(
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
									(e, data21) => {
										MerchantPosition.findByIdAndUpdate(
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
													MerchantPosition.findByIdAndUpdate(
														item.sender_id,
														{
															$inc: { cash_in_hand: -Number(item.amount) },
														},
														(err3, data3) => {
															let result3 = errorMessage(
																err3,
																data3,
																"Cashier transfer record not found"
															);
															if (result3.status == 0) {
																res.status(200).json(result3);
															} else {
																res.status(200).json({
																	status: 1,
																	message: "Success",
																});
															}
														}
													);
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
	}
);

router.post(
	"/merchantStaff/cashierCancelTransfer",
	jwtTokenAuth,
	function (req, res) {
		const { otpId, otp, transfer_id } = req.body;

		// const transactionCode = makeid(8);

		const jwtusername = req.sign_creds.username;
		MerchantPosition.findOne(
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
											MerchantPosition.findOne(
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
																MerchantPosition.findByIdAndUpdate(
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
	}
);

router.post(
	"/merchantStaff/getCashierTransfers",
	jwtTokenAuth,
	function (req, res) {
		const jwtusername = req.sign_creds.username;
		MerchantPosition.findOne(
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
	}
);

router.post(
	"/merchantStaff/getCashierDashStats",
	jwtTokenAuth,
	function (req, res) {
		const jwtusername = req.sign_creds.username;
		MerchantPosition.findOne(
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
						cashInHand: user.cash_in_hand,
						closingTime: user.closing_time,
						openingTime: user.opening_time,
						discrepancy: user.discrepancy,
						branchId: user.branch_id,
						isClosed: user.is_closed,
					});
				}
			}
		);
	}
);

router.post("/merchantStaff/getPositionDetails", jwtTokenAuth, (req, res) => {
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, position) {
			let result = errorMessage(
				err,
				position,
				"Position blocked or not assigned"
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				res.status(200).json({
					status: 1,
					position: position,
				});
			}
		}
	);
});

router.post("/merchantStaff/listAllInvoices", jwtTokenAuth, (req, res) => {
	const { group_id } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			type: "staff",
			status: 1,
		},
		function (err, position) {
			let result = errorMessage(err, position, "Position is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Invoice.find({ group_id }, (err1, invoices) => {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message1) {
							message1 = err1.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else {
						res.status(200).json({
							status: 1,
							invoices: invoices,
						});
					}
				});
			}
		}
	);
});

router.post("/merchantStaff/billNumberSetting", jwtTokenAuth, (req, res) => {
	const { counter } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOneAndUpdate(
		{
			username: jwtusername,
			type: "staff",
			status: 1,
		},
		{ counter: counter },
		function (err, position) {
			let result = errorMessage(
				err,
				position,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				res.status(200).json({
					status: 1,
					message: "Counter Edited",
				});
			}
		}
	);
});

router.post(
	"/merchantStaff/getCustomerForMobile",
	jwtTokenAuth,
	function (req, res) {
		const { mobile } = req.body;
		const jwtusername = req.sign_creds.username;
		MerchantPosition.findOne(
			{
				username: jwtusername,
				type: "staff",
				status: 1,
			},
			function (err, position) {
				let result = errorMessage(
					err,
					position,
					"Merchant Position is not valid"
				);
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					Customer.findOne(
						{ merchant_id: position.merchant_id, mobile: mobile },
						(err1, customer) => {
							let result1 = errorMessage(err1, customer, "Customer not found");
							if (result1.status == 0) {
								res.status(200).json(result1);
							} else {
								res.status(200).json({
									status: 1,
									customer: customer,
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
	"/merchantStaff/getCustomerForCode",
	jwtTokenAuth,
	function (req, res) {
		const { customer_code } = req.body;
		const jwtusername = req.sign_creds.username;
		MerchantPosition.findOne(
			{
				username: jwtusername,
				type: "staff",
				status: 1,
			},
			function (err, position) {
				let result = errorMessage(
					err,
					position,
					"Merchant Position is not valid"
				);
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					Customer.findOne(
						{ merchant_id: position.merchant_id, customer_code: customer_code },
						(err1, customer) => {
							let result1 = errorMessage(err1, customer, "Customer not found");
							if (result1.status == 0) {
								res.status(200).json(result1);
							} else {
								res.status(200).json({
									status: 1,
									customer: customer,
								});
							}
						}
					);
				}
			}
		);
	}
);

router.post("/merchantStaff/createCustomer", jwtTokenAuth, (req, res) => {
	const {
		customer_code,
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
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{ username: jwtusername, type: "staff", status: 1 },
		function (err, position) {
			let result = errorMessage(
				err,
				position,
				"You are either not authorised or not logged in."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Customer.findOne(
					{
						merchant_id: position.merchant_id,
						customer_code: customer_code,
					},
					(err1, customer) => {
						let result1 = errorMessage(
							err1,
							customer,
							"Customer with the same customer code already exist",
							true
						);
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							var customerDetails = {
								customer_code: customer_code,
								merchant_id: position.merchant_id,
								name: name,
								last_name: last_name,
								mobile: mobile,
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
							Customer.create(customerDetails, (err2) => {
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
										message: "Created customer successfully",
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

router.post(
	"/merchantStaff/getUserFromMobile",
	jwtTokenAuth,
	function (req, res) {
		const { mobile } = req.body;
		const jwtusername = req.sign_creds.username;
		MerchantPosition.findOne(
			{
				username: jwtusername,
				type: "staff",
				status: 1,
			},
			function (err, position) {
				let result = errorMessage(err, position, "Merchant is not valid");
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					User.findOne({ mobile }, "-password", function (err1, user) {
						let result1 = errorMessage(err1, user, "User not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
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

router.post("/merchantStaff/listOfferings", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			type: "staff",
			status: 1,
		},
		function (err, position) {
			let result = errorMessage(err, position, "Merchant is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Offering.find(
					{ merchant_id: position.merchant_id },
					(err1, offerings) => {
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
								offerings: offerings,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchantStaff/listTaxes", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			type: "staff",
			status: 1,
		},
		function (err, position) {
			let result = errorMessage(err, position, "Merchant is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Tax.find({ merchant_id: position.merchant_id }, (err1, taxes) => {
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
							taxes: taxes,
						});
					}
				});
			}
		}
	);
});

router.post("/merchantStaff/deleteInvoice", jwtTokenAuth, function (req, res) {
	const { invoice_id } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			type: "staff",
			status: 1,
		},
		function (err, position) {
			let result = errorMessage(
				err,
				position,
				"Merchant position is not valid"
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Invoice.deleteOne({ _id: invoice_id, is_created: 1 }, (err1) => {
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
							message: "Invoice deleted",
						});
					}
				});
			}
		}
	);
});

router.post(
	"/merchantStaff/increaseCounter",
	jwtTokenAuth,
	function (req, res) {
		const jwtusername = req.sign_creds.username;
		MerchantPosition.findOneAndUpdate(
			{
				username: jwtusername,
				type: "staff",
				status: 1,
			},
			{ $inc: { counter: 1 } },
			function (err, position) {
				let result = errorMessage(
					err,
					position,
					"Merchant position is not valid"
				);
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					res.status(200).json({
						status: 1,
						message: "Counter Increased",
					});
				}
			}
		);
	}
);

router.get(
	"/merchantStaff/cashierDashStatus",
	jwtTokenAuth,
	function (req, res) {
		var today = new Date();
		today = today.toISOString();
		var s = today.split("T");
		var start = s[0] + "T00:00:00.000Z";
		var end = s[0] + "T23:59:59.999Z";
		const jwtusername = req.sign_creds.username;
		MerchantPosition.findOne(
			{
				username: jwtusername,
				type: "cashier",
				status: 1,
			},
			async function (err, position) {
				let result = errorMessage(err, position, "Position is not valid");
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					try {
						let status = await Invoice.aggregate([
							{
								$match: {
									payer_id: position._id.toString(),
									paid_by: "MC",
									paid: 1,
									date_paid: {
										$gte: new Date(
											start
										),
										$lte: new Date(
											end
										),
									},
								},
							},
							{
								$group: {
									_id: null,
									amount_collected: { $sum: "$amount" },
									penalty_collected: { $sum: "$penalty" },
									bills_paid: { $sum: 1 },
								},
							},
						]);
						console.log("status:", status);
						if (status.length > 0) {
							res.status(200).json({
								status: 1,
								message: "Today's Status",
								bills_paid: status[0].bills_paid,
								amount_collected: status[0].amount_collected,
								penalty_collected: status[0].penalty_collected,
							});
						} else {
							res.status(200).json({
								status: 1,
								message: "Today's Status",
								bills_paid: 0,
								amount_collected: 0,
								penalty_collected: 0,
							});
						}
					} catch (error) {
						res.status(200).json(catchError(error));
					}
				}
			}
		);
	}
);

router.post("/merchantStaff/staffDashStatus", jwtTokenAuth, function (req, res) {
	const startOfDay = new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString()
	const endOfDay = new Date(new Date().setUTCHours(23, 59, 59, 999)).toISOString()
	const { group_id } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			type: "staff",
			status: 1,
		},
		async function (err, position) {
			let result = errorMessage(err, position, "Position is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				try {
					let bills_raised = await Invoice.countDocuments({
						creator_id: position._id,
						is_validated: 1,
						created_at : {
							$gte: startOfDay, 
							$lt: endOfDay
						},
						group_id: group_id,
					});
					let bills_paid = await Invoice.countDocuments({
						creator_id: position._id,
						paid: 1,
						created_at : {
							$gte: startOfDay, 
							$lt: endOfDay
						},
						group_id: group_id,
					});
					let counter_invoices = await Invoice.countDocuments({
						creator_id: position._id,
						is_counter: true,
						created_at : {
							$gte: startOfDay, 
							$lt: endOfDay
						},
						group_id: group_id,
					});
					res.status(200).json({
						status: 1,
						message: "Today's Status",
						bills_paid: bills_paid,
						bills_raised: bills_raised,
						counter_invoices: counter_invoices,
						is_closed:position.is_closed,
						opening_time: position.opening_time,
					});
				} catch (error) {
					res.status(200).json(catchError(error));
				}
			}
		}
	);
});

router.post("/merchantStaff/createInvoiceGroup", jwtTokenAuth, (req, res) => {
	let data = new InvoiceGroup();
	const { code, name, description } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			type: "staff",
			status: 1,
		},
		function (err, position) {
			let result = errorMessage(err, position, "Position is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				data.code = code;
				data.name = name;
				data.description = description;
				data.position_id = position._id;
				data.save((err1, group) => {
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
						return res.status(200).json({
							status: 1,
							message: "Invoice Category Created",
							group: group,
						});
					}
				});
			}
		}
	);
});

router.post("/merchantStaff/editInvoiceGroup", jwtTokenAuth, (req, res) => {
	const { group_id, code, name, description } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			type: "staff",
			status: 1,
		},
		function (err, position) {
			let result = errorMessage(err, position, "Position is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				InvoiceGroup.findOneAndUpdate(
					{ _id: group_id, position_id: position._id },
					{ code: code, name: name, description: description },
					(err1, group) => {
						let result1 = errorMessage(err1, group, "Invoice Group not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								status: 1,
								message: "Invoice Group edited successfully",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchantStaff/listInvoiceGroups", jwtTokenAuth, (req, res) => {
	const { merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			type: "staff",
			status: 1,
		},
		function (err, position) {
			let result = errorMessage(err, position, "Position is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				InvoiceGroup.find({ merchant_id: merchant_id }, (err1, groups) => {
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
							message: "Invoice Groups list",
							groups: groups,
						});
					}
				});
			}
		}
	);
});

router.post("/merchantStaff/getSettings", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, position) {
			let result = errorMessage(err, position, "Merchant staff is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantSettings.findOne(
					{ merchant_id: position.merchant_id },
					(err1, setting) => {
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
						} else if (!setting) {
							res.status(200).json({
								status: 0,
								message: "Setting Not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								setting: setting,
							});
						}
					}
				);
			}
		}
	);
});

router.post(
	"/merchantStaff/getPositionSettings",
	jwtTokenAuth,
	function (req, res) {
		res.status(200).json({
			status: 0,
			setting: "This API is removed",
		});
	}
);

router.post("/merchantStaff/createInvoice", jwtTokenAuth, (req, res) => {
	var {
		group_id,
		number,
		name,
		last_name,
		address,
		email,
		amount,
		bill_date,
		bill_period,
		due_date,
		description,
		mobile,
		ccode,
		items,
		paid,
		is_validated,
		customer_code,
		is_counter,
		reference_invoice,
		term,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			type: "staff",
			status: 1,
		},
		(err, position) => {
			let result = errorMessage(err, position, "Position is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantBranch.findById(
					position.branch_id,
					async function (err1, branch) {
						let result1 = errorMessage(err1, branch, "Branch not Found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							Merchant.findById(
								branch.merchant_id,
								async function (err2, merchant) {
									let result2 = errorMessage(err2, merchant, "Merchant not Found");
									if (result2.status == 0) {
										res.status(200).json(result2);
									} else {
							
										InvoiceGroup.findOne(
											{ _id: group_id },
											async (err3, group) => {
												let result3 = errorMessage(err3, group, "Group not found");
												if (result3.status == 0) {
													res.status(200).json(result3);
												} else {
													try {
														if (is_counter) {
															var referenceFound = await Invoice.findOne({
																number: reference_invoice,
																merchant_id: position.merchant_id,
															});
															if (!referenceFound) {
																throw new Error("Referenced Invoice not found");
															}
														}
														if (paid != 1) {
															paid = 0;
														}
														var updatedItems = [];
														for (const item of items) {
															var { item_code, quantity, tax_code, total_amount } = item;
															var item_desc = await Offering.findOne(
																{ code: item_code, merchant_id: position.merchant_id },
																"code name denomination unit_of_measure unit_price description"
															);
															if (item_desc == null) {
																throw new Error("Item not found with code " + item_code);
															}

															var tax_desc = await Tax.findOne(
																{
																	code: tax_code,
																	merchant_id: position.merchant_id,
																},
																"code value"
															);
															if (tax_desc == null) {
																throw new Error("Tax not found with code " + tax_code);
															}

															updatedItems.push({
																item_desc: item_desc,
																quantity: quantity,
																tax_desc: tax_desc,
																total_amount: total_amount,
															});
														}
														var invoiceObj = new Invoice();
														invoiceObj.number = number;
														invoiceObj.name = name;
														invoiceObj.last_name = last_name;
														invoiceObj.email = email;
														invoiceObj.address = address;
														invoiceObj.amount = amount;
														invoiceObj.merchant_id = branch.merchant_id;
														invoiceObj.bill_date = bill_date;
														invoiceObj.branch_id = position.branch_id;
														invoiceObj.zone_id = branch.zone_id;
														invoiceObj.bank_id = merchant.bank_id;
														invoiceObj.subzone_id = branch.subzone_id;
														invoiceObj.bill_period = bill_period;
														invoiceObj.due_date = due_date;
														invoiceObj.description = description;
														invoiceObj.mobile = mobile;
														invoiceObj.ccode = ccode;
														invoiceObj.group_id = group_id;
														invoiceObj.creator_id = position._id;
														invoiceObj.paid = paid;
														invoiceObj.is_created = 1;
														invoiceObj.is_validated = is_validated;
														invoiceObj.items = updatedItems;
														invoiceObj.customer_code = customer_code;
														invoiceObj.is_counter = is_counter;
														invoiceObj.reference_invoice = reference_invoice;
														invoiceObj.term = term;
														await invoiceObj.save();

														if (is_counter) {
															await Invoice.updateOne(
																{
																	_id: referenceFound._id,
																},
																{ has_counter_invoice: true }
															);
														}
														var c = await MerchantPosition.findOneAndUpdate(
															{ _id: position._id },
															{
																$inc: {
																	bills_raised: 1,
																},
															}
														);
														if (c == null) {
															throw new Error(
																"Can not update the Merchant Position status."
															);
														}
														res.status(200).json({
															status: 1,
															message: "Invoice created",
															branch: branch,
														});
													} catch (error1) {
														console.log(error1);
														var message12 = error1;
														if (error12 && error1.message) {
															message12 = error12.message;
														}
														res.status(200).json({
															status: 0,
															message: message12,
															branch: branch,
														});
													}
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
	);
});

router.post("/merchantStaff/uploadInvoices", jwtTokenAuth, (req, res) => {
	const { group_id, invoices } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			type: "staff",
			status: 1,
		},
		(err, position) => {
			let result = errorMessage(err, position, "Position is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				InvoiceGroup.findOne(
					{ _id: group_id },
					async (err1, group) => {
						let result1 = errorMessage(err1, group, "Group not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							let failed = [];
							for (let invoice of invoices) {
								try {
									var {
										number,
										name,
										last_name,
										address,
										amount,
										bill_date,
										bill_period,
										due_date,
										description,
										mobile,
										ccode,
										items,
										paid,
										customer_code,
										is_counter,
										reference_invoice,
										term,
									} = invoice;
									if (is_counter) {
										var referenceFound = await Invoice.findOne({
											number: reference_invoice,
											merchant_id: position.merchant_id,
										});
										if (!referenceFound) {
											throw new Error("Referenced Invoice not found");
										}
									}
									if (paid != 1) {
										paid = 0;
									}
									var updatedItems = [];
									for (const item of items) {
										var { item_code, quantity, tax_code, total_amount } = item;
										var item_desc = await Offering.findOne(
											{ code: item_code, merchant_id: position.merchant_id },
											"code name denomination unit_of_measure unit_price description"
										);
										if (item_desc == null) {
											throw new Error("Item not found with code " + item_code);
										}

										var tax_desc = await Tax.findOne(
											{
												code: tax_code,
												merchant_id: position.merchant_id,
											},
											"code value"
										);
										if (tax_desc == null) {
											throw new Error("Tax not found with code " + tax_code);
										}

										updatedItems.push({
											item_desc: item_desc,
											quantity: quantity,
											tax_desc: tax_desc,
											total_amount: total_amount,
										});
									}
									let invoiceFound = await Invoice.findOne({
										number,
										merchant_id: position.merchant_id,
										paid: 0,
									});
									if (invoiceFound && invoiceFound.is_created == 0) {
										await Invoice.updateOne(
											{ _id: invoiceFound._id },
											{
												name,
												last_name,
												address,
												amount,
												bill_date,
												bill_period,
												due_date,
												description,
												mobile,
												ccode,
												group_id: group_id,
												creator_id: position._id,
												items: updatedItems,
												paid,
												customer_code,
												is_counter,
												reference_invoice,
												term,
											}
										);
										if (is_counter) {
											await Invoice.updateOne(
												{
													_id: referenceFound._id,
												},
												{ has_counter_invoice: true }
											);
										}
									} else if (invoiceFound && invoiceFound.is_created == 1) {
										throw new Error(
											"This Invoice number is in created state, so can not upload"
										);
									} else {
										var invoiceObj = new Invoice();
										invoiceObj.number = number;
										invoiceObj.name = name;
										invoiceObj.last_name = last_name;
										invoiceObj.address = address;
										invoiceObj.amount = amount;
										invoiceObj.merchant_id = position.merchant_id;
										invoiceObj.bill_date = bill_date;
										invoiceObj.bill_period = bill_period;
										invoiceObj.due_date = due_date;
										invoiceObj.description = description;
										invoiceObj.mobile = mobile;
										invoiceObj.ccode = ccode;
										invoiceObj.group_id = group_id;
										invoiceObj.creator_id = position._id;
										invoiceObj.paid = paid;
										invoiceObj.items = updatedItems;
										invoiceObj.is_created = 0;
										invoiceObj.is_validated = 1;
										invoiceObj.customer_code = customer_code;
										invoiceObj.is_counter = is_counter;
										invoiceObj.reference_invoice = reference_invoice;
										invoiceObj.term = term;
										await invoiceObj.save();

										if (is_counter) {
											await Invoice.updateOne(
												{
													_id: referenceFound._id,
												},
												{ has_counter_invoice: true }
											);
										}

										var branch = await MerchantBranch.findOneAndUpdate(
											{ _id: position.branch_id },
											{ $inc: { bills_raised: 1, amount_due: amount } }
										);
										if (branch == null) {
											throw new Error(
												"Can not update the Merchant Branch status."
											);
										}

										var m = await Merchant.findOneAndUpdate(
											{ _id: branch.merchant_id },
											{
												$inc: {
													bills_raised: 1,
													amount_due: amount,
												},
											}
										);
										if (m == null) {
											throw new Error("Can not update the Merchant status.");
										}

										var g = await InvoiceGroup.findOneAndUpdate(
											{ _id: group._id },
											{
												$inc: {
													bills_raised: 1,
												},
											}
										);
										if (g == null) {
											throw new Error(
												"Can not update the Invoice Group status."
											);
										}

										var c = await MerchantPosition.findOneAndUpdate(
											{ _id: position._id },
											{
												$inc: {
													bills_raised: 1,
												},
											}
										);
										if (c == null) {
											throw new Error(
												"Can not update the Merchant Position status."
											);
										}
									}
								} catch (error) {
									console.log(error);
									var message = error.toString();
									if (error.message) {
										message = error.message;
									}
									invoice.failure_reason = message;
									console.log(failed);
									failed.push(invoice);
								}
							}
							res.status(200).json({
								status: 1,
								message: "Invoices uploaded",
								failed: failed,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchantStaff/editInvoice", jwtTokenAuth, (req, res) => {
	const {
		invoice_id,
		group_id,
		number,
		name,
		amount,
		bill_date,
		bill_period,
		due_date,
		description,
		mobile,
		ccode,
		items,
		paid,
		is_validated,
		term,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			type: "staff",
			status: 1,
		},
		function (err, position) {
			let result = errorMessage(err, position, "Position is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				InvoiceGroup.findOne(
					{ _id: group_id },
					async (err1, group) => {
						let result1 = errorMessage(err1, group, "Group not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							var updatedItems = [];
							try {
								for (const item of items) {
									var { item_code, quantity, tax_code, total_amount } = item;
									var item_desc = await Offering.findOne(
										{ code: item_code, merchant_id: position.merchant_id },
										"code name denomination unit_of_measure unit_price description"
									);
									if (item_desc == null) {
										throw new Error("Item not found with code " + item_code);
									}

									var tax_desc = await Tax.findOne(
										{
											code: tax_code,
											merchant_id: position.merchant_id,
										},
										"code value"
									);
									if (tax_desc == null) {
										throw new Error("Tax not found with code " + tax_code);
									}

									updatedItems.push({
										item_desc: item_desc,
										quantity: quantity,
										tax_desc: tax_desc,
										total_amount: total_amount,
									});
								}

								Invoice.findOneAndUpdate(
									{
										_id: invoice_id,
										creator_id: position._id,
										paid: 0,
										is_validated: 0,
										is_created: 1,
									},
									{
										group_id,
										number,
										name,
										amount,
										bill_date,
										bill_period,
										due_date,
										description,
										mobile,
										ccode,
										items: updatedItems,
										paid,
										is_validated,
										term,
									},
									(err4, invoice) => {
										let result4 = errorMessage(
											err4,
											invoice,
											"Invoice might already be paid or validated. Or Does not belong to this group."
										);
										if (result4.status == 0) {
											res.status(200).json(result4);
										} else {
											var biasAmount = amount - invoice.amount;
											MerchantBranch.findOneAndUpdate(
												{ _id: position.branch_id, status: 1 },
												{ $inc: { amount_due: biasAmount } },
												(err2, branch) => {
													let result2 = errorMessage(
														err2,
														branch,
														"Branch is blocked"
													);
													if (result2.status == 0) {
														res.status(200).json(result2);
													} else {
														Merchant.findOneAndUpdate(
															{ _id: branch.merchant_id },
															{
																$inc: {
																	amount_due: biasAmount,
																},
															},
															(err3, merchant) => {
																let result3 = errorMessage(
																	err3,
																	merchant,
																	"Merchant is not valid"
																);
																if (result3.status == 0) {
																	res.status(200).json(result3);
																} else {
																	res.status(200).json({
																		status: 1,
																		message: "Invoice edited successfully",
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
							} catch (error) {
								console.log(error);
								var message = error;
								if (error && error.message) {
									message = error.message;
								}
								res.status(200).json({
									status: 0,
									message: message,
								});
							}
						}
					}
				);
			}
		}
	);
});

router.post("/merchantStaff/listInvoicesByDate", jwtTokenAuth, (req, res) => {
	const { date } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			type: "staff",
			status: 1,
		},
		function (err, position) {
			let result = errorMessage(err, position, "Position is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Invoice.find(
					{ creator_id: position._id, bill_date: date },
					(err1, invoices) => {
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
								invoices: invoices,
							});
						}
					}
				);
				
			}
		}
	);
});

router.post("/merchantStaff/listInvoicesByPeriod", jwtTokenAuth, (req, res) => {
	const { start_date, end_date } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			type: "staff",
			status: 1,
		},
		function (err, position) {
			let result = errorMessage(err, position, "Position is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Invoice.find(
					{ 	creator_id: position._id,
						"bill_period.start_date":  {
							$gte: start_date
						},
						"bill_period.end_date": {
							$lte: end_date
						},
					},
					(err1, invoices) => {
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
								invoices: invoices,
							});
						}
					}
				);
				
			}
		}
	);
});

router.post("/merchantStaff/listInvoicesByDateRange", jwtTokenAuth, (req, res) => {
	const { start_date, end_date } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			type: "staff",
			status: 1,
		},
		function (err, position) {
			let result = errorMessage(err, position, "Position is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Invoice.find(
					{ 	creator_id: position._id,
						created_at: {
							$gte: start_date,
							$lte: end_date,
						},
					},
					(err1, invoices) => {
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
								invoices: invoices,
							});
						}
					}
				);
				
			}
		}
	);
});

router.post("/merchantStaff/listInvoices", jwtTokenAuth, (req, res) => {
	const { group_id } = req.body;
	const startOfDay = new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString()
	const endOfDay = new Date(new Date().setUTCHours(23, 59, 59, 999)).toISOString()
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			type: "staff",
			status: 1,
		},
		function (err, position) {
			let result = errorMessage(err, position, "Position is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				if (position.counter_invoice_access) {
					Invoice.find(
						{ 
							merchant_id: position.merchant_id,
							group_id,
							created_at : {
								$gte: startOfDay, 
								$lt: endOfDay
							},
						},
						(err1, invoices) => {
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
									invoices: invoices,
								});
							}
						}
					);
				} else {
					Invoice.find(
						{ 
							creator_id: position._id,
							group_id,
							created_at : {
								$gte: startOfDay, 
								$lt: endOfDay
							},
						},
						(err2, invoices) => {
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
									invoices: invoices,
								});
							}
						}
					);
				}
			}
		}
	);
});

module.exports = router;
