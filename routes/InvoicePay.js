const express = require("express");
const router = express.Router();

//utils
const { errorMessage } = require("./utils/errorHandler");

//controllers
const cashInvoicePayCntrl = require("../controllers/cashier/invoicePayTransaction");
const userInvoicePay = require("../controllers/user/invoicePayTransaction");
const merchantInvoicePay = require("../controllers/merchantCashier/invoicePayTransaction");
const interBankCashInvoicePayCntrl = require("../controllers/cashier/interBankInvoicePayTransaction");
const interBankUserInvoicePay = require("../controllers/user/interBankInvoicePayTransaction");

//models
const MerchantPosition = require("../models/merchant/Position");
const Cashier = require("../models/Cashier");
const User = require("../models/User");
const Invoice = require("../models/merchant/Invoice");
const PartnerCashier = require("../models/partner/Cashier");

const jwtTokenAuth = require("./JWTTokenAuth");

router.post(
	"/user/interBank/payInvoice",
	jwtTokenAuth,
	interBankUserInvoicePay
);

router.post(
	"/partnerCashier/interBank/payInvoice",
	jwtTokenAuth,
	interBankCashInvoicePayCntrl.partnerInvoicePay
);

router.post(
	"/cashier/interBank/payInvoice",
	jwtTokenAuth,
	interBankCashInvoicePayCntrl.cashierInvoicePay
);

router.post(
	"/merchantStaff/getInvoicesByCustomerCode",
	jwtTokenAuth,
	(req, res) => {
		const { customer_code } = req.body;
		const jwtusername = req.sign_creds.username;
		MerchantPosition.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err, position) {
				let errRes = errorMessage(err, position, "Position is not activated.");
				if (errRes.status == 0) {
					res.status(200).json(errRes);
				} else {
					Invoice.find(
						{
							is_validated: 1,
							merchant_id: position.merchant_id,
							customer_code: customer_code,
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
							} else if (invoices.length == 0) {
								res.status(200).json({
									status: 0,
									message: "Invoice not found",
								});
							} else {
								res.status(200).json({
									status: 1,
									invoice: invoices,
								});
							}
						}
					);
				}
			}
		);
	}
);

router.post("/merchantStaff/getInvoicesByNumber", jwtTokenAuth, (req, res) => {
	const { number } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			type: "staff",
			status: 1,
		},
		function (err, position) {
			let errRes = errorMessage(err, position, "Position is not activated.");
			if (errRes.status == 0) {
				res.status(200).json(errRes);
			} else {
				Invoice.find(
					{
						is_validated: 1,
						merchant_id: position.merchant_id,
						$or: [{ number: number }, { reference_invoice: number }],
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
						} else if (invoices.length == 0) {
							res.status(200).json({
								status: 0,
								message: "Invoice not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								invoice: invoices,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchantStaff/getInvoicesByMobile", jwtTokenAuth, (req, res) => {
	const { mobile } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, position) {
			let errRes = errorMessage(err, position, "Position is not valid");
			if (errRes.status == 0) {
				res.status(200).json(errRes);
			} else {
				Invoice.find(
					{
						mobile: mobile,
						is_validated: 1,
						merchant_id: position.merchant_id,
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

router.post("/merchantStaff/payInvoice", jwtTokenAuth, merchantInvoicePay);

router.post(
	"/partnerCashier/payInvoice",
	jwtTokenAuth,
	cashInvoicePayCntrl.partnerInvoicePay
);

router.post(
	"/partnerCashier/getInvoicesForCustomerCode",
	jwtTokenAuth,
	(req, res) => {
		const { customer_code, merchant_id } = req.body;
		const jwtusername = req.sign_creds.username;
		PartnerCashier.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err, cashier) {
				let errRes = errorMessage(
					err,
					cashier,
					"Token changed or user not valid. Try to login again or contact system administrator."
				);
				if (errRes.status == 0) {
					res.status(200).json(errRes);
				} else {
					Invoice.find(
						{
							is_validated: 1,
							merchant_id: merchant_id,
							customer_code: customer_code,
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
							} else if (invoices.length == 0) {
								res.status(200).json({
									status: 0,
									message: "Invoice not found",
								});
							} else {
								res.status(200).json({
									status: 1,
									invoice: invoices,
								});
							}
						}
					);
				}
			}
		);
	}
);

router.post("/partnerCashier/getInvoiceDetails", jwtTokenAuth, (req, res) => {
	const { number, merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let errRes = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (errRes.status == 0) {
				res.status(200).json(errRes);
			} else {
				Invoice.find(
					{
						is_validated: 1,
						merchant_id: merchant_id,
						$or: [{ number: number }, { reference_invoice: number }],
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
						} else if (invoices.length == 0) {
							res.status(200).json({
								status: 0,
								message: "Invoice not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								invoice: invoices,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/partnerCashier/getUserInvoices", jwtTokenAuth, (req, res) => {
	const { mobile, merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let errRes = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (errRes.status == 0) {
				res.status(200).json(errRes);
			} else {
				Invoice.find(
					{ mobile: mobile, merchant_id: merchant_id, is_validated: 1 },
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

router.post("/cashier/getInvoicesForCustomerCode", jwtTokenAuth, (req, res) => {
	const { customer_code, merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let errRes = errorMessage(err, cashier, "Cashier is not activated.");
			if (errRes.status == 0) {
				res.status(200).json(errRes);
			} else {
				Invoice.find(
					{
						is_validated: 1,
						merchant_id: merchant_id,
						customer_code: customer_code,
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
						} else if (invoices.length == 0) {
							res.status(200).json({
								status: 0,
								message: "Invoice not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								invoice: invoices,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/cashier/getInvoiceDetails", jwtTokenAuth, (req, res) => {
	const { number, merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let errRes = errorMessage(err, cashier, "Cashier is not activated.");
			if (errRes.status == 0) {
				res.status(200).json(errRes);
			} else {
				Invoice.find(
					{
						is_validated: 1,
						merchant_id: merchant_id,
						$or: [{ number: number }, { reference_invoice: number }],
					},
					(err1, invoices) => {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1= err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						} else if (invoices.length == 0) {
							res.status(200).json({
								status: 0,
								message: "Invoice not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								invoice: invoices,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/cashier/getUserInvoices", jwtTokenAuth, (req, res) => {
	const { mobile, merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let errRes = errorMessage(err, cashier, "Cashier is not valid");
			if (errRes.status == 0) {
				res.status(200).json(errRes);
			} else {
				Invoice.find(
					{ mobile: mobile, merchant_id: merchant_id, is_validated: 1 },
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

router.post(
	"/cashier/payInvoice",
	jwtTokenAuth,
	cashInvoicePayCntrl.cashierInvoicePay
);

router.post("/user/getInvoices", jwtTokenAuth, (req, res) => {
	const { merchant_id } = req.body;
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
			status: 1,
		},
		function (err, user) {
			let errRes = errorMessage(err, user, "User is not activated.");
			if (errRes.status == 0) {
				res.status(200).json(errRes);
			} else {
				Invoice.find(
					{ mobile: user.mobile, merchant_id: merchant_id, is_validated: 1 },
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

router.post("/user/getInvoicesByNumber", jwtTokenAuth, (req, res) => {
	const { number, merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let errRes = errorMessage(err, user, "User is not Valid.");
			if (errRes.status == 0) {
				res.status(200).json(errRes);
			} else {
				Invoice.find(
					{
						is_validated: 1,
						merchant_id: merchant_id,
						$or: [{ number: number }, { reference_invoice: number }],
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
						} else if (invoices.length == 0) {
							res.status(200).json({
								status: 0,
								message: "Invoice not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								invoice: invoices,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/user/getInvoicesForCustomerCode", jwtTokenAuth, (req, res) => {
	const { customer_code, merchant_id } = req.body;
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
			status: 1,
		},
		function (err, payer) {
			let errRes = errorMessage(err, payer, "User is not valid");
			if (errRes.status == 0) {
				res.status(200).json(errRes);
			} else {
				Invoice.find(
					{
						is_validated: 1,
						merchant_id: merchant_id,
						customer_code: customer_code,
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
						} else if (invoices.length == 0) {
							res.status(200).json({
								status: 0,
								message: "Invoice not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								invoice: invoices,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/user/getInvoicesForMobile", jwtTokenAuth, (req, res) => {
	const { mobile, merchant_id } = req.body;
	const username = req.sign_creds.username;
	User.findOne(
		{
			username,
			status: 1,
		},
		function (err, payer) {
			let errRes = errorMessage(err, payer, "User is not valid");
			if (errRes.status == 0) {
				res.status(200).json(errRes);
			} else {
				Invoice.find(
					{ mobile: mobile, merchant_id: merchant_id, is_validated: 1 },
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

router.post("/user/payInvoice", jwtTokenAuth, userInvoicePay);

module.exports = router;
