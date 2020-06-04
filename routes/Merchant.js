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

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const makeid = require("./utils/idGenerator");
const makeotp = require("./utils/makeotp");
const blockchain = require("../services/Blockchain");

router.post("/merchant/createZone", jwtTokenAuth, (req, res) => {
	let data = new Zone();
	const { code, name } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			if (err || merchant == null) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else {
				data.code = code;
				data.name = name;
				data.merchant_id = merchant._id;
				data.save((err, zone) => {
					if (err) {
						console.log(err);
						return res.status(200).json({
							status: 0,
							message: "code already exist",
						});
					} else {
						return res.status(200).json({ status: 1, message: "Zone Created", zone: zone });
					}
				});
			}
		}
	);
});

router.get("/merchant/listZones", jwtTokenAuth, (req, res) => {
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			if (err || merchant == null) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else {
				Zone.find({ merchant_id: merchant._id },(err, zones) => {
					if (err) {
						res.status(200).json({
							status: 0,
							message: "Internal server error",
						});
					} else {
						res.status(200).json({
							status: 1,
							zones: zones,
						});
					}
				});
			}
		}
	);
});

router.post("/merchant/addCashier", jwtTokenAuth, (req, res) => {
	let data = new MerchantCashier();
	const {
		name,
		branch_id,
		credit_limit,
		working_from,
		working_to,
		per_trans_amt,
		max_trans_amt,
		max_trans_count,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			if (err || merchant == null) {
				res.status(200).json({
					status:0,
					message: "Unauthorized",
				});
			} else {
				data.name = name;
				data.credit_limit = credit_limit;
				data.working_from = working_from;
				data.working_to = working_to;
				data.per_trans_amt = per_trans_amt;
				data.max_trans_amt = max_trans_amt;
				data.max_trans_count = max_trans_count;
				data.merchant_id = merchant._id;
				data.branch_id = branch_id;
				data.save((err, d) => {
					if (err) {
						console.log(err)
						return res.json({
							status: 0,
							message: err.toString(),
						});
					}
				 else {
						MerchantBranch.findOneAndUpdate({ _id: branch_id }, { $inc: { total_cashiers: 1 } }, function (e, v) {
							return res.status(200).json({ status: 1, data: d});
						});
					}
				});
			}
		}
	);
});

router.post("/merchant/addStaff", jwtTokenAuth, (req, res) => {
	let data = new MerchantStaff();
	const jwtusername = req.sign_creds.username;
	const { name, email, ccode, mobile, username, password, branch_id, logo } = req.body;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			if (err || user == null) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else {
				data.name = name;
				data.email = email;
				data.mobile = mobile;
				data.username = username;
				data.password = password;
				data.branch_id = branch_id;
				data.merchant_id = user._id;
				data.ccode = ccode;
				data.logo = logo;

				data.save((err) => {
					if (err) {
						console.log(err)
						return res.json({
							status: 0,
							message: "User ID / Email / Mobile already exists",
						});
					} else {
					let content =
						"<p>Your have been added as a Merchant Staff in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
						config.mainIP +
						"/merchant/cashier/" + name + "'>http://" +
						config.mainIP +
						"/merchant/cashier/" + name + "</a></p><p><p>Your username: " +
						username +
						"</p><p>Your password: " +
						password +
						"</p>";
					sendMail(content, "Merchant Staff Account Created", email);
					let content2 =
						"Your have been added as Merchant Staff in E-Wallet application Login URL: http://" +
						config.mainIP +
						"/cashier/" + name + " Your username: " +
						username +
						" Your password: " +
						password;
					sendSMS(content2, mobile);
					return res.status(200).json({
						status: 1,
						message: "Merchant staff added successfully"
					});
				}
				});
			}
		}
	);
});
router.post("/merchant/editStaff", jwtTokenAuth, (req, res) => {
	const { name, email, ccode, mobile, username, password, branch_id, logo, user_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			if (err || user == null) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else {
				MerchantStaff.findOneAndUpdate(
					{
						_id: user_id,
					},
					{
						name: name,
						email: email,
						ccode: ccode,
						mobile: mobile,
						username: username,
						password: password,
						branch_id: branch_id,
						logo: logo,
					},
					(err, user) => {
						if (err) {
							res.status(200).json({
								status: 0,
								message: err,
							});
						} else {
							res.status(200).json({
								status: 1,
								message: "Staff updated successfully",
							});
						}
					}
				);
			}
		}
	);
});

router.get("/merchant/listStaff", jwtTokenAuth, (req, res) => {
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			if (err || user == null) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else {
				MerchantStaff.find(
					(err, staffs) => {
						if (err) {
							res.status(200).json({
								status: 0,
								message: err,
							});
						} else {
							res.status(200).json({
								status: 1,
								data: staffs,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/blockStaff", jwtTokenAuth, (req, res) => {
	const { merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			if (err || user == null) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else {
				MerchantStaff.findOneAndUpdate({_id: merchant_id},
					{ $set: {
						status: 0
					}
					},
					(err, staff) => {
						if (err) {
							res.status(200).json({
								status: 0,
								message: err,
							});
						} else {
							res.status(200).json({
								status: 1,
								data: "blocked staff",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/createBranch", jwtTokenAuth, (req, res) => {
	let data = new MerchantBranch();
	const {
		name,
		code,
		zone_id,
		username,
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

	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
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
				data.code = code;
				data.zone_id = zone_id;
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

				data.save((err, branch) => {
					if (err) {
						console.log(err);
						return res.json({
							status: 0,
							message: "Internal server error",
						});
					} else {
						let content =
							"<p>You are added as a branch for merchant " +
							merchant.name +
							" in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
							config.mainIP +
							"/merchant/branch/" +
							name +
							"'>http://" +
							config.mainIP +
							"/merchant/branch/" +
							name +
							"</a></p><p><p>Your username: " +
							username +
							"</p><p>Your password: " +
							data.password +
							"</p>";
						sendMail(content, "Merchant Branch Created", email);
						let content2 =
							"You are added as a branch for merchant " +
							merchant.name +
							" in E-Wallet application Login URL: http://" +
							config.mainIP +
							"/merchant/branch/" +
							name +
							" Your username: " +
							username +
							" Your password: " +
							data.password;
						sendSMS(content2, mobile);
						res.status(200).json({
							status: 1,
							message: "Branch Created",
							branch: branch
						});
					}
				});
			}
		}
	);
});

router.post("/merchant/editBranch", jwtTokenAuth, (req, res) => {
	const {
		name,
		username,
		bcode,
		address1,
		state,
		zip,
		country,
		ccode,
		email,
		working_from,
		working_to,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	console.log(jwtusername)
	Merchant.findOne(
		{
			username: jwtusername,
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
				MerchantBranch.findOneAndUpdate(
					bcode,
					{
						name: name,
						username: username,
						address1: address1,
						state: state,
						zip: zip,
						ccode: ccode,
						bcode: bcode,
						country: country,
						email: email,
						working_from: working_from,
						working_to: working_to,
					},
					{ new: true },
					(err, branch) => {
						if (err) {
							res.status(200).json({
								status: 0,
								message: err,
							});
						} else {
							res.status(200).json({
								status: 1,
								data: branch,
							});
						}
					}
				);
			}
		}
	);
});

router.get("/merchant/listBranches", jwtTokenAuth, function (req, res) {
    const username = req.sign_creds.username;
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
				MerchantBranch.find({ merchant_id: merchant._id }, "-password", function (err, branch) {
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

router.get("/merchant/getWalletBalance", jwtTokenAuth, (req, res) => {
	const username = req.sign_creds.username;
	Merchant.findOne(
		{
			username,
			status: 1,
		},
		function (err, merchant) {
			if (err || merchant == null) {
				res.status(401).json({
					status: 0,
					message: "Unauthorized",
				});
			} else {
				Bank.findOne({ _id: merchant.bank_id }, (err, bank) => {
					if (err) {
						res.status(200).json({
							status: 0,
							error: "Internal Server Error",
						});
					} else {
						const wallet_id = merchant.username + "_operational@" + bank.name;
						blockchain.getBalance(wallet_id).then(function (result) {
							res.status(200).json({
								status: 1,
								balance: result,
							});
						});
					}
				});
			}
		}
	);
});

module.exports = router;