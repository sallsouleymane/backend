const express = require("express");
const router = express.Router();

const jwtTokenAuth = require("./JWTTokenAuth");
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

router.post("/merchantStaff/getClosingBalance", jwtTokenAuth, function (req, res) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";

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

router.post("/merchantStaff/addClosingBalance", jwtTokenAuth, function (req, res) {
	const { denomination, total, note } = req.body;
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
						MerchantPosition.findByIdAndUpdate(
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

router.post("/merchantStaff/openCashierBalance", jwtTokenAuth, function (req, res) {
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
				var bal =
					Number(ba.closing_balance) > 0
						? ba.closing_balance
						: ba.opening_balance;
				upd = {
					opening_balance: bal,
					closing_balance: 0,
					closing_time: null,
					transaction_started: true,
					is_closed: false,
				};
				console.log(upd);

				MerchantPosition.findByIdAndUpdate(ba._id, upd, (err) => {
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

router.post("/merchantStaff/getCashierIncomingTransfer", jwtTokenAuth, function (req, res) {
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

router.post("/merchantStaff/cashierTransferMoney", jwtTokenAuth, function (req, res) {
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
});

router.post("/merchantStaff/cashierAcceptIncoming", jwtTokenAuth, function (req, res) {
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
									MerchantPosition.findByIdAndUpdate(
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
												MerchantPosition.findByIdAndUpdate(
													item.sender_id,
													{
														$inc: { cash_in_hand: -Number(item.amount)} ,
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

router.post("/merchantStaff/cashierCancelTransfer", jwtTokenAuth, function (req, res) {
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
					function (err, otpd) {
						let result = errorMessage(err, otpd, "OTP Missmatch");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							CashierTransfer.findByIdAndUpdate(
								{_id: transfer_id},
								{
									status: -1,
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
		}
	); //branch
});

router.post("/merchantStaff/getCashierTransfers", jwtTokenAuth, function (req, res) {
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

router.post("/merchantStaff/getCashierDashStats", jwtTokenAuth, function (req, res) {
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
					transactionStarted: user.transaction_started,
					branchId: user.branch_id,
					isClosed: user.is_closed,
				});
			}
		}
	);
});

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
				Invoice.find({ group_id }, (err, invoices) => {
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
						(err, customer) => {
							let result = errorMessage(err, customer, "Customer not found");
							if (result.status == 0) {
								res.status(200).json(result);
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
						(err, customer) => {
							let result = errorMessage(err, customer, "Customer not found");
							if (result.status == 0) {
								res.status(200).json(result);
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
					(err, customer) => {
						let result = errorMessage(
							err,
							customer,
							"Customer with the same customer code already exist",
							true
						);
						if (result.status == 0) {
							res.status(200).json(result);
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
							Customer.create(customerDetails, (err) => {
								if (err) {
									console.log(err);
									var message = err;
									if (err && err.message) {
										message = err.message;
									}
									res.status(200).json({
										status: 0,
										message: message,
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
					(err, offerings) => {
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
				Tax.find({ merchant_id: position.merchant_id }, (err, taxes) => {
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
				Invoice.deleteOne({ _id: invoice_id, is_created: 1 }, (err) => {
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
					} catch (err) {
						return catchError(err);
					}
				}
			}
		);
	}
);

router.get("/merchantStaff/staffDashStatus", jwtTokenAuth, function (req, res) {
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
					});
					let bills_paid = await Invoice.countDocuments({
						creator_id: position._id,
						paid: 1,
					});
					res.status(200).json({
						status: 1,
						message: "Today's Status",
						bills_paid: bills_paid,
						bills_raised: bills_raised,
					});
				} catch (err) {
					return catchError(err);
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
				data.save((err, group) => {
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
					(err, group) => {
						let result = errorMessage(err, group, "Invoice Group not found");
						if (result.status == 0) {
							res.status(200).json(result);
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

router.get("/merchantStaff/listInvoiceGroups", jwtTokenAuth, (req, res) => {
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
				InvoiceGroup.find({ position_id: position._id }, (err, groups) => {
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
					(err, setting) => {
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
				InvoiceGroup.findOne(
					{ _id: group_id, position_id: position._id },
					async (err, group) => {
						let result = errorMessage(err, group, "Group not found");
						if (result.status == 0) {
							res.status(200).json(result);
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
								var branch = await MerchantBranch.findOneAndUpdate(
									{ _id: position.branch_id },
									{ $inc: { bills_raised: 1, amount_due: amount } }
								);
								if (branch == null) {
									throw new Error("Can not update the MerchantBranch status.");
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
									throw new Error("Can not update the Invoice Group status.");
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
								});
							} catch (err) {
								console.log(err);
								var message = err;
								if (err && err.message) {
									message = err.message;
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
					{ _id: group_id, position_id: position._id },
					async (err, group) => {
						let result = errorMessage(err, group, "Group not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							let failed = [];
							for (invoice of invoices) {
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
									invoiceFound = await Invoice.findOne({
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
								} catch (err) {
									console.log(err);
									var message = err.toString();
									if (err.message) {
										message = err.message;
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
					{ _id: group_id, position_id: position._id },
					async (err, group) => {
						let result = errorMessage(err, group, "Group not found");
						if (result.status == 0) {
							res.status(200).json(result);
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
									(err, invoice) => {
										let result = errorMessage(
											err,
											invoice,
											"Invoice might already be paid or validated. Or Does not belong to this group."
										);
										if (result.status == 0) {
											res.status(200).json(result);
										} else {
											var biasAmount = amount - invoice.amount;
											MerchantBranch.findOneAndUpdate(
												{ _id: position.branch_id, status: 1 },
												{ $inc: { amount_due: biasAmount } },
												(err, branch) => {
													let result = errorMessage(
														err,
														branch,
														"Branch is blocked"
													);
													if (result.status == 0) {
														res.status(200).json(result);
													} else {
														Merchant.findOneAndUpdate(
															{ _id: branch.merchant_id },
															{
																$inc: {
																	amount_due: biasAmount,
																},
															},
															(err, merchant) => {
																let result = errorMessage(
																	err,
																	merchant,
																	"Merchant is not valid"
																);
																if (result.status == 0) {
																	res.status(200).json(result);
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
							} catch (err) {
								console.log(err);
								var message = err;
								if (err && err.message) {
									message = err.message;
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

router.post("/merchantStaff/listInvoices", jwtTokenAuth, (req, res) => {
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
				if (position.counter_invoice_access) {
					Invoice.find(
						{ merchant_id: position.merchant_id },
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
									invoices: invoices,
								});
							}
						}
					);
				} else {
					Invoice.find(
						{ creator_id: position._id, group_id },
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
