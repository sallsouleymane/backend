const express = require('express')
const router = express.Router()
const User = require('../models/User')
const OTP = require('../models/OTP')
const sendSMS = require('./utils/sendSMS')
const sendMail = require('./utils/sendMail')
const makeid = require('./utils/idGenerator')

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

router.post("/userVerify", (req, res) => {
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

					(otpSchema.page = "signup"),
					(otpSchema.mobile = mobileNumber),
					(otpSchema.user_id = email),
					(otpSchema.otp = otp);

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

router.post("/userSignup", (req, res) => {
	const { name, mobileNumber, email, address, password, otp } = req.body;
	OTP.findOne({ page: "signup", mobile: mobileNumber, otp: otp, user_id: email }, function(err, result) {
		if (err) {
			console.log(err)
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
		user.status = "1";

		user.save(err => {
			if (err)
				return res.status(200).json({
					error: "User already exist with either same email id or mobile number."
				});

			
			// return res.status(200).json(data);
			res.status(200).json({
				status: "success"
			});
		});
	});
});

router.post('/userLogin', (req, res) => {
  const {
	mobileNumber, password,
  } = req.body

  User.findOne({
	mobile: mobileNumber, password: password, status: 1
  }, function (err, b2) {
	if (err || b2 == null) {
	  res.status(200).json({
		error: 'User account not found'
	  })
	}
	else {
	  let token = makeid(10)
	  User.findByIdAndUpdate(b2._id, { token: token }, function (e, b) {
		if (e || b == null) {
		  res.status(200).json({
			error: e.toString()
		  })
		}
		else {
		  res.status(200).json({
			status: 'success', token: token
		  })
		}
	  })
	}
  })
})

module.exports = router