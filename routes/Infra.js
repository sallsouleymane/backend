const express = require('express')
const router = express.Router()
const Infra = require('../models/Infra')
const makeid = require('./utils/idGenerator')
const Bank = require('../models/Bank')
const Profile = require('../models/Profile')
const sendSMS = require('./utils/sendSMS')
const sendMail = require('./utils/sendMail')
const config = require('../config.json')
const OTP = require('../models/OTP')
const Document = require('../models/Document');

router.post('/login', function (req, res) {
  const {
	username, password
  } = req.body
  Infra.findOne({
	username: { $regex: new RegExp(username, 'i') }, password
  }, function (err, user) {
	if (err) {
	  res.status(500).json({
		error: 'Internal error please try again'
	  })
	}
	else if (!user) {
	  res.status(401).json({
		error: 'Incorrect username or password'
	  })
	}
	else {
	  let token = makeid(10)
	  Infra.findByIdAndUpdate(user._id, {
		token: token
	  }, (err) => {
		if (err) return res.status(400).json({
		  error: err
		})
		if (user.profile_id && user.profile_id !== '') {
		  Profile.findOne({
			'_id': user.profile_id
		  }, function (err, profile) {
			res.status(200).json({
			  token: token,
			  permissions: profile.permissions,
			  name: user.name,
			  isAdmin: user.isAdmin,
			  initial_setup: user.initial_setup,
			})
		  })
		}
		else {
		  if (user.isAdmin) {
			res.status(200).json({
			  token: token,
			  permissions: 'all',
			  name: user.name,
			  isAdmin: user.isAdmin,
			  initial_setup: user.initial_setup,
			})
		  }
		  else {
			res.status(200).json({
			  token: token, permissions: '', name: user.name, isAdmin: user.isAdmin, initial_setup: user.initial_setup,
			})
		  }
		}
	  })
	}
  })
})

router.post('/getBanks', function (req, res) {
  const {
	token
  } = req.body
  Infra.findOne({
	token,
	status: 1
  }, function (err, user) {
	if (err || user == null) {
	  res.status(401).json({
		error: 'Unauthorized'
	  })
	}
	else {
	  Bank.find({}, function (err, bank) {
		if (err) {
		  res.status(404).json({
			error: err
		  })
		}
		else {
		  res.status(200).json({
			banks: bank
		  })
		}
	  })
	}
  })
})

router.post('/setupUpdate', function (req, res) {
  let data = new Infra()
  const {
	username,
	password,
	email,
	mobile,
	ccode
  } = req.body
  
  data.name = 'Infra Admin'
  data.username = username
  
  data.password = password
  data.mobile = mobile
  data.email = email
  data.ccode = ccode
  data.isAdmin = true
  
  data.save((err,) => {
	if (err) return res.json({
	  error: err.toString()
	})
	let content = '<p>Your Infra account is activated in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href=\'http://' + config.mainIP + '\'>http://' + config.mainIP + '</a></p><p><p>Your username: ' + data.username + '</p><p>Your password: ' + data.password + '</p>'
	sendMail(content, 'Infra Account Activated', data.email)
	let content2 = 'Your Infra account is activated in E-Wallet application. Login URL: http://' + config.mainIP + ' Your username: ' + data.username + ' Your password: ' + data.password
	sendSMS(content2, mobile)
	res.status(200).json({
	  success: true
	})
  })
  
})

router.get('/checkInfra', function (req, res) {
  
  Infra.countDocuments({}, function (err, c) {
	if (err || c == null) {
	  res.status(401).json({
		error: 'Unauthorized'
	  })
	}
	else {
	  
	  res.status(200).json({
		infras: c
	  })
	}
  })
  
})

router.post('/addBank', (req, res) => {
  let data = new Bank()
  const {
	name,
	bcode,
	address1,
	state,
	zip,
	country,
	ccode,
	mobile,
	email,
	token,
	logo,
	contract,
	otp_id,
	otp
  } = req.body
  Infra.findOne({
	token,
	status: 1
  }, function (err, user) {
	if (err || user == null) {
	  res.status(401).json({
		error: 'Unauthorized'
	  })
	}
	else {
	  // const user_id = user._id;
	  OTP.findOne({
		'_id': otp_id,
		otp: otp
	  }, function (err, otpd) {
		if (err) {
		  res.status(401).json({
			error: err
		  })
		}
		else {
		  if (!otpd) {
			res.status(401).json({
			  error: 'OTP Missmatch'
			})
		  }
		  else {
			if (otpd.otp === otp) {
			  
			  if (name === '' || address1 === '' || state === '' || mobile === '' || email === '') {
				return res.status(402).json({
				  error: 'Please provide valid inputs'
				})
			  }
			  
			  data.name = name
			  data.bcode = bcode
			  data.address1 = address1
			  data.state = state
			  data.country = country
			  data.zip = zip
			  data.ccode = ccode
			  data.mobile = mobile
			  data.username = mobile
			  data.email = email
			  data.user_id = user._id
			  data.logo = logo
			  data.contract = contract
			  data.password = makeid(10)
			  
			  data.save((err, d) => {
				if (err) return res.json({
				  error: 'Duplicate entry!'
				})
				
				let data2 = new Document()
				data2.bank_id = d._id
				data2.contract = contract
				data2.save((err,) => {
				
				})
				
				let content = '<p>Your bank is added in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href=\'http://' + config.mainIP + '/bank\'>http://' + config.mainIP + '/bank</a></p><p><p>Your username: ' + data.username + '</p><p>Your password: ' + data.password + '</p>'
				sendMail(content, 'Bank Account Created', email)
				let content2 = 'Your bank is added in E-Wallet application Login URL: http://' + config.mainIP + '/bank Your username: ' + data.username + ' Your password: ' + data.password
				sendSMS(content2, mobile)
				
				return res.status(200).json(data)
			  })
			}
			else {
			  res.status(200).json({
				error: 'OTP Missmatch'
			  })
			}
		  }
		}
	  })
	}
	
  })
})

module.exports = router