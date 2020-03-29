const express = require('express')
const router = express.Router()
const Bank = require('../models/Bank')
const makeid = require('./utils/idGenerator')
const wallet = require('../services/Wallet')
const Branch = require('../models/Branch')
const getBalance = require('./utils/getBalance')
const getTypeClass = require('./utils/getTypeClass')
const BankUser = require('../models/BankUser')

router.post('/bankLogin', function (req, res) {
  const {
	username,
	password
  } = req.body
  Bank.findOne({
	username,
	password
  }, function (err, bank) {
	
	if (err) {
	  res.status(500).json({
		error: 'Internal error please try again'
	  })
	}
	else if (!bank) {
	  res.status(401).json({
		error: 'Incorrect username or password'
	  })
	}
	else if (bank.status === -1) {
	  res.status(401).json({
		error: 'Your account has been blocked, pls contact the admin!'
	  })
	}
	else {
	  let token = makeid(10)
	  Bank.findByIdAndUpdate(bank._id, {
		token: token
	  }, (err) => {
		if (err) return res.status(400).json({
		  error: err
		})
		res.status(200).json({
		  token: token,
		  name: bank.name,
		  initial_setup: bank.initial_setup,
		  username: bank.username,
		  mobile: bank.mobile,
		  status: bank.status,
		  contract: bank.contract,
		  logo: bank.logo,
		  id: bank._id
		})
	  })
	  
	}
  })
})

router.post('/bankSetupUpdate', function (req, res) {
  const {
	username,
	password,
	token
  } = req.body
  Bank.findOne({
	token
  }, function (err, bank) {
	if (err || bank == null) {
	  res.status(500).json({
		error: err.toString()
	  })
	}
	else if (!bank) {
	  res.status(401).json({
		error: 'Incorrect username or password'
	  })
	}
	else {
	  Bank.findByIdAndUpdate(bank._id, {
		username: username,
		password: password,
		initial_setup: true
	  }, (err) => {
		if (err) return res.status(400).json({
		  error: err
		})
		res.status(200).json({
		  success: 'Updated successfully'
		})
	  })
	}
  })
})

router.post('/bankActivate', function (req, res) {
  const {
	token
  } = req.body
  Bank.findOne({
	token
  }, function (err, bank) {
	if (err) {
	  res.status(500).json({
		error: 'Internal error please try again'
	  })
	}
	else if (!bank) {
	  res.status(401).json({
		error: 'Account not found'
	  })
	}
	else {
	  Bank.findByIdAndUpdate(bank._id, {
		status: 1
	  }, (err) => {
		if (err) return res.status(400).json({
		  error: err
		})
		
		wallet.createWallet(['testuser@' + bank.name, 'operational@' + bank.name, 'escrow@' + bank.name, 'master@' + bank.name, 'infra_operational@' + bank.name, 'infra_master@' + bank.name], bank._id, bank.user_id).then(function (result) {
		  res.status(200).json({
			status: 'activated',
			walletStatus: result
		  })
		})
		
	  })
	  
	}
  })
})

router.post('/getBankDashStats', function (req, res) {
  const {
	token
  } = req.body
  Bank.findOne({
	token,
	status: 1
  }, function (err, user) {
	if (err || user == null) {
	  res.status(401).json({
		error: 'Unauthorized'
	  })
	}
	else {
	  
	  const user_id = user._id
	  Branch.countDocuments({
		bank_id: user_id
	  }, function (err, branch) {
		if (err) {
		  res.status(402).json({
			error: err
		  })
		}
		else {
		  res.status(200).json({
			totalBranches: branch
		  })
		}
	  })
	}
  })
})

router.get('/getBankOperationalBalance', function (req, res) {
  const {
	bank
  } = req.query
  
  Bank.findOne({
	token: bank,
	status: 1
  }, function (err, ba) {
	
	if (err || ba == null) {
	  res.status(401).json({
		error: 'Unauthorized'
	  })
	}
	else {
	  const wallet_id = 'operational@' + ba.name
	  
	  getBalance(wallet_id).then(function (result) {
		res.status(200).json({
		  status: 'success',
		  balance: result
		})
	  })
	  
	}
  })
})

router.get('/getBalance', (req, res) => {
  const {
	token,
	wallet_id,
	type
  } = req.query
  const typeClass = getTypeClass(type)
  typeClass.findOne({
	token,
	status: 1
  }, function (err, bank) {
	if (err || bank == null) {
	  res.status(401).json({
		error: 'Unauthorized'
	  })
	}
	else {
	  getBalance(wallet_id).then(function (result) {
		res.status(200).json({
		  status: 'success',
		  balance: result
		})
	  })
	}
  })
  
})

router.post('/getBranches', function (req, res) {
  
  const {
	token
  } = req.body;
  Bank.findOne({
	token,
	status:1
  }, function (err, bank) {
	if (err || bank == null) {
	  res.status(401)
	  .json({
		error: "Unauthorized"
	  });
	} else {
	  const bank_id = bank._id;
	  // if (user.isAdmin) {
	  Branch.find({bank_id : bank_id}, function (err, branch) {
		if (err) {
		  res.status(404)
		  .json({
			error: err
		  });
		} else {
		  
		  
		  res.status(200)
		  .json({
			branches: branch
		  });
		  
		}
	  });
	  
	}
  });
});

router.post('/getBankUsers', function (req, res) {
  //res.send("hi");
  const {
	token
  } = req.body;
  Bank.findOne({
	token,
	status:1
  }, function (err, user) {
	if (err || user == null) {
	  res.status(401)
	  .json({
		error: "Unauthorized"
	  });
	} else {
	  const user_id = user._id;
	  BankUser.find({
		bank_id : user_id
	  }, function (err, bank) {
		if (err) {
		  res.status(404)
		  .json({
			error: err
		  });
		} else {
		  res.status(200)
		  .json({
			users: bank
		  });
		}
	  });
	  
	}
  });
});
module.exports = router