const express = require("express");
const router = express.Router();
const db = require("../dbConfig");
const config = require("../config.json");

//utils
const makeid = require("./utils/idGenerator");
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const getTypeClass = require("./utils/getTypeClass");
const makeotp = require("./utils/makeotp");
const jwtsign = require("./utils/jwtsign");
const { errorMessage, catchError } = require("./utils/errorHandler");
const { queryTxStates } = require("../controllers/utils/common");

const jwtTokenAuth = require("./JWTTokenAuth");

//services
const {
	rechargeNow,
	getChildStatements,
	getBalance,
	initiateTransfer,
} = require("../services/Blockchain.js");

const Infra = require("../models/Infra");
const Fee = require("../models/Fee");
const Bank = require("../models/Bank");
const OTP = require("../models/OTP");
const Document = require("../models/Document");
const Branch = require("../models/Branch");
const BankUser = require("../models/BankUser");
const Cashier = require("../models/Cashier");
const CashierSend = require("../models/CashierSend");
const CashierPending = require("../models/CashierPending");
const CashierClaim = require("../models/CashierClaim");
const BranchSend = require("../models/BranchSend");
const BranchClaim = require("../models/BranchClaim");
const CurrencyModel = require("../models/Currency");
const CountryModel = require("../models/Country");
const TxState = require("../models/TxState");
const Partner = require("../models/partner/Partner");
const PartnerBranch = require("../models/partner/Branch");
const PartnerCashier = require("../models/partner/Cashier");
const Invoice = require("../models/merchant/Invoice");
const ClaimCode = require("../models/ClaimCode");
const MerchantSettings = require("../models/merchant/MerchantSettings");
const DailyReport = require("../models/cashier/DailyReport");
const MerchantPosition = require("../models/merchant/Position");
const MerchantStaff = require("../models/merchant/Staff");
const CashierTransfer = require("../models/CashierTransfer");

router.get("/testGet", function (req, res) {
	res.status(200).json({
		status: 0,
		message: "Internal error please try again",
	});
});

router.get("/getClaimCode", function (req, res) {
	let sender_mobile = req.query.sender_mobile;
	let receiver_mobile = req.query.receiver_mobile;
	ClaimCode.findOne(
		{
			sender_mobile: sender_mobile,
			receiver_mobile: receiver_mobile,
		},
		function (err, cc) {
			res.send(cc);
		}
	);
});

router.post("/:user/getCashierDailyReport",jwtTokenAuth,function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { cashier_id,  start, end } = req.body;
	const user = req.params.user;
	let User = getTypeClass(user);
	if (user == "partner") {
		User = getTypeClass("partner");
	} else if (user == "partnerBranch") {
		User = getTypeClass("partnerBranch");
	} else if (user == "partnerCashier") {
		User = getTypeClass("partnerCashier");
	} else if (user == "bankuser") {
		User = getTypeClass("bankuser");
	} else if (user == "partnerUser") {
		User = getTypeClass("partnerUser");
	} else if (user == "cashier") {
		User = getTypeClass("cashier");
	} else if (user == "branch") {
		User = getTypeClass("branch");
	} else if (user == "bank") {
		User = getTypeClass("bank");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
					DailyReport.find(
						{ 	cashier_id: cashier_id,
							created_at: {
								$gte: new Date(
									start
								),
								$lte: new Date(
									end
								),
							},
						},
						async(err1, reports) => {
							if (err1) {
								res.status(200).json(catchError(err1));
							} else {
								Invoice.aggregate(
									[{ 
										$match : {
											payer_id: cashier_id,
											date_paid: {
												$gte: new Date(
													start
												),
												$lte: new Date(
													end
												),
											},
											paid:1,
										}
									},
										{
											$group: {
												_id: null,
												totalAmountPaid: {
													$sum: "$amount",
												},
												bills_paid: { $sum: 1 },
											},
										},
									],
									async (err2, invoices) => {
										let amountpaid = 0;
										let billpaid = 0;
										if (
											invoices != undefined &&
											invoices != null &&
											invoices.length > 0
										) {
											amountpaid = invoices[0].totalAmountPaid;
											billpaid = invoices[0].bills_paid;
										}
											var totalPendingTransfers = await CashierTransfer.countDocuments(
												{ status: 0, sender_id: cashier_id }
											);
											var totalAcceptedTransfers = await CashierTransfer.countDocuments(
												{ status: 1, sender_id: cashier_id }
											);
											var totalcancelledTransfers = await CashierTransfer.countDocuments(
												{ status: -1, sender_id: cashier_id }
											);
											

											res.status(200).json({
												status: 1,
												reports: reports,
												accepted: totalAcceptedTransfers,
												pending: totalPendingTransfers,
												decline: totalcancelledTransfers,
												invoicePaid: billpaid,
												amountPaid: amountpaid,
											});
									}
								)
							}
						}
					);
				}
			}
		);
	}
);

router.post("/:user/getPartnerCashierDashStats", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { cashier_id } = req.body;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "partner") {
		User = getTypeClass("partner");
	} else if (user == "partnerBranch") {
		User = getTypeClass("partnerBranch");
	} else if (user == "partnerCashier") {
		User = getTypeClass("partnerCashier");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				PartnerCashier.findOne(
					{
						_id: cashier_id,
						status: 1,
					},
					function (err1, cashier) {
						let result1 = errorMessage(
							err1,
							cashier,
							"Token changed or user not valid. Try to login again or contact system administrator."
						);
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								openingBalance: cashier.opening_balance,
								closingBalance: cashier.closing_balance,
								cashPaid: cashier.cash_paid,
								cashReceived: cashier.cash_received,
								cashInHand: cashier.cash_in_hand,
								feeGenerated: cashier.fee_generated,
								commissionGenerated: cashier.commission_generated,
								closingTime: cashier.closing_time,
								transactionStarted: cashier.transaction_started,
								branchId: cashier.branch_id,
								isClosed: cashier.is_closed,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/:user/getBankCashierDashStats", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { cashier_id } = req.body;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "bank") {
		User = getTypeClass("bank");
	} else if (user == "branch") {
		User = getTypeClass("branch");
	} else if (user == "cashier") {
		User = getTypeClass("cashier");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Cashier.findOne(
					{
						_id: cashier_id,
						status: 1,
					},
					function (err1, cashier) {
						let result1 = errorMessage(
							err1,
							cashier,
							"Token changed or user not valid. Try to login again or contact system administrator."
						);
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								openingBalance: cashier.opening_balance,
								closingBalance: cashier.closing_balance,
								cashPaid: cashier.cash_paid,
								cashReceived: cashier.cash_received,
								cashInHand: cashier.cash_in_hand,
								feeGenerated: cashier.fee_generated,
								commissionGenerated: cashier.commission_generated,
								closingTime: cashier.closing_time,
								transactionStarted: cashier.transaction_started,
								branchId: cashier.branch_id,
								isClosed: cashier.is_closed,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/:user/getBankTheme", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { bank_id } = req.body;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "bank") {
		User = getTypeClass("bank");
	} else if (user == "branch") {
		User = getTypeClass("branch");
	} else if (user == "cashier") {
		User = getTypeClass("cashier");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.findOne(
					{
						_id: bank_id,
						status: 1,
					},
					function (err1, bank) {
						let result1 = errorMessage(
							err1,
							bank,
							"Token changed or user not valid. Try to login again or contact system administrator."
						);
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								theme: bank.theme,
							});
						}
					}
				);
			}
		}
	);
});


router.post("/:user/queryCashierTransactionStates", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { bank_id, cashier_id } = req.body;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "partner") {
		User = getTypeClass("partner");
	} else if (user == "partnerBranch") {
		User = getTypeClass("partnerBranch");
	} else if (user == "partnerCashier") {
		User = getTypeClass("partnerCashier");
	} else if (user == "cashier") {
		User = getTypeClass("cashier");
	} else if (user == "branch") {
		User = getTypeClass("branch");
	} else if (user == "bank") {
		User = getTypeClass("bank");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				queryTxStates(
					bank_id,
					cashier_id,
					req,
					function (err1, txstates) {
						if (err1) {
							res.status(200).json(catchError(err1));
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


router.post("/:user/getMerchantCashierDashStats", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { staff_id } = req.body;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantPosition") {
		User = getTypeClass("merchantPosition");
	} else if (user == "merchantBranch") {
		User = getTypeClass("merchantBranch");
	} else if (user == "merchant") {
		User = getTypeClass("merchant");
	} else if (user == "merchantStaff") {
		User = getTypeClass("merchantStaff");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				if(user == 'merchantBranch' || user == 'merchant' || user == 'merchantStaff'){
					MerchantPosition.findOne(
						{
							_id: staff_id,
						},
						function (err1, user1) {
							let result1 = errorMessage(
								err1,
								user1,
								"Token changed or user not valid. Try to login again or contact system administrator."
							);
							if (result1.status == 0) {
								res.status(200).json(result1);
							} else {
								res.status(200).json({
									status: 1,
									openingBalance: user1.opening_balance,
									closingBalance: user1.closing_balance,
									cashInHand: user1.cash_in_hand,
									closingTime: user1.closing_time,
									openingTime: user1.opening_time,
									discrepancy: user1.discrepancy,
									branchId: user1.branch_id,
									isClosed: user1.is_closed,
								});
							}
						}
					);
				} else {
					res.status(200).json({
						status: 1,
						openingBalance: data.opening_balance,
						closingBalance: data.closing_balance,
						cashInHand: data.cash_in_hand,
						closingTime: data.closing_time,
						openingTime: data.opening_time,
						discrepancy: data.discrepancy,
						branchId: data.branch_id,
						isClosed: data.is_closed,
					});
				}
			}
		}
	);
});

router.post("/:user/queryMerchantCashierTransactionStates", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const user = req.params.user;
	const { bank_id, staff_id } = req.body;
	var User = getTypeClass(user);
	if (user == "merchantPosition") {
		User = getTypeClass("merchantPosition");
	} else if (user == "merchantBranch") {
		User = getTypeClass("merchantBranch");
	} else if (user == "merchant") {
		User = getTypeClass("merchant");
	} else if (user == "merchantStaff") {
		User = getTypeClass("merchantStaff");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				queryTxStates(
					bank_id,
					user == 'merchantPosition' ? data._id : staff_id,
					req,
					function (err1, txstates) {
						if (err1) {
							res.status(200).json(catchError(err1));
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

router.post("/:user/getMerchantCashierDailyReport", jwtTokenAuth, function (req, res) {
	const { start, end, staff_id } = req.body;
	const jwtusername = req.sign_creds.username;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantPosition") {
		User = getTypeClass("merchantPosition");
	} else if (user == "merchantBranch") {
		User = getTypeClass("merchantBranch");
	} else if (user == "merchant") {
		User = getTypeClass("merchant");
	} else if (user == "merchantStaff") {
		User = getTypeClass("merchantStaff");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				DailyReport.find(
					{ 	cashier_id: user=='merchantPosition' ? data._id : staff_id,
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
});

router.post("/:user/listMerchantStaffInvoicesByDate", jwtTokenAuth, (req, res) => {
	const { date, staff_id } = req.body;
	const jwtusername = req.sign_creds.username;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantPosition") {
		User = getTypeClass("merchantPosition");
	} else if (user == "merchantBranch") {
		User = getTypeClass("merchantBranch");
	} else if (user == "merchant") {
		User = getTypeClass("merchant");
	} else if (user == "merchantStaff") {
		User = getTypeClass("merchantStaff");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Invoice.find(
					{ 
						creator_id: user=='merchantPosition' ? data._id : staff_id,
						bill_date: date
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

router.post("/:user/listMerchantStaffInvoicesByPeriod", jwtTokenAuth, (req, res) => {
	const { start_date, end_date, staff_id} = req.body;
	const jwtusername = req.sign_creds.username;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantPosition") {
		User = getTypeClass("merchantPosition");
	} else if (user == "merchantBranch") {
		User = getTypeClass("merchantBranch");
	} else if (user == "merchant") {
		User = getTypeClass("merchant");
	} else if (user == "merchantStaff") {
		User = getTypeClass("merchantStaff");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Invoice.find(
					{ 	
						creator_id: user=='merchantPosition' ? data._id : staff_id,
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


router.post("/:user/listMerchantStaffInvoicesByDateRange", jwtTokenAuth, (req, res) => {
	const { start_date, end_date, staff_id } = req.body;
	const jwtusername = req.sign_creds.username;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantPosition") {
		User = getTypeClass("merchantPosition");
	} else if (user == "merchantBranch") {
		User = getTypeClass("merchantBranch");
	} else if (user == "merchant") {
		User = getTypeClass("merchant");
	} else if (user == "merchantStaff") {
		User = getTypeClass("merchantStaff");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Invoice.find(
					{ 	creator_id: user=='merchantPosition' ? data._id : staff_id,
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


router.post("/:user/listMerchantBranchInvoicesByDate", jwtTokenAuth, (req, res) => {
	const { date, branch_id } = req.body;
	const jwtusername = req.sign_creds.username;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantBranch") {
		User = getTypeClass("merchantBranch");
	} else if (user == "merchant") {
		User = getTypeClass("merchant");
	} else if (user == "merchantStaff") {
		User = getTypeClass("merchantStaff");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Invoice.find(
					{ 
						branch_id:  user == 'merchantBranch' ? data._id : branch_id,
						bill_date: date 
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

router.post("/:user/listMerchantStaff", jwtTokenAuth, (req, res) => {
	const jwtusername = req.sign_creds.username;
	const { branch_id } = req.body;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantBranch") {
		User = getTypeClass("merchantBranch");
	} else if (user == "merchant") {
		User = getTypeClass("merchant");
	} else if (user == "merchantStaff") {
		User = getTypeClass("merchantStaff");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantStaff.find({
					branch_id: user == 'merchantBranch' ? data._id : branch_id,
				}, (err1, staffs) => {
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
							message: "Staffs list",
							staffs: staffs,
						});
					}
				});
			}
		}
	);
});

router.post("/:user/listMerchantPosition", jwtTokenAuth, (req, res) => {
	const jwtusername = req.sign_creds.username;
	const { branch_id } = req.body;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantBranch") {
		User = getTypeClass("merchantBranch");
	} else if (user == "merchant") {
		User = getTypeClass("merchant");
	} else if (user == "merchantStaff") {
		User = getTypeClass("merchantStaff");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantPosition.find({
					branch_id: user == 'merchantBranch' ? data._id : branch_id,
				}, (err1, positions) => {
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
							message: "ositions list",
							positions: positions,
						});
					}
				});
			}
		}
	);
});

router.post("/:user/merchantCashierStats",jwtTokenAuth,function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { cashier_id } = req.body;
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantBranch") {
		User = getTypeClass("merchantBranch");
	} else if (user == "merchant") {
		User = getTypeClass("merchant");
	} else if (user == "merchantStaff") {
		User = getTypeClass("merchantStaff");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantPosition.findById(
					cashier_id,
					async function (err1, position) {
						let result1 = errorMessage(err1, position, "Cashier is not valid");
						if (result1.status == 0) {
							res.status(200).json(result1);
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
								if (status.length > 0) {
										res.status(200).json({
											status: 1,
											message: "Today's Status",
											bills_paid: status[0].bills_paid,
											amount_collected: status[0].amount_collected,
											penalty_collected: status[0].penalty_collected,
											cash_in_hand: position.cash_in_hand,
											opening_balance: position.opening_balance,
											opening_time: position.opening_time,
											closing_time: position.closing_time,
											discrepancy: position.discrepancy,
											closing_balance: position.closing_balance,
										});
								} else {
										res.status(200).json({
											status: 1,
											message: "Today's Status",
											bills_paid: 0,
											amount_collected: 0,
											penalty_collected: 0,
											cash_in_hand: position.cash_in_hand,
											opening_balance: position.opening_balance,
											opening_time: position.opening_time,
											closing_time: position.closing_time,
											discrepancy: position.discrepancy,
											closing_balance: position.closing_balance,
										});
								}
							} catch (error) {
								res.status(200).json(catchError(error));
							}
						}
					}
				);
			}
		}
		);
});

router.post("/:user/merchantStaffStats",jwtTokenAuth,function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { staff_id } = req.body;
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantBranch") {
		User = getTypeClass("merchantBranch");
	} else if (user == "merchant") {
		User = getTypeClass("merchant");
	} else if (user == "merchantStaff") {
		User = getTypeClass("merchantStaff");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantPosition.findById(
					staff_id,
					async function (err1, position) {
						let result1 = errorMessage(err1, position, "Staff is not valid");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							try {
								let bills_created = await Invoice.countDocuments({
									creator_id: position._id,
									is_validated: 1,
									created_at : {
										$gte: start, 
										$lt: end
									},
									is_created:1,
								});
								let bills_uploaded = await Invoice.countDocuments({
									creator_id: position._id,
									is_validated: 1,
									created_at : {
										$gte: start, 
										$lt: end
									},
									is_created:0,
								});
								let bills_paid = await Invoice.countDocuments({
									creator_id: position._id,
									paid: 1,
									created_at : {
										$gte: start, 
										$lt: end
									},
								});
								let counter_invoices = await Invoice.countDocuments({
									creator_id: position._id,
									is_counter: true,
									created_at : {
										$gte: start, 
										$lt: end
									},
								});
								res.status(200).json({
									status: 1,
									message: "Today's Status",
									bills_paid: bills_paid,
									bills_created: bills_created,
									bills_uploaded: bills_uploaded,
									counter_invoices: counter_invoices,
									opening_time: position.opening_time,
									closing_time: position.closing_time,
								});
							} catch (err) {
								res.status(200).json(catchError(err));
							}
						}
					}
				);
			}
		}
		);
});

router.post("/:user/listMerchantBranchInvoicesByPeriod", jwtTokenAuth, (req, res) => {
	const { start_date, end_date, branch_id } = req.body;
	const jwtusername = req.sign_creds.username;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantBranch") {
		User = getTypeClass("merchantBranch");
	} else if (user == "merchant") {
		User = getTypeClass("merchant");
	} else if (user == "merchantStaff") {
		User = getTypeClass("merchantStaff");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Invoice.find(
					{ 	branch_id:  user == 'merchantBranch' ? data._id : branch_id,
						"bill_period.start_date":  {
							$gte: start_date
						},
						"bill_period.end_date": {
							$lte: end_date
						},
					},
					(err1, invoices) => {
						if (err) {
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

router.post("/:user/getMerchantBranchDashStats", jwtTokenAuth, function (req, res) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	const { branch_id } = req.body;
	const jwtusername = req.sign_creds.username;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantBranch") {
		User = getTypeClass("merchantBranch");
	} else if (user == "merchant") {
		User = getTypeClass("merchant");
	} else if (user == "merchantStaff") {
		User = getTypeClass("merchantStaff");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantPosition.aggregate(
					[
						{ $match :
							{
								branch_id: user == 'merchantBranch' ? data._id : branch_id,
								type: 'cashier'
							}
						}, 
						{
							$group: {
								_id: null,
								total: {
									$sum: "$cash_in_hand",
								},
								openingBalance: {
									$sum: "$opening_balance",
								},
							},
						},
					],
					async (err1, post5) => {
						let result1 = errorMessage(
							err1,
							post5,
							"Error."
							
						);
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							Invoice.aggregate(
								[
									{ $match :
										{
											payer_branch_id: user == 'merchantBranch' ? data._id : branch_id,
											date_paid : {
												$gte: new Date(
													start
												),
												$lte: new Date(
													end
												),
											},
										}
									}, 
									{
										$group: {
											_id: null,
											totalPenalty: {
												$sum: "$penalty",
											},
											totalAmount: {
												$sum: "$amount",
											},
										},
									},

								],
								async (err2, post6) => {
									let result2 = errorMessage(
										err2,
										post6,
										"Error."
									);
									if (result2.status == 0) {
										res.status(200).json(result2);
									} else {
										let cin = 0;
										let ob = 0;
										let pc = 0;
										let ta = 0;
										if (
											post5 != undefined &&
											post5 != null &&
											post5.length > 0
										) {
											cin = post5[0].total;
											ob = post5[0].openingBalance;
										}
										if (
											post6 != undefined &&
											post6 != null &&
											post6.length > 0
										) {
											pc = post6[0].totalPenalty;
											ta = post6[0].totalAmount;
										}
										var totalStaff = await MerchantPosition.countDocuments({
												branch_id: user == 'merchantBranch' ? data._id : branch_id,
												type: 'staff'
											});
										var totalCashier = await MerchantPosition.countDocuments({
											branch_id: user == 'merchantBranch' ? data._id : branch_id,
											type: 'cashier'
										});
										var totalInvoice = await Invoice.countDocuments(
											{
												branch_id: user == 'merchantBranch' ? data._id : branch_id,
												created_at: {
													$gte: new Date(
														start
													),
													$lte: new Date(
														end
													),
												},
											});
										var totalInvoicePending = await Invoice.countDocuments(
												{
													branch_id: user == 'merchantBranch' ? data._id : branch_id,
													paid: 0,
												});
										var totalInvoicePaid = await Invoice.countDocuments(
											{
												payer_branch_id: user == 'merchantBranch' ? data._id : branch_id,
												date_paid: {
													$gte: new Date(
														start
													),
													$lte: new Date(
														end
													),
												},
												paid:1,
											});
										res.status(200).json({
											status: 1,
											cash_in_hand: cin,
											opening_balance: ob,
											total_cashier: totalCashier,
											total_staff: totalStaff,
											penalty_collected: pc,
											amount_collected: ta,
											invoice_raised: totalInvoice,
											invoice_paid: totalInvoicePaid,
											invoice_pending: totalInvoicePending,
										});
									}
								}
							)

						}
					}	
				);
			}
		}
	);
});

router.post("/:user/listMerchantBranchInvoicesByDateRange", jwtTokenAuth, (req, res) => {
	const { start_date, end_date, branch_id } = req.body;
	const jwtusername = req.sign_creds.username;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantBranch") {
		User = getTypeClass("merchantBranch");
	} else if (user == "merchant") {
		User = getTypeClass("merchant");
	} else if (user == "merchantStaff") {
		User = getTypeClass("merchantStaff");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Invoice.find(
					{ 	branch_id: user == 'merchantBranch' ? data._id : branch_id,
						created_at: {
							$gte: start_date,
							$lte: end_date,
						},
					},
					(err1, invoices) => {
						if (err1) {
							console.log(err1);
							var message1 = err;
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

router.post("/:user/getMerchantSettings", jwtTokenAuth, function (req, res) {
	const { merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantStaff") {
		User = getTypeClass("merchantPosition");
	}else if (user == "bank") {
		User = getTypeClass("bank");
	}else if (user == "infra") {
		User = getTypeClass("infra");
	}else if (user == "bankuser") {
		User = getTypeClass("bankuser");	
	} else if (user == "merchantBranch") {
		User = getTypeClass("merchantBranch");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantSettings.findOne(
					{ merchant_id: user == 'bank' ||  user == 'bankuser' || user == 'infra'? merchant_id : data.merchant_id },
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

router.post("/:user/searchPaidInvoiceList", jwtTokenAuth, function (req, res) {
	const { from_date, to_date } = req.body;
	const jwtusername = req.sign_creds.username;
	const user = req.params.user;
	var User = getTypeClass(user);
	var paid_by;
	if (user == "merchantStaff") {
		User = getTypeClass("merchantPosition");
		paid_by = "MC";
	} else if (user == "partnerCashier") {
		paid_by = "PC";
	} else if (user == "user") {
		paid_by = "US";
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Invoice.find(
					{ 	paid_by: paid_by,
						payer_id: data._id,
						date_paid: {
							$gte: from_date,
							$lte: to_date,
						  }
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

router.post("/:user/searchPaidInvoiceByMobile", jwtTokenAuth, function (req, res) {
	const { mobile } = req.body;
	const jwtusername = req.sign_creds.username;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantStaff") {
		User = getTypeClass("merchantPosition");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Invoice.find(
					{ 	paid: 1,
						merchant_id: data.merchant_id,
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

router.post("/:user/searchPaidInvoiceByBillNumber", jwtTokenAuth, function (req, res) {
	const { number } = req.body;
	const jwtusername = req.sign_creds.username;
	const user = req.params.user;
	var User = getTypeClass(user);

	if (user == "merchantStaff") {
		User = getTypeClass("merchantPosition");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Invoice.find(
					{ 	paid: 1,
						merchant_id: data.merchant_id,
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

router.post("/:user/searchPaidInvoiceByCustomerCode", jwtTokenAuth, function (req, res) {
	const { customer_code } = req.body;
	const jwtusername = req.sign_creds.username;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantStaff") {
		User = getTypeClass("merchantPosition");
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Invoice.find(
					{ 	paid: 1,
						merchant_id: data.merchant_id,
						customer_code: customer_code,
					},
					(err1, invoices) => {
						if (err) {
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

router.post("/:user/getPaidInvoiceList", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const user = req.params.user;
	var User = getTypeClass(user);
	var paid_by;
	if (user == "merchantStaff") {
		User = getTypeClass("merchantPosition");
		paid_by = "MC";
	} else if (user == "partnerCashier") {
		paid_by = "PC";
	} else if (user == "user") {
		paid_by = "US";
	} else {
		res.status(200).json({
			status: 0,
			message: "The user does not have API support",
		});
		return;
	}
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, data) {
			var result = errorMessage(
				err,
				data,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Invoice.find(
					{ paid_by: paid_by, payer_id: data._id },
					(err1, invoices) => {
						if (err) {
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

router.post("/:user/transferMasterToOp", jwtTokenAuth, function (req, res) {
	const { amount } = req.body;
	const jwtusername = req.sign_creds.username;
	const user = req.params.user;
	const User = getTypeClass(user);
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user1) {
			let result = errorMessage(
				err,
				user1,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const masterWallet = user1.wallet_ids.master;
				const opWallet = user1.wallet_ids.operational;
				const trans = {
					from: masterWallet,
					to: opWallet,
					amount: Number(amount),
					note: "Master to operational",
					email1: user1.email,
					mobile1: user1.mobile,
					from_name: user1.name,
					to_name: user1.name,
					master_code: "",
					child_code: "",
				};
				initiateTransfer(trans)
					.then((result1) => {
						res.status(200).json(result1);
					})
					.catch((error) => {
						console.log(error);
						res.status(200).json({
							status: 0,
							message: error.message,
						});
					});
			}
		}
	);
});

router.post("/transferMasterToOp", function (req, res) {
	res.status(200).json({
		status: 0,
		message: "This API is removed",
		Replace: "/:user/transferMasterToOp",
	});
});

router.post("/getPartner/:code", async (req, res) => {
	try {
		const partnerCode = req.params.code;
		const { bank_id } = req.body;
		const partner = await Partner.find({ bank_id, code: partnerCode });
		if (partner.length == 0) throw { message: "Partner not found" };

		res.send({ status: 1, partner });
	} catch (err) {
		res.send({ status: 0, message: err.message });
	}
});

router.post("/getPartnerBranchByName", function (req, res) {
	const { name } = req.body;

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
					function (err1, partner) {
						let result1 = errorMessage(err1, partner, "Not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							var obj = {};
							obj["logo"] = partner.logo;
							obj["partnerName"] = partner.name;
							obj["name"] = branch.name;
							obj["mobile"] = branch.mobile;
							obj["branch_id"] = branch._id;
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
});

router.post("/:user/getWalletBalance", jwtTokenAuth, function (req, res) {
	const { page, wallet_id } = req.query;
	const user = req.params.user;
	const jwtusername = req.sign_creds.username;
	const Type = getTypeClass(user);
	Type.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (e, b) {
			if (e) {
				console.log(e);
				var message = e;
				if (e.message) {
					message = e.message;
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
				if (wallet_id != null && wallet_id != undefined && wallet_id != "") {
					getBalance(wallet_id)
						.then(function (result) {
							res.status(200).json({
								status: 1,
								balance: result,
							});
						})
						.catch((error) => {
							console.log(error);
							res.status(200).json({
								status: 0,
								message: error.message,
							});
						});
				} else {
					let wallet_i = b.wallet_ids[page];

					getBalance(wallet_i)
						.then(function (result) {
							res.status(200).json({
								status: 1,
								balance: result,
							});
						})
						.catch((error) => {
							console.log(error);
							res.status(200).json({
								status: 0,
								message: error.message,
							});
						});
				}
			}
		}
	);
});

router.post("/getPartnerByName", function (req, res) {
	const { name } = req.body;
	Partner.findOne(
		{
			name: name,
		},
		function (err, partner) {
			let result = errorMessage(err, partner, err);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				res.status(200).json({
					status: 1,
					logo: partner.logo,
					name: partner.name,
				});
			}
		}
	);
});

router.post("/:user/sendOTP", jwtTokenAuth, function (req, res) {
	let data = new OTP();
	const user = req.params.user;
	const Type = getTypeClass(user);
	const jwtusername = req.sign_creds.username;
	const { page, email, mobile, txt } = req.body;
	Type.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user1) {
			let result = errorMessage(
				err,
				user1,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				data.user_id = user1._id;
				data.otp = makeotp(6);
				data.page = page;
				data.mobile = mobile;
				data.save((err1, ot) => {
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
						let content = txt + data.otp;
						sendSMS(content, mobile);
						sendMail(content, "OTP", email);

						res.status(200).json({
							status: 1,
							id: ot._id,
						});
					}
				});
			}
		}
	);
});

router.post("/:user/updateById", jwtTokenAuth, (req, res) => {
	const user = req.params.user;
	const Type = getTypeClass(user);
	const { page, page_id, update_data } = req.body;
	const username = req.sign_creds.username;
	Type.findOne(
		{
			username,
			status: 1,
		},
		function (err, details) {
			let result = errorMessage(err, details, "Unauthorised");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const Page = getTypeClass(page);
				Page.findByIdAndUpdate(
					page_id,
					update_data,
					{ new: true },
					(err1, row) => {
						let result1 = errorMessage(err1, row, page + " not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								status: 1,
								row: row,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/:user/getAll", jwtTokenAuth, (req, res) => {
	const user = req.params.user;
	const Type = getTypeClass(user);
	const { page, where } = req.body;
	const username = req.sign_creds.username;
	Type.findOne(
		{
			username,
			status: 1,
		},
		function (err, details) {
			let result = errorMessage(err, details, "Unauthorised");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const Page = getTypeClass(page);
				Page.find(where, (err1, rows) => {
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
							rows: rows,
						});
					}
				});
			}
		}
	);
});

router.post("/:user/getOne", jwtTokenAuth, (req, res) => {
	const user = req.params.user;
	const Type = getTypeClass(user);
	const { page, where } = req.body;
	const username = req.sign_creds.username;
	Type.findOne(
		{
			username,
			status: 1,
		},
		function (err, details) {
			let result = errorMessage(err, details, "Unauthorised");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const Page = getTypeClass(page);
				Page.findOne(where, (err1, row) => {
					let result1 = errorMessage(err1, row, page + " not found");
					if (result1.status == 0) {
						res.status(200).json(result1);
					} else {
						res.status(200).json({
							status: 1,
							row: row,
						});
					}
				});
			}
		}
	);
});

router.post("/:user/changePassword", jwtTokenAuth, (req, res) => {
	const user = req.params.user;
	const Type = getTypeClass(user);
	const { password } = req.body;
	const username = req.sign_creds.username;
	Type.findOneAndUpdate(
		{
			username,
		},
		{
			password: password,
			status: 1,
		},
		function (err, details) {
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

router.get("/getWalletBalance", jwtTokenAuth, function (req, res) {
	res.status(200).json({
		status: 0,
		message: "This API is removed",
		replace: "/:user/getWalletBalance - {page, wallet_id}",
	});
});

router.post("/getOne", jwtTokenAuth, function (req, res) {
	const { page, type, page_id } = req.body;

	const pageClass = getTypeClass(page);
	const typeClass = getTypeClass(type);
	const username = req.sign_creds.username;

	typeClass.findOne(
		{
			username,
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
				if (page == type) {
					res.status(200).json({
						status: 1,
						row: t1,
					});
				} else {
					let where;
					where = { _id: page_id };

					pageClass.findOne(where, function (err1, data) {
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
								row: data,
							});
						}
					});
				}
			}
		}
	);
});

router.post("/getAll", jwtTokenAuth, function (req, res) {
	const { page, type, where } = req.body;

	const pageClass = getTypeClass(page);
	const typeClass = getTypeClass(type);
	const username = req.sign_creds.username;
	typeClass.findOne(
		{
			username,
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
				const type_id = t1._id;

				let whereData = where;
				if (where == undefined || where == "") {
					if (type == "bank") {
						whereData = { bank_id: type_id };
					}
				}
				pageClass.find(whereData, function (err1, data) {
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
							rows: data,
						});
					}
				});
			}
		}
	);
});

router.post("/editCashier", (req, res) => {
	const {
		cashier_id,
		name,
		bcode,
		working_from,
		working_to,
		per_trans_amt,
		max_trans_amt,
		max_trans_count,
	} = req.body;
	Cashier.findByIdAndUpdate(
		cashier_id,
		{
			name: name,
			working_from: working_from,
			working_to: working_to,
			per_trans_amt: per_trans_amt,
			bcode: bcode,
			max_trans_count: max_trans_count,
			max_trans_amt: max_trans_amt,
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
					message: "Edited successfully",
				});
			}
		}
	);
});

router.post("/editBankBank", (req, res) => {
	const {
		bank_id,
		name,
		bcode,
		address1,
		state,
		zip,
		country,
		ccode,
		mobile,
		email,
		logo,
		contract,
		otp_id,
		otp,
		working_from,
		working_to,
	} = req.body;

	// const user_id = user._id;
	OTP.findOne(
		{
			_id: otp_id,
			otp: otp,
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
				if (otpd.otp == otp) {
					if (
						name == "" ||
						address1 == "" ||
						state == "" ||
						mobile == "" ||
						email == ""
					) {
						res.status(200).json({
							status: 0,
							message: "Please provide valid inputs",
						});
					}

					Bank.findByIdAndUpdate(
						bank_id,
						{
							name: name,
							address1: address1,
							state: state,
							zip: zip,
							ccode: ccode,
							bcode: bcode,
							mobile: mobile,
							country: country,
							email: email,
							logo: logo,
							working_from: working_from,
							working_to: working_to,
							contract: contract,
						},
						(err1) => {
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
								let data2 = new Document();
								data2.bank_id = bank_id;
								data2.contract = contract;
								data2.save(() => { });
								res.status(200).json({
									status: 1,
									message: "Edited Successfully",
								});
							}
						}
					);
				} else {
					res.status(200).json({
						status: 0,
						message: "OTP Missmatch",
					});
				}
			}
		}
	);
});

router.get("/rechargeWallet", (req, res) => {
	const { wallet_id, amount } = req.query;

	let data = {};
	data.amount = amount.toString();
	data.from = "recharge";
	data.to = wallet_id.toString();

	rechargeNow([data]).then(function (result) {
		res.status(200).json({
			status: 1,
			message: result.toString(),
		});
	});
});

router.get("/showBalance", (req, res) => {
	const { wallet_id } = req.query;

	getBalance(wallet_id)
		.then(function (result) {
			res.status(200).json({
				status: 1,
				balance: result,
			});
		})
		.catch((err) => {
			res.status(200).json(catchError(err));
		});
});

router.post("/createRules", (req, res) => {
	let data = new Fee();
	const {
		name,
		trans_type,
		active,
		ranges,
		bank_id,
		selectedBankFeeId,
	} = req.body;
	Infra.findOne(
		{
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
				Bank.findOne(
					{
						_id: bank_id,
					},
					function (err1, bank) {
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
							data.bank_id = bank_id;
							data.user_id = user._id;
							data.name = name;
							data.trans_type = trans_type;
							data.active = active;
							data.ranges = JSON.stringify(ranges);
							data.bankFeeId = selectedBankFeeId;
							var edited = {
								name: name,
								trans_type: trans_type,
								active: active,
								ranges: ranges,
							};
							data.editedRanges = JSON.stringify(edited);

							Fee.findOne(
								{
									trans_type: trans_type,
									bank_id: bank_id,
								},
								function (e, fee) {
									if (fee == null) {
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
												let content2 =
													"New fee rule has been added for your bank in E-Wallet application Fee Name: " +
													name;
												sendSMS(content2, bank.mobile);
												res.status(200).json({
													status: 1,
													message: "Created Successfully",
												});
											}
										});
									} else {
										res.status(200).json({
											status: 0,
											message: "This rule type already exists for this bank",
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

router.post("/editRule", (req, res) => {
	const { name, trans_type, active, ranges, bank_id, rule_id } = req.body;
	Infra.findOne(
		{
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
				Bank.findOne(
					{
						_id: bank_id,
					},
					function (err1, bank) {
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
							var edited = {
								name: name,
								trans_type: trans_type,
								active: active,
								ranges: ranges,
							};
							Fee.findByIdAndUpdate(
								{
									_id: rule_id,
								},
								{
									editedRanges: JSON.stringify(edited),
									edit_status: 0,
								},
								(err2) => {
									if (err2) {
										console.log(err2);
										var message2 = err2;
										if (err2.message) {
											message2 = err.message2;
										}
										res.status(200).json({
											status: 0,
											message: message2,
										});
									} else {
									
										let content2 =
											"Rule " + name + " has been updated, check it out";
										sendSMS(content2, bank.mobile);
										res.status(200).json({
											status: 1,
											message: "Edited successfully",
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

router.post("/getBankByName", function (req, res) {
	const { name } = req.body;

	Bank.findOne(
		{
			name: name,
		},
		function (err, bank) {
			let result = errorMessage(err, bank, "Bank not found");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				res.status(200).json({
					status: 1,
					banks: bank,
				});
			}
		}
	);
});

router.post("/getBankRules", function (req, res) {
	const { bank_id } = req.body;
	Bank.findOne(
		{
			_id: bank_id,
		},
		function (err, bank) {
			let result = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Fee.find(
					{
						bank_id: bank_id,
					},
					function (err1, rules) {
						if (err1) {
							console.log(err1);
							var message1 = err;
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
								rules: rules,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/get-branch-details-by-id/:id", async (req, res) => {
	try {
		const branchId = req.params.id;
		const { bank_id } = req.body;
		const branch = await Branch.find({ bank_id, bcode: branchId });
		if (branch.length == 0) throw { message: "Branch not found" };

		res.send({ status: 1, branch });
	} catch (err) {
		res.send({ status: 0, message: err.message });
	}
});

router.post("/getBranchByName", function (req, res) {
	const { name } = req.body;

	Branch.findOne(
		{
			name: name,
		},
		function (err, bank) {
			let result = errorMessage(err, bank, "Not found");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.findOne(
					{
						_id: bank.bank_id,
					},
					function (err1, ba) {
						let result1 = errorMessage(err1, ba, "Not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							var obj = {};
							obj["logo"] = ba.logo;
							obj["bankName"] = ba.name;
							obj["name"] = bank.name;
							obj["mobile"] = bank.mobile;
							obj["_id"] = bank._id;
							obj["bcode"] = ba.bcode;

							res.status(200).json({
								status: 1,
								banks: obj,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/getWalletsOperational", function (req, res) {
	const { bank_id } = req.body;

	Bank.findOne(
		{
			_id: bank_id,
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
			} else {
				res.status(200).json({
					status: 1,
					from: bank.wallet_ids.infra_operational,
					to: bank.wallet_ids.infra_master,
				});
			}
		}
	);
});

router.post("/getWalletsMaster", function (req, res) {
	const { bank_id } = req.body;

	Bank.findOne(
		{
			_id: bank_id,
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
			} else {
				res.status(200).json({
					status: 1,
					from: bank.wallet_ids.infra_master,
					to: bank.wallet_ids.master,
				});
			}
		}
	);
});

router.post("/updateStatus", jwtTokenAuth, function (req, res) {
	const { status, type_id, page, type } = req.body;
	const pageClass = getTypeClass(page);
	const typeClass = getTypeClass(type);
	const username = req.sign_creds.username;
	typeClass.findOne(
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
				pageClass.findByIdAndUpdate(
					type_id,
					{
						status: status,
					},
					(err1) => {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1 = err.message1;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						} else {
							res.status(200).json({
								status: 1,
								message: "Updated successfully",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/getDocs", function (req, res) {
	const { bank_id } = req.body;
	Document.find(
		{
			bank_id,
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
					docs: user,
				});
			}
		}
	);
});

router.post("/declineFee", function (req, res) {
	const { id } = req.body;
	Bank.findOne(
		{
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
				Fee.findByIdAndUpdate(
					id,
					{
						status: 0,
					},
					(err1) => {
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
								message: "Updated successfully",
							});
						}
					}
				);
			}
		}
	);
});

router.put("/updateOne", jwtTokenAuth, function (req, res) {
	const { page, type, page_id, updateData } = req.body;

	const pageClass = getTypeClass(page);
	const typeClass = getTypeClass(type);
	const username = req.sign_creds.username;
	typeClass.findOne(
		{
			username,
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
				pageClass.findByIdAndUpdate(page_id, updateData, function (err1, data) {
					if (err1) {
						res.status(200).json({
							status: 0,
							message: "Not Found",
						});
					} else {
						res.status(200).json({
							status: 1,
							row: data,
						});
					}
				});
			}
		}
	);
});

router.put("/updateCashier", jwtTokenAuth, function (req, res) {
	const { page, type, page_id, updateData } = req.body;

	const pageClass = getTypeClass(page);
	const typeClass = getTypeClass(type);
	const username = req.sign_creds.username;
	typeClass.findOne(
		{
			username,
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
				Cashier.countDocuments(
					{ bank_user_id: updateData.bank_user_id },
					function (err1, c) {
						console.log(c);
						if (c > 0) {
							res.status(200).json({
								status: 0,
								message: "User is already assigned to this or another cashier",
							});
						} else {
							pageClass.findByIdAndUpdate(
								page_id,
								updateData,
								function (err2, data) {
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

router.post("/:user/forgotPassword", function (req, res) {
	let data = new OTP();
	// const user_type = req.params.user;
	const { mobile, user_type } = req.body;
	const Type = getTypeClass(user_type);
	Type.findOne(
		{
			mobile: mobile,
		},
		function (err, user) {
			let result = errorMessage(err, user, "Account not found!");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				data.user_id = user._id;
				data.otp = makeotp(6);
				data.page = user_type + "ForgotPassword";
				data.mobile = mobile;

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
						let content =
							"Beyond Ewallet :-Your OTP to change password is " + data.otp;
						sendSMS(content, mobile);
						sendMail(content, "OTP", user.email);

						res.status(200).json({
							status: 1,
							message: "OTP is sent to your mobile and email",
						});
					}
				});
			}
		}
	);
});

router.post("/:user/verifyForgotPasswordOTP", function (req, res) {
	const { mobile, otp } = req.body;
	const user_type = req.params.user;
	const page = user_type + "ForgotPassword";
	OTP.findOne(
		{
			mobile,
			otp,
			page,
		},
		function (err, ot) {
			let result = errorMessage(err, ot, "Invalid OTP!");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const password = makeid(10);
				const Type = getTypeClass(user_type);
				Type.findByIdAndUpdate(
					ot.user_id,
					{ password: password, status: 0 },
					(err1, user) => {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1 = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						} else {
							OTP.deleteOne({ _id: ot._id }, (err2) => {
								console.log("deleted");
							});
							let content =
								"<p>A one time password is generated for user " +
								user.name +
								" in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
								config.mainIP +
								"/" +
								user_type +
								"/" +
								"'>http://" +
								config.mainIP +
								+"/" +
								user_type +
								"/" +
								"</a></p><p><p>Your username: " +
								user.username +
								"</p><p>Your password: " +
								password +
								"</p>";
							sendMail(content, "One Time Password ", user.email);
							let content2 =
								"E-Wallet: A one time password is generated for user " +
								user.name +
								" Login URL: http://" +
								config.mainIP +
								"/" +
								user_type +
								"/" +
								" Your username: " +
								user.username +
								" Your password: " +
								password;
							sendSMS(content2, user.mobile);
							res.status(200).json({
								status: 1,
								message: "OTP Verification for forgot password is successfull",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bankForgotPassword", function (req, res) {
	let data = new OTP();
	const { mobile } = req.body;
	Bank.findOne(
		{
			mobile: mobile,
		},
		function (err, bank) {
			let result = errorMessage(err, bank, "Account not found!");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				data.user_id = bank._id;
				data.otp = makeotp(6);
				data.page = "bankForgotPassword";
				data.mobile = mobile;

				data.save((err1) => {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message) {
							message1 = err.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else {
						let content = "Your OTP to change password is " + data.otp;
						sendSMS(content, mobile);
						sendMail(content, "OTP", bank.email);

						res.status(200).json({
							status: 1,
							mobile: mobile,
							username: bank.username,
						});
					}
				});
			}
		}
	);
});

router.post("/branchForgotPassword", function (req, res) {
	let data = new OTP();
	const { mobile } = req.body;
	Branch.findOne(
		{
			mobile: mobile,
		},
		function (err, bank) {
			let result = errorMessage(err, bank, "Account not found!");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				data.user_id = bank._id;
				data.otp = makeotp(6);
				data.page = "branchForgotPassword";
				data.mobile = mobile;

				data.save((err1) => {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message) {
							message1 = err.message1;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else {
						let content = "Your OTP to change password is " + data.otp;
						sendSMS(content, mobile);
						sendMail(content, "OTP", bank.email);

						res.status(200).json({
							status: 1,
							mobile: mobile,
							username: bank.username,
						});
					}
				});
			}
		}
	);
});

router.post("/cashierForgotPassword", function (req, res) {
	let data = new OTP();
	const { mobile } = req.body;
	BankUser.findOne(
		{
			mobile: mobile,
		},
		function (err, bank) {
			let result = errorMessage(err, bank, "Account not found!");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				data.user_id = bank._id;
				data.otp = makeotp(6);
				data.page = "cashierForgotPassword";
				data.mobile = mobile;

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
						let content = "Your OTP to change password is " + data.otp;
						sendSMS(content, mobile);
						sendMail(content, "OTP", bank.email);

						res.status(200).json({
							status: 1,
							mobile: mobile,
							username: bank.username,
						});
					}
				});
			}
		}
	);
});

router.post("/forgotPassword", function (req, res) {
	let data = new OTP();
	const { mobile } = req.body;
	Infra.findOne(
		{
			mobile: mobile,
		},
		function (err, bank) {
			let result = errorMessage(err, bank, "Account not found!");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				data.user_id = bank._id;
				data.otp = makeotp(6);
				data.page = "forgotPassword";
				data.mobile = mobile;

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
						let content = "Your OTP to change password is " + data.otp;
						sendSMS(content, mobile);
						sendMail(content, "OTP", bank.email);

						res.status(200).json({
							status: 1,
							mobile: mobile,
							username: bank.username,
						});
					}
				});
			}
		}
	);
});
/* Bank APIs end */

router.post("/sendOTP", jwtTokenAuth, function (req, res) {
	let data = new OTP();
	const { page, type, email, mobile, txt } = req.body;
	const typeClass = getTypeClass(type);
	const username = req.sign_creds.username;
	typeClass.findOne(
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
				data.user_id = user._id;
				data.otp = makeotp(6);
				data.page = page;
				data.mobile = mobile;
				data.save((err1, ot) => {
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
						let content = txt + data.otp;
						sendSMS(content, mobile);
						sendMail(content, "OTP", email);

						res.status(200).json({
							status: 1,
							id: ot._id,
						});
					}
				});
			}
		}
	);
});

router.post("/generateOTPBank", function (req, res) {
	let data = new OTP();
	const { username } = req.body;

	Bank.findOne(
		{
			username,
		},
		function (err, bank) {
			data.user_id = "0";
			data.otp = makeotp(6);
			data.page = "bankbankinfo";
			data.mobile = bank.mobile;

			data.save((err1, ot) => {
				if (err1) {
					console.log(err1);
					var message1 = err1;
					if (err1.message) {
						message1 = err.message;
					}
					res.status(200).json({
						status: 0,
						message: message1,
					});
				} else {
					let content = "Your OTP to edit Bank is " + data.otp;
					sendSMS(content, bank.mobile);
					sendMail(content, "OTP", bank.email);

					res.status(200).json({
						status: 1,
						id: ot._id,
					});
				}
			});
		}
	);
});

router.post("/verifyOTP", function (req, res) {
	const { mobile, otp } = req.body;
	OTP.findOne(
		{
			mobile,
			otp,
		},
		function (err, ot) {
			let result = errorMessage(err, ot, "Invalid OTP!");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				let userType = "infra";
				if (ot.page == "bankForgotPassword") {
					userType = "bank";
				} else if (ot.page == "branchForgotPassword") {
					userType = "branch";
				} else if (ot.page == "cashierForgotPassword") {
					userType = "cashier";
				}
				let sign_creds = { username: username, type: userType };
				const token = jwtsign(sign_creds);
				res.status(200).json({
					status: 1,
					user: user,
					token: token,
				});
			}
		}
	);
});

router.post("/InfraVrifyOTP", function (req, res) {
	res.status(200).json({
		status: 0,
		message: "This API is removed",
		replace: "/verifyOTP - {mobile, otp}",
	});
});

router.post("/getRule", function (req, res) {
	const { rule_id } = req.body;
	Infra.findOne(
		{
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

				Fee.findOne(
					{
						_id: rule_id,
					},
					function (err1, rule) {
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
								rules: rule,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/getHistory", jwtTokenAuth, function (req, res) {
	const { from, where } = req.body;
	const pageClass = getTypeClass(from);
	const username = req.sign_creds.username;
	pageClass.findOne(
		{
			username,
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
				if (from == "cashier") {
					CashierSend.find(where, function (err1, b) {
						var res1 = b;
						console.log(res);
						CashierClaim.find(where, function (err2, b2) {
							var res2 = b2;
							const result2 = {};
							let key;

							for (key in res1) {
								if (res1.hasOwnProperty(key)) {
									result2[key] = res1[key];
								}
							}

							for (key in res2) {
								if (res2.hasOwnProperty(key)) {
									result2[key] = res2[key];
								}
							}
							res.status(200).json({
								status: 1,
								history: result2,
							});
						});
					});
				}
			}
		}
	);
});

router.post("/getCashierHistory", jwtTokenAuth, function (req, res) {
	const { from, where } = req.body;
	const pageClass = getTypeClass(from);
	const username = req.sign_creds.username;
	pageClass.findOne(
		{
			username,
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
				if (from == "cashier") {
					CashierSend.find(where, function (err1, b) {
						var res1 = b;

						CashierClaim.find(where, function (err2, b2) {
							var res2 = b2;

							CashierPending.find(where, function (err3, b3) {
								var res3 = b3;
								res.status(200).json({
									status: 1,
									history1: res1,
									history2: res2,
									history3: res3,
								});
							});
						});
					});
				}
			}
		}
	);
});

router.post("/getBranchTransHistory", jwtTokenAuth, function (req, res) {
	const { from, where } = req.body;
	const pageClass = getTypeClass(from);
	const username = req.sign_creds.username;
	pageClass.findOne(
		{
			username,
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
				if (from == "branch") {
					BranchSend.find(where, function (err1, b) {
						var res1 = b;

						BranchClaim.find(where, function (err2, b2) {
							var res2 = b2;

							res.status(200).json({
								status: 1,
								history1: res1,
								history2: res2,
							});
						});
					});
				}
			}
		}
	);
});

router.post("/getTransHistory", function (req, res) {
	const { master_code } = req.body;

	getChildStatements(master_code)
		.then(function (result) {
			res.status(200).json({
				status: 1,
				result: result,
			});
		})
		.catch((err) => {
			console.log(err);
			res.status(200).json({
				status: 0,
				message: err.message,
			});
		});
});

router.post("/getHistoryTotal", jwtTokenAuth, function (req, res) {
	const { from } = req.body;
	const pageClass = getTypeClass(from);
	const username = req.sign_creds.username;
	pageClass.findOne(
		{
			username,
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
				if (from == "cashier") {
					CashierSend.countDocuments({}, function (err1, c1) {
						var res1 = c;
						console.log(res1);
						CashierClaim.countDocuments({}, function (err2, c2) {
							var res2 = c;
							let result9 = res1 + res2;
							res.status(200).json({
								status: 1,
								history: result9,
							});
						});
					});
				}
			}
		}
	);
});

router.get("/clearDb", function (req, res) {
	const type = req.query.type;
	var matchfound = false;

	if (type == "all" || type == "infra") {
		matchfound = true;
		db.dropCollection("infras", function () { });
	}
	if (type == "all" || type == "otp") {
		matchfound = true;
		db.dropCollection("otps", function () { });
	}
	if (type == "all" || type == "bank") {
		matchfound = true;
		db.dropCollection("banks", function () { });
	}
	if (type == "all" || type == "profile") {
		matchfound = true;
		db.dropCollection("profiles", function () { });
	}
	if (type == "all" || type == "fee") {
		matchfound = true;
		db.dropCollection("fees", function () { });
	}
	if (type == "all" || type == "document") {
		matchfound = true;
		db.dropCollection("documents", function () { });
	}
	if (type == "all" || type == "bankfee") {
		matchfound = true;
		db.dropCollection("bankfees", function () { });
	}
	if (type == "all" || type == "branch") {
		matchfound = true;
		db.dropCollection("branches", function () { });
	}
	if (type == "all" || type == "cashier") {
		matchfound = true;
		db.dropCollection("cashiers", function () { });
	}

	if (type == "all" || type == "bankuser") {
		matchfound = true;
		db.dropCollection("bankusers", function () { });
	}

	if (type == "all" || type == "cashiersend") {
		matchfound = true;
		db.dropCollection("cashiersends", function () { });
	}

	if (type == "all" || type == "cashierclaim") {
		matchfound = true;
		db.dropCollection("cashierclaims", function () { });
	}

	if (type == "all" || type == "cashierledger") {
		matchfound = true;
		db.dropCollection("cashierledgers", function () { });
	}

	if (type == "all" || type == "branchsend") {
		matchfound = true;
		db.dropCollection("branchsends", function () { });
	}

	if (type == "all" || type == "branchclaim") {
		matchfound = true;
		db.dropCollection("branchclaims", function () { });
	}

	if (type == "all" || type == "branchledger") {
		matchfound = true;
		db.dropCollection("branchledgers", function () { });
	}

	if (type == "all" || type == "user") {
		matchfound = true;
		db.dropCollection("users", function () { });
	}

	if (type == "all" || type == "merchant") {
		matchfound = true;
		db.dropCollection("merchants", function () { });
	}

	if (type == "all" || type == "merchantrule") {
		matchfound = true;
		db.dropCollection("merchantrules", function () { });
	}

	if (type == "all" || type == "failedtx") {
		matchfound = true;
		db.dropCollection("failedtxes", function () { });
	}

	if (type == "all" || type == "invoicegroup") {
		matchfound = true;
		db.dropCollection("invoicegroups", function () { });
	}

	if (type == "all" || type == "invoice") {
		matchfound = true;
		db.dropCollection("invoices", function () { });
	}

	if (type == "all" || type == "merchantbranch") {
		matchfound = true;
		db.dropCollection("merchantbranches", function () { });
	}

	if (type == "all" || type == "merchantstaff") {
		matchfound = true;
		db.dropCollection("merchantstaffs", function () { });
	}

	if (type == "all" || type == "merchantstaff") {
		matchfound = true;
		db.dropCollection("merchantstaffs", function () { });
	}

	if (type == "all" || type == "zone") {
		matchfound = true;
		db.dropCollection("zones", function () { });
	}

	if (type == "all" || type == "partnerbranch") {
		matchfound = true;
		db.dropCollection("partnerbranches", function () { });
	}

	if (type == "all" || type == "partneruser") {
		matchfound = true;
		db.dropCollection("partnerusers", function () { });
	}

	if (type == "all" || type == "partnercashier") {
		matchfound = true;
		db.dropCollection("partnercashiers", function () { });
	}

	if (type == "all" || type == "merchantbranch") {
		matchfound = true;
		db.dropCollection("merchantbranches", function () { });
	}

	if (type == "all" || type == "merchantuser") {
		matchfound = true;
		db.dropCollection("merchantusers", function () { });
	}

	res.status(200).json({
		status: 1,
		matchfound: matchfound,
	});
});

router.post("/save-currency", async (req, res) => {
	try {
		const input = req.body;
		const currencyData = await CurrencyModel.find({});
		if (currencyData.length == 0) {
			await CurrencyModel(input).save();
		} else {
			await CurrencyModel.updateOne(
				{ _id: currencyData[0]._id },
				{ $set: input }
			);
		}
		res.status(200).json({ status: 1, message: "saved", input });
	} catch (err) {
		res.status(200).json({ status: 0, message: err.message });
	}
});

router.post("/save-country", async (req, res) => {
	try {
		const country = {
			ccode: req.body.ccode,
			name: req.body.name,
		};
		const countryData = await CountryModel.find({});
		if (countryData.length == 0) {
			const data = new CountryModel();
			data.country_list = [country];
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
					res.status(200).json({
						status: 1,
						message: "Country Added",
					});
				}
			});
		} else {
			CountryModel.updateOne(
				{},
				{ $push: { country_list: country } },
				function (err, model) {
					let result = errorMessage(err, model, "Not found");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						res.status(200).json({
							status: 1,
							message: "Country Added",
						});
					}
				}
			);
		}
	} catch (err) {
		res.status(200).json({ status: 0, message: err.message });
	}
});

router.get("/get-currency", async (req, res) => {
	try {
		const data = await CurrencyModel.find({});
		res.status(200).json({ status: 1, data });
	} catch (err) {
		res.status(200).json({ status: 0, message: err.message });
	}
});

router.get("/get-country", async (req, res) => {
	try {
		const data = await CountryModel.find({});
		res.status(200).json({ status: 1, data });
	} catch (err) {
		res.status(200).json({ status: 0, message: err.message });
	}
});

router.post("/delete-country", async (req, res) => {
	const { id } = req.body;
	try {
		console.log(id);
		const data = await CountryModel.updateOne({ $pull: { 'country_list':  {$elemMatch :{ _id: String(id) } }}})
		res.status(200).json({ status: 1, message: 'country deleted', data });
	} catch (err) {
		res.status(200).json({ status: 0, message: err.message });
	}
});

module.exports = router;
