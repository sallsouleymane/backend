const express = require("express");
const router = express.Router();

//models
const User = require("../models/User");
const OTP = require("../models/OTP");
const Bank = require("../models/Bank");

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");

function makeotp(length) {
	// var result = '';
	// var characters = '0123456789';
	// var charactersLength = characters.length;
	// for (var i = 0; i < length; i++) {
	//   result += characters.charAt(Math.floor(Math.random() * charactersLength));
	// }
	// return result;

	return "111111";
}

router.post("/user/verify", (req, res) => {
	const { mobileNumber, email } = req.body;

	User.find(
		{
			$or: [{ mobile: mobileNumber }, { email: email }]
		},
		function(err, user) {
			if (err) {
				return res.status(200).json({
					error: "Internal Error"
				});
			}
			if (user.length > 0) {
				return res.status(200).json({
					error: "User already exist with either same email id or mobile number."
				});
			}
			let otp = makeotp(6);

			OTP.find({ page: "signup", mobile: mobileNumber, user_id: email }, (err, result) => {
				if (err) {
					return res.send(200).json({
						error: "Internal Error"
					});
				} else if (result.length == 0) {
					let otpSchema = new OTP();

					otpSchema.page = "signup";
					otpSchema.mobile = mobileNumber;
					otpSchema.user_id = email;
					otpSchema.otp = otp;

					otpSchema.save(err => {
						if (err) {
							console.log(err);
							return res.status(200).json({
								error: "Internal Error"
							});
						}
						let mailContent = "<p>Your OTP to verify your mobile number is " + otp + "</p>";
						sendMail(mailContent, "OTP", email);
						let SMSContent = "Your OTP to verify your mobile number is " + otp;
						sendSMS(SMSContent, mobileNumber);
						res.status(200).json({
							status: "success"
						});
					});
				} else {
					OTP.update({ _id: result[0].id }, { $set: { otp: otp } }, function(err, _result) {
						if (err) {
							return res.status(200).json({
								error: "Internal Error"
							});
						}
						let mailContent = "<p>Your OTP to verify your mobile number is " + otp + "</p>";
						sendMail(mailContent, "OTP", email);
						let SMSContent = "Your OTP to verify your mobile number is " + otp;
						sendSMS(SMSContent, mobileNumber);
						res.status(200).json({
							status: "success"
						});
					});
				}
			});
		}
	);
});

router.post("/user/signup", (req, res) => {
	const { name, mobileNumber, email, address, password, otp } = req.body;
	OTP.findOne({ page: "signup", mobile: mobileNumber, otp: otp, user_id: email }, function(
		err,
		result
	) {
		if (err) {
			console.log(err);
			return res.status(200).json({
				error: "Internal Error"
			});
		}
		if (result == null) {
			return res.status(200).json({
				error: "OTP Mismatch"
			});
		}
		OTP.deleteOne(result, function(err, obj) {
			if (err) {
				console.log(err);
				return res.status(200).json({
					error: "Internal Error"
				});
			}
			console.log("document deleted: ", result);
		});
		let user = new User();
		user.name = name;
		user.mobile = mobileNumber;
		user.email = email;
		user.address = address;
		user.password = password;
		user.otp = otp;
		user.status = 2;

		user.save(err => {
			if (err)
				return res.status(200).json({
					error: "User already exist with either same email id or mobile number."
				});
			res.status(200).json({
				status: "success"
			});
		});
	});
});

router.post("/user/assignBank", (req, res) => {
	const { token, bank } = req.body;
	User.findOneAndUpdate({ token: token }, { $set: { bank: bank } }, (err, user) => {
		if (err) {
			console.log(err);
			return res.status(200).json({
				error: "Internal Error"
			});
		}
		if (user == null) {
			return res.status(200).json({
				error: "You are either not authorised or not logged in."
			});
		}

		res.status(200).json({
			status: "success"
		});
	});
});

router.post("/user/saveUploadedDocsHash", (req, res) => {
	const { token, hashes } = req.body;
	User.findOneAndUpdate(
		{ token: token },
		{ $set: { docsHash: hashes, status: 3 } }, //Status 3: Waiting for cashier approval 
		(err, result) => {
			if (err) {
				console.log(err);
				return res.status(200).json({
					error: "Internal Error"
				});
			}
			if (result == null) {
				return res.status(200).json({
					error: "You are either not authorised or not logged in."
				});
			}
			res.status(200).json({
				status: "success"
			});
		}
	);
});
router.post("/user/skipDocsUpload", (req, res) => {
	const { token } = req.body;
	User.findOneAndUpdate({ token: token }, { $set: { status: 4 } }, (err, result) => {   //status 4: Go to the nearest branch and get docs uploaded
		if (err) {
			console.log(err);
			return res.status(200).json({
				error: "Internal Error"
			});
		}
		if (result == null) {
			return res.status(200).json({
				error: "You are either not authorised or not logged in."
			});
		}
		res.status(200).json({
			status: "success"
		});
	});
});

router.post("/user/getBanks", function(req, res) {
	const { token } = req.body;
	User.findOne(
		{
			token
		},
		function(err, user) {
			if (err) {
				console.log(err);
				return res.status(200).json({
					error: "Internal Error"
				});
			}
			if (user == null) {
				res.status(200).json({
					error: "You are either not authorised or not logged in."
				});
			} else {
				Bank.find({ initial_setup: { $eq: true } }, function(err, approvedBanks) {
					if (err) {
						console.log(err);
						return res.status(200).json({
							error: "Internal Error"
						});
					}
					res.status(200).json({
						banks: approvedBanks
					});
				});
			}
		}
	);
});

router.post("/user/getTransactionHistory", function(req, res) {
	const { token } = req.body;
	User.findOne(
		{
			token
		},
		function(err, user) {
			if (err || user == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				res.status(200).json({
					error: null
				});
			}
		}
	);
});

module.exports = router;
