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
	merchant.findOneAndUpdate(
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