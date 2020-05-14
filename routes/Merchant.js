const express = require("express");
const router = express.Router();

const jwtTokenAuth = require("./JWTTokenAuth");

//models
const Merchant = require("../models/Merchant");
const MerchantBranch = require("../models/MerchantBranch");

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const makeid = require("./utils/idGenerator");
const makeotp = require("./utils/makeotp");
const blockchain = require("../services/Blockchain");

router.post("/merchant/createBranch", jwtTokenAuth, (req, res) => {
	let data = new MerchantBranch();
	const {
		name,
		bcode,
		username,
		credit_limit,
		cash_in_hand,
		address1,
		state,
		zip,
		country,
		ccode,
		mobile,
		email,
		working_from,
		working_to,
	} = req.body;

	const jwtusername = req.username;
	Merchant.findOne(
		{
			jwtusername,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				res.status(200).json({
					status: 0,
					message: "Internal Server Error",
				});
			} else if (merchant == null) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else {
				data.name = name;
				data.bcode = bcode;
				if (credit_limit !== "" && credit_limit != null) {
					data.credit_limit = credit_limit;
				}
				if (cash_in_hand !== "" && cash_in_hand != null) {
					data.cash_in_hand = cash_in_hand;
				}
				data.username = username;
				data.address1 = address1;
				data.state = state;
				data.country = country;
				data.zip = zip;
				data.ccode = ccode;
				data.mobile = mobile;
				data.email = email;
				data.merchant_id = merchant._id;
				data.password = makeid(10);
				data.working_from = working_from;
				data.working_to = working_to;

				data.save((err) => {
					if (err) {
						return res.json({
							status: 0,
							message: err.toString(),
						});
					} else {
						res.status(200).json({
							status: 1,
							message: "Branch Created"
						});
					}
				});
			}
		}
	);
});

router.post("/merchant/editBranch", (req, res) => {
	const {
		branch_id,
		name,
		username,
		credit_limit,
		bcode,
		address1,
		state,
		zip,
		country,
		ccode,
		mobile,
		email,
		working_from,
		working_to,
	} = req.body;
	const jwtusername = req.username;
	Merchant.findOne(
		{
			jwtusername,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				res.status(200).json({
					status: 0,
					message: "Internal Server Error",
				});
			} else if (merchant == null) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else {
				MerchantBranch.findByIdAndUpdate(
					branch_id,
					{
						name: name,
						credit_limit: credit_limit,
						username: username,
						address1: address1,
						state: state,
						zip: zip,
						ccode: ccode,
						bcode: bcode,
						country: country,
						mobile: mobile,
						email: email,
						working_from: working_from,
						working_to: working_to,
					},
					(err) => {
						if (err) {
							return res.status(200).json({
								status: 0,
								message: err,
							});
						} else {
							return res.status(200).json({
								status: 1,
								data: merchant,
							});
						}
					}
				);
			}
		}
	);
});

router.get("/merchant/listBranches", jwtTokenAuth, function (req, res) {
    const username = req.username;
	Merchant.findOne(
		{
			username,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				res.status(200).json({
					status: 0,
					message: "Internal Server Error",
				});
			} else if (merchant == null) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else {
				MerchantBranch.find({ merchant_id: merchant._id }, function (err, branch) {
					if (err) {
						res.status(200).json({
							status: 0,
							message: err,
						});
					} else {
						res.status(200).json({
							status: 1,
							branches: branch,
						});
					}
				});
			}
		}
	);
});

router.post("/merchant/changePassword", jwtTokenAuth, (req, res) => {
    const { password } = req.body;
    const username = req.username;
	Merchant.findOneAndUpdate(
		{
			username,
		},
		{
			password: password,
		},
		function (err, merchant) {
			if (err) {
				res.status(200).json({
					status: 0,
					error: "Internal Server Error",
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

router.get("/merchant/getWalletBalance", jwtTokenAuth, (req, res) => {
    const username = req.username;
	Merchant.findOne(
		{
			username,
			status: 1
		},
		function(err, merchant) {
			if (err || merchant == null) {
				res.status(401).json({
                    status: 0,
					message: "Unauthorized"
				});
			} else {
                const wallet_id = merchant.username + "_operational@" + merchant.bank;
				blockchain.getBalance(wallet_id).then(function(result) {
					res.status(200).json({
						status: 1,
						balance: result
					});
				});
			}
		}
	);
});

module.exports = router;