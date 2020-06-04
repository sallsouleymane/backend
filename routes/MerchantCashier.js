const express = require("express");
const router = express.Router();

const config = require("../config.json");
const jwtTokenAuth = require("./JWTTokenAuth");

//models
const Bank = require("../models/Bank");
const Merchant = require("../models/merchant/Merchant");
const MerchantBranch = require("../models/merchant/MerchantBranch");
const MerchantStaff = require("../models/merchant/MerchantStaff");
const MerchantCashier = require("../models/merchant/MerchantCashier");
const Zone = require("../models/merchant/Zone");
const Invoice = require("../models/merchant/Invoice");

router.post("/merchantCashier/createInvoices", jwtTokenAuth, (req, res) => {
	const { group_id, invoices } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantStaff.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			if (err || cashier == null) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else {
				invoices.forEach((invoice) => {
					var {
						number,
						name,
						merchant_id,
						amount,
						due_date,
						description,
						mobile,
						zone_id,
					} = invoice;
					var invoiceObj = new Invoice();
					invoiceObj.number = number;
					invoiceObj.name = name;
					invoiceObj.merchant_id = merchant_id;
					invoiceObj.amount = amount;
					invoiceObj.due_date = due_date;
					invoiceObj.description = description;
					invoiceObj.mobile = mobile;
					invoiceObj.group_id = group_id;
					invoiceObj.zone_id = zone_id;
					invoiceObj.save((err) => {});
				});
				return res.status(200).json({ status: 1, message: "Invoices Created" });
			}
		}
	);
});

router.get("/merchantCashier/listInvoices", jwtTokenAuth, (req, res) => {
	const jwtusername = req.sign_creds.username;
	MerchantStaff.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			if (err || cashier == null) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else {
				Invoice.find({ merchant_id: cashier.merchant_id }, (err, invoices) => {
					if (err) {
						res.status(200).json({
							status: 0,
							message: "Internal server error",
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

module.exports = router;