const express = require('express')
const router = express.Router()
const Infra = require('../models/Infra')
const makeid = require('./utils/idGenerator')

router.post('/', function (req, res) {
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

			var p = JSON.parse(profile.permissions)
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

module.exports = router