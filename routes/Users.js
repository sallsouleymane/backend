const express = require("express");
const router = express.Router();

//models
const User = require("../models/User");
const OTP = require("../models/OTP");
const Bank = require("../models/Bank");

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const makeid = require("./utils/idGenerator");

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

router.post("/user/userVerify", (req, res) => {
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

router.post("/user/userSignup", (req, res) => {
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

router.post("/user/userLogin", (req, res) => {
	const { mobileNumber, password } = req.body;
	let token = makeid(10);
	User.findOneAndUpdate(
		{ mobile: mobileNumber, password: password },
		{ $set: { token: token } },
		function(err, user) {
			if (err) {
				console.log(err);
				return res.status(200).json({
					error: "Internal Error"
				});
			}
			if (user == null) {
				return res.status(200).json({
					error: "User account not found. Please signup"
				});
			}

			res.status(200).json({
				status: user.status,
				token: token
			});
		}
	);
});

router.post("/user/assignBankToUser", (req, res) => {
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

router.post("/user/saveUploadedUserDocsHash", (req, res) => {
	const { token, hashes } = req.body;
	User.findOneAndUpdate(
		{ token: token },
		{ $set: { docsHash: hashes, status: 3 } },
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
router.post("/user/skipUserDocsUpload", (req, res) => {
	const { token } = req.body;
	User.findOneAndUpdate({ token: token }, { $set: { status: 4 } }, (err, result) => {
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

router.post("/user/getBanksForUser", function(req, res) {
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
					error: "User do not exist or not authorised. Please either signup or login again"
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

router.post("/user/checkToken", function(req, res) {
	const { token } = req.body;
	User.findOne(
		{
			token,
			status: 1
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

router.post("/user/logout", function(req, res) {
	const { token } = req.body;
	User.findOne(
		{
			token,
			status: 1
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
