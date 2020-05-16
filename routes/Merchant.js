const express = require("express");
const router = express.Router();

const config = require("../config.json");
const jwtTokenAuth = require("./JWTTokenAuth");

//models
const Merchant = require("../models/Merchant");
const MerchantBranch = require("../models/MerchantBranch");
const MerchantUser = require("../models/MerchantUser");
const MerchantCashier = require("../models/MerchantCashier");

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const makeid = require("./utils/idGenerator");
const makeotp = require("./utils/makeotp");
const blockchain = require("../services/Blockchain");

router.post("/merchant/addCashier", jwtTokenAuth, (req, res) => {
	let data = new MerchantCashier();
	const {
		name,
		branch_id,
		credit_limit,
		bcode,
		working_from,
		working_to,
		per_trans_amt,
		max_trans_amt,
		max_trans_count,
	} = req.body;
	const jwtusername = req.username;
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
				data.bcode = bcode;
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
						MerchantBranch.findByIdAndUpdate(branch_id, { $inc: { total_cashiers: 1 } }, function (e, v) {
							return res.status(200).json({ status: 1, data: d});
						});
					}
				});
			}
		}
	);
});

router.post("/merchant/addStaff", jwtTokenAuth, (req, res) => {
	let data = new MerchantUser();
	const jwtusername = req.username;
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
						"<p>Your have been added as a Merchant User in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
						config.mainIP +
						"/merchant/cashier/yourBranchName'>http://" +
						config.mainIP +
						"/</a></p><p><p>Your username: " +
						username +
						"</p><p>Your password: " +
						password +
						"</p>";
					sendMail(content, "Merchant User Account Created", email);
					let content2 =
						"Your have been added as Merchant User in E-Wallet application Login URL: http://" +
						config.mainIP +
						"/cashier/yourBranchName Your username: " +
						username +
						" Your password: " +
						password;
					sendSMS(content2, mobile);
					return res.status(200).json({
						status: 1,
						message: "Merchant user added successfully"
					});
				}
				});
			}
		}
	);
});
router.post("/merchant/editStaff", jwtTokenAuth, (req, res) => {
	const { name, email, ccode, mobile, username, password, branch_id, logo, user_id } = req.body;
	const jwtusername = req.username;
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
				MerchantUser.findOneAndUpdate(
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
	const jwtusername = req.username;
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
				MerchantUser.find(
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
	const jwtusername = req.username;
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
				MerchantUser.findOneAndUpdate({_id: merchant_id},
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

router.post("/merchant/editBranch", jwtTokenAuth, (req, res) => {
	const {
		name,
		username,
		credit_limit,
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
	const jwtusername = req.username;
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
						credit_limit: credit_limit,
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