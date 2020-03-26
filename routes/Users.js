const express = require('express')
const router = express.Router()
const User = require('../models/User')
const sendSMS = require('./utils/sendSMS')
const sendMail = require('./utils/sendMail')

router.post('/userSignup', (req, res) => {
  let data = new User()
  const {
	name, mobileNumber, email, address, password,
  } = req.body

  data.name = name
  data.mobile = mobileNumber
  data.email = email
  data.address = address
  data.password = password
  let otp = makeotp(6)
  data.otp = otp

  data.save((err, d) => {
	if (err) return res.status(200).json({
	  error: err.toString()
	})

	let content = '<p>Your OTP to verify your mobile number is ' + otp + '</p>'
	sendMail(content, 'OTP', email)
	let content2 = 'Your OTP to verify your mobile number is ' + otp
	sendSMS(content2, mobileNumber)
	// return res.status(200).json(data);
	res.status(200).json({
	  status: 'success'
	})
  })
})

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