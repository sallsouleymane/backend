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
const Invoice = require("../models/merchant/Invoice");
const ClaimCode = require("../models/ClaimCode");
const MerchantSettings = require("../models/merchant/MerchantSettings");
const DailyReport = require("../models/cashier/DailyReport");
const MerchantPosition = require("../models/merchant/Position");

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

router.post("/:user/getMerchantCashierDashStats", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { staff_id } = req.body;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantStaff") {
		User = getTypeClass("merchantPosition");
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
				if(user === 'merchantBranch'){
					MerchantPosition.findOne(
						{
							_id: staff_id,
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
	if (user == "merchantStaff") {
		User = getTypeClass("merchantPosition");
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
				queryTxStates(
					bank_id,
					user === 'merchantStaff' ? data._id : staff_id,
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

router.post("/:user/getMerchantCashierDailyReport", jwtTokenAuth, function (req, res) {
	const { start, end, staff_id } = req.body;
	const jwtusername = req.sign_creds.username;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantStaff") {
		User = getTypeClass("merchantPosition");
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
				DailyReport.find(
					{ 	cashier_id: user==='merchantStaff' ? data._id : staff_id,
						created_at: {
						$gte: new Date(
							start
						),
						$lte: new Date(
							end
						),
					},
					},
					(err, reports) => {
						if (err) {
							res.status(200).json(catchError(err));
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
	if (user == "merchantStaff") {
		User = getTypeClass("merchantPosition");
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
				Invoice.find(
					{ 
						creator_id: user==='merchantStaff' ? data._id : staff_id,
						bill_date: date
					},
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
	);
});

router.post("/:user/listMerchantStaffInvoicesByPeriod", jwtTokenAuth, (req, res) => {
	const { start_date, end_date, staff_id} = req.body;
	const jwtusername = req.sign_creds.username;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantStaff") {
		User = getTypeClass("merchantPosition");
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
				Invoice.find(
					{ 	
						creator_id: user==='merchantStaff' ? data._id : staff_id,
						"bill_period.start_date":  {
							$gte: start_date
						},
						"bill_period.end_date": {
							$lte: end_date
						},
					},
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
	);
});

router.post("/:user/listMerchantStaffInvoicesByDateRange", jwtTokenAuth, (req, res) => {
	const { start_date, end_date, staff_id } = req.body;
	const jwtusername = req.sign_creds.username;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantStaff") {
		User = getTypeClass("merchantPosition");
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
				Invoice.find(
					{ 	creator_id: user==='merchantStaff' ? data._id : staff_id,
						created_at: {
							$gte: start_date,
							$lte: end_date,
						},
					},
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
						branch_id:  user === 'merchantBranch' ? data._id : branch_id,
						bill_date: date 
					},
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
					{ 	branch_id:  user === 'merchantBranch' ? data._id : branch_id,
						"bill_period.start_date":  {
							$gte: start_date
						},
						"bill_period.end_date": {
							$lte: end_date
						},
					},
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
					{ 	branch_id: user === 'merchantBranch' ? data._id : branch_id,
						created_at: {
							$gte: start_date,
							$lte: end_date,
						},
					},
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
	);
});

router.post("/:user/getMerchantSettings", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const user = req.params.user;
	var User = getTypeClass(user);
	if (user == "merchantStaff") {
		User = getTypeClass("merchantPosition");
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
					{ merchant_id: data.merchant_id },
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
					(err, invoices) => {
						if (err) {
							res.status(200).json(catchError(err));
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
					{ 	paid: 1,
						merchant_id: data.merchant_id,
						mobile: mobile,
					},
					(err, invoices) => {
						if (err) {
							res.status(200).json(catchError(err));
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
					{ 	paid: 1,
						merchant_id: data.merchant_id,
						$or: [{ number: number }, { reference_invoice: number }],
					},
					(err, invoices) => {
						if (err) {
							res.status(200).json(catchError(err));
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
					{ 	paid: 1,
						merchant_id: data.merchant_id,
						customer_code: customer_code,
					},
					(err, invoices) => {
						if (err) {
							res.status(200).json(catchError(err));
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
					(err, invoices) => {
						if (err) {
							res.status(200).json(catchError(err));
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
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const masterWallet = user.wallet_ids.master;
				const opWallet = user.wallet_ids.operational;
				const trans = {
					from: masterWallet,
					to: opWallet,
					amount: Number(amount),
					note: "Master to operational",
					email1: user.email,
					mobile1: user.mobile,
					from_name: user.name,
					to_name: user.name,
					master_code: "",
					child_code: "",
				};
				initiateTransfer(trans)
					.then((result) => {
						res.status(200).json(result);
					})
					.catch((err) => {
						console.log(err);
						res.status(200).json({
							status: 0,
							message: err.message,
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
						.catch((err) => {
							console.log(err);
							res.status(200).json({
								status: 0,
								message: err.message,
							});
						});
				} else {
					let wallet_id = b.wallet_ids[page];

					getBalance(wallet_id)
						.then(function (result) {
							res.status(200).json({
								status: 1,
								balance: result,
							});
						})
						.catch((err) => {
							console.log(err);
							res.status(200).json({
								status: 0,
								message: err.message,
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
				data.save((err, ot) => {
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
					(err, row) => {
						let result = errorMessage(err, row, page + " not found");
						if (result.status == 0) {
							res.status(200).json(result);
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
				Page.find(where, (err, rows) => {
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
				Page.findOne(where, (err, row) => {
					let result = errorMessage(err, row, page + " not found");
					if (result.status == 0) {
						res.status(200).json(result);
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
				if (page === type) {
					res.status(200).json({
						status: 1,
						row: t1,
					});
				} else {
					let where;
					where = { _id: page_id };

					pageClass.findOne(where, function (err, data) {
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
				if (where === undefined || where === "") {
					if (type === "bank") {
						whereData = { bank_id: type_id };
					}
				}
				pageClass.find(whereData, function (err, data) {
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
							bcode: bcode,
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
								function (err, fee) {
									if (fee == null) {
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
												let content =
													"<p>New fee rule has been added for your bank in E-Wallet application</p><p>&nbsp;</p><p>Fee Name: " +
													name +
													"</p>";
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
										let content =
											"<p>Rule " + name + " has been updated, check it out</p>";
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
					function (err, rules) {
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
					function (err, ba) {
						let result = errorMessage(err, ba, "Not found");
						if (result.status == 0) {
							res.status(200).json(result);
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
				pageClass.findByIdAndUpdate(page_id, updateData, function (err, data) {
					if (err) {
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
					function (err, c) {
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
								function (err, data) {
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
					(err, user) => {
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
							OTP.deleteOne({ _id: ot._id }, (err) => {
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
				data.save((err, ot) => {
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

			data.save((err, ot) => {
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
				let page = Infra;
				let userType = "infra";
				if (ot.page == "bankForgotPassword") {
					page = Bank;
					userType = "bank";
				} else if (ot.page == "branchForgotPassword") {
					page = Branch;
					userType = "branch";
				} else if (ot.page == "cashierForgotPassword") {
					page = BankUser;
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
				const user_id = user._id;

				Fee.findOne(
					{
						_id: rule_id,
					},
					function (err, rule) {
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
					CashierSend.find(where, function (err, b) {
						var res1 = b;
						console.log(res);
						CashierClaim.find(where, function (err, b) {
							var res2 = b;
							const result = {};
							let key;

							for (key in res1) {
								if (res1.hasOwnProperty(key)) {
									result[key] = res1[key];
								}
							}

							for (key in res2) {
								if (res2.hasOwnProperty(key)) {
									result[key] = res2[key];
								}
							}
							res.status(200).json({
								status: 1,
								history: result,
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
					CashierSend.find(where, function (err, b) {
						var res1 = b;

						CashierClaim.find(where, function (err, b) {
							var res2 = b;

							CashierPending.find(where, function (err, b) {
								var res3 = b;
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
					BranchSend.find(where, function (err, b) {
						var res1 = b;

						BranchClaim.find(where, function (err, b) {
							var res2 = b;

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
					CashierSend.countDocuments({}, function (err, c) {
						var res1 = c;
						console.log(res1);
						CashierClaim.countDocuments({}, function (err, c) {
							var res2 = c;
							let result = res1 + res2;
							res.status(200).json({
								status: 1,
								history: result,
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

module.exports = router;
