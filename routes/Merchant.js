const express = require("express");
const router = express.Router();

const jwtTokenAuth = require("./JWTTokenAuth");

//models
const Merchant = require("../models/Merchant");

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const makeid = require("./utils/idGenerator");
const makeotp = require("./utils/makeotp");
const blockchain = require("../services/Blockchain");

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