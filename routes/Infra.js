const express = require("express");
const router = express.Router();
const config = require("../config.json");

//utils
const makeid = require("./utils/idGenerator");
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const doRequest = require("./utils/doRequest");
const getTypeClass = require("./utils/getTypeClass");

//services
const {
	getStatement,
	rechargeNow,
	transferThis,
	getTransactionCount,
	getBalance
} = require("../services/Blockchain.js");

const Infra = require("../models/Infra");
const Fee = require("../models/Fee");
const Bank = require("../models/Bank");
const OTP = require("../models/OTP");
const Profile = require("../models/Profile");
const Document = require("../models/Document");
const BankFee = require("../models/BankFee");

const mainFee = config.mainFee;
const defaultFee = config.defaultFee;
const defaultAmt = config.defaultAmt;

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

router.post('/getDashStats', function (req, res) {
	const {
	  token
	} = req.body;
  
	Infra.findOne({
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
		// ;
		// if (user.isAdmin) {
		  Bank.countDocuments({
		  }, function (err, bank) {
			if (err) {
			  res.status(402)
				.json({
				  error: err
				});
			} else {
			  res.status(200)
				.json({
				  totalBanks: bank
				});
			}
		  });
		// } else {
		//   Bank.countDocuments({
		//     "user_id": user_id
		//   }, function (err, bank) {
		//     if (err) {
		//       res.status(402)
		//         .json({
		//           error: err
		//         });
		//     } else {
		//       res.status(200)
		//         .json({
		//           totalBanks: bank
		//         });
		//     }
		//   });
		// }
  
  
	  }
	});
  });

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

router.post('/editBank', (req, res) => {
  let data = new Bank()
  const {
	bank_id,
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
		_id: otp_id,
		otp: otp
	  }, function (err, otpd) {
		if (err || !otpd) {
		  res.status(401).json({
			error: err
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
			data.address1 = address1
			data.state = state
			data.country = country
			data.bcode = bcode
			data.zip = zip
			data.ccode = ccode
			data.mobile = mobile
			data.username = mobile
			data.email = email
			data.user_id = user._id
			data.logo = logo
			data.contract = contract
			data.password = makeid(10)
			Bank.findByIdAndUpdate(bank_id, {
			  name: name,
			  address1: address1,
			  state: state,
			  zip: zip,
			  ccode: ccode,
			  bcode: bcode,
			  country: country,
			  mobile: mobile,
			  email: email,
			  logo: logo,
			  contract: contract
			}, (err) => {
			  if (err) return res.status(400).json({
				error: err
			  })
			  
			  let data2 = new Document()
			  data2.bank_id = bank_id
			  data2.contract = contract
			  data2.save((err,) => {
				
			  })
			  return res.status(200).json(data)
			})
		  }
		  else {
			res.status(200).json({
			  error: 'OTP Missmatch'
			})
		  }
		}
	  })
	}
	
  })
})

router.post('/getInfraHistory', function (req, res) {
  const {
	from,
	bank_id,
	token
  } = req.body
  
  Infra.findOne({
	token,
	status: 1
  }, function (err, f) {
	if (err || f == null) {
	  res.status(401).json({
		error: 'Unauthorized'
	  })
	}
	else {
	  
	  Bank.findOne({
		'_id': bank_id,
	  }, function (err, b) {
		const wallet = 'infra_' + from + '@' + b.name
		
		getStatement(wallet).then(function (result) {
		  res.status(200).json({
			status: 'success',
			history: result
		  })
		})
		
	  })
	}
  })
  
})

router.get('/getInfraOperationalBalance', function (req, res) {
  const {
	bank,
	token
  } = req.query
  Infra.findOne({
	token,
	status: 1
  }, function (e, b) {
	if (e || b == null) {
	  res.status(401).json({
		error: 'Unauthorized'
	  })
	}
	else {
	  Bank.findOne({
		'_id': bank
	  }, function (err, ba) {
		if (err || ba == null) {
		  res.status(404).json({
			error: 'Not found'
		  })
		}
		else {
		  const wallet_id = 'infra_operational@' + ba.name
		  
		  getBalance(wallet_id).then(function (result) {
			res.status(200).json({
			  status: 'success',
			  balance: result
			})
		  })
		  
		}
	  })
	}
  })
})

router.get('/getInfraMasterBalance', function (req, res) {
  const {
	bank,
	token
  } = req.query
  Infra.findOne({
	token,
	status: 1
  }, function (e, b) {
	if (e || b == null) {
	  res.status(401).json({
		error: 'Unauthorized'
	  })
	}
	else {
	  Bank.findOne({
		'_id': bank
	  }, function (err, ba) {
		if (err) {
		  res.status(401).json({
			error: 'Unauthorized'
		  })
		}
		else {
		  const wallet_id = 'infra_master@' + ba.name
		  
		  getBalance(wallet_id).then(function (result) {
			res.status(200).json({
			  status: 'success',
			  balance: result
			})
		  })
		}
	  })
	}
	
  })
  
})

router.post('/getPermission', function (req, res) {
	const {
	 token
	} = req.body;
  
	Infra.findOne({
	  token,
	  status : 1
	}, function (err, user) {
  
	  if (err) {
		res.status(500)
		  .json({
			error: 'Internal error please try again'
		  });
	  } else if (user == null) {
		res.status(401)
		  .json({
			error: 'Incorrect username or password'
		  });
	  } else {
  
		if (user.profile_id && user.profile_id != '') {
		  Profile.findOne({
			"_id": user.profile_id
		  }, function (err, profile) {
  
			var p = JSON.parse(profile.permissions);
			res.status(200).json({
			  token: token,
			  permissions: p,
			  name: user.name,
			  isAdmin: user.isAdmin,
			  initial_setup: user.initial_setup,
			});
		  })
		} else {
		  if (user.isAdmin) {
			res.status(200).json({
			  token: token,
			  permissions: 'all',
			  name: user.name,
			  isAdmin: user.isAdmin,
			  initial_setup: user.initial_setup,
			});
		  } else {
			res.status(200).json({
			  token: token,
			  permissions: '',
			  name: user.name,
			  isAdmin: user.isAdmin,
			  initial_setup: user.initial_setup,
			});
		  }
  
		}
  
	  }
	});
  });

  router.post("/addProfile", (req, res) => {
	let data = new Profile();
	const { pro_name, pro_description, create_bank, edit_bank, create_fee, token } = req.body;
	Infra.findOne(
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
				const user_id = user._id;

				data.name = pro_name;
				data.description = pro_description;
				var c = {
					create_bank,
					edit_bank,
					create_fee
				};
				data.permissions = JSON.stringify(c);
				data.user_id = user_id;

				data.save(err => {
					if (err)
						return res.json({
							error: err.toString()
						});

					return res.status(200).json({
						success: "True"
					});
				});
			}
		}
	);
});

router.post("/editProfile", (req, res) => {
	let data = new Profile();
	const {
		pro_name,
		pro_description,
		create_bank,
		edit_bank,
		create_fee,
		profile_id,
		token
	} = req.body;
	Infra.findOne(
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
				var _id = profile_id;
				var c = {
					create_bank,
					edit_bank,
					create_fee
				};
				let c2 = JSON.stringify(c);
				Profile.findOneAndUpdate(
					{
						_id: _id
					},
					{
						name: pro_name,
						description: pro_description,
						permissions: c2
					},
					(err, d) => {
						if (err)
							return res.status(400).json({
								error: err
							});
						return res.status(200).json({
							success: true
						});
					}
				);
			}
		}
	);
});

router.post("/addInfraUser", (req, res) => {
	let data = new Infra();
	const { name, email, mobile, username, password, profile_id, logo, token } = req.body;
	Infra.findOne(
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
				data.name = name;
				data.email = email;
				data.mobile = mobile;
				data.username = username;
				data.password = password;
				data.profile_id = profile_id;
				data.logo = logo;
				data.save(err => {
					if (err)
						return res.json({
							error: "Email / Username/ Mobile already exist!"
						});
					let content =
						"<p>Your have been added as Infra in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
						config.mainIP +
						"/'>http://" +
						config.mainIP +
						"/</a></p><p><p>Your username: " +
						username +
						"</p><p>Your password: " +
						password +
						"</p>";
					sendMail(content, "Infra Account Created", email);
					let content2 =
						"Your have been added as Infra in E-Wallet application Login URL: http://" +
						config.mainIP +
						" Your username: " +
						username +
						" Your password: " +
						password;
					sendSMS(content2, mobile);
					return res.status(200).json({
						success: "True"
					});
				});
			}
		}
	);
});

router.post("/editInfraUser", (req, res) => {
	const { name, email, mobile, username, password, profile_id, logo, user_id, token } = req.body;
	Infra.findOne(
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
				var _id = user_id;
				Infra.findOneAndUpdate(
					{
						_id: _id
					},
					{
						name: name,
						email: email,
						mobile: mobile,
						username: username,
						password: password,
						profile_id: profile_id,
						logo: logo
					},
					(err, d) => {
						if (err)
							return res.status(400).json({
								error: err
							});
						return res.status(200).json({
							success: true
						});
					}
				);
			}
		}
	);
});

router.get("/infraTopup", (req, res) => {
	const { amount, bank } = req.query;
	Infra.findOne(
		{
			name: "Infra Admin"
		},
		function(err, infra) {
			const infra_email = infra.email;
			const infra_mobile = infra.mobile;

			if (err) return res.status(401);
			Bank.findOne(
				{
					name: bank
				},
				function(err, ba) {
					const bank_email = ba.email;
					const bank_mobile = ba.mobile;
					if (err) return res.status(401);

					let data = {};

					let fee = (amount * mainFee) / 100;
					var temp = (fee * defaultFee) / 100;
					let fee3 = temp + defaultAmt;

					data.amount = (amount - fee).toString();
					data.from = "recharge";
					data.to = ("testuser@" + ba.name).toString();
					const bank = ba.name;

					getTransactionCount(data.to).then(function(count) {
						count = Number(count) + 1;
						Fee.findOne(
							{
								bank_id: ba._id,
								trans_type: "Wallet to Wallet",
								status: 1,
								active: "Active"
							},
							function(err, fe) {
								if (!fe || fe == null) {
									res.status(200).json({
										status: "Transaction cannot be done at this time"
									});
								} else {
									var ranges = JSON.parse(fe.ranges);
									if (ranges.length > 0) {
										ranges.map(function(v) {
											if (
												Number(count) >= Number(v.trans_from) &&
												Number(count) <= Number(v.trans_to)
											) {
												var temp = (fee * Number(v.percentage)) / 100;
												fee3 = temp + Number(v.fixed_amount);
											}
										});
									}
									rechargeNow([data]).then(function(result) {
										let data2 = {};
										data2.amount = fee.toString();
										data2.from = "testuser@" + bank;
										data2.to = "operational@" + bank;
										data2.note = "commission";
										data2.email2 = bank_email;
										data2.mobile2 = bank_mobile;

										let data3 = {};
										data3.amount = fee3.toString();
										data3.from = "operational@" + bank;
										data3.to = "infra_operational@" + bank;
										data3.note = "operational commission";
										data3.email1 = bank_email;
										data3.email2 = infra_email;
										data3.mobile1 = bank_mobile;
										data3.mobile2 = infra_mobile;

										// ;
										// ;
										// ;
										// transferNow([data, data2, data3]).then(function(result) {

										// });
										transferThis(data2, data3).then(function(result) {});
										res.status(200).json({
											status: result + " Transfer initiated and will be notified via email and sms"
										});
									});
								}

								// res.status(200).json({
								//   status: fee3
								// });
							}
						);
					});

					// rechargeNow([data]).then(function (result) {

					//   let data2 = {};
					//   data2.amount = fee.toString();
					//   data2.from = "testuser@" + ba.name;
					//   data2.to = "operational@" + ba.name;
					//   data2.note = "recharge commission";
					//   data2.email2 = bank_email;
					//   data2.mobile2 = bank_mobile;

					//   let data3 = {};
					//   data3.amount = fee3.toString();
					//   data3.from = "operational@" + ba.name;
					//   data3.to = "infra_operational@" + ba.name;
					//   data3.note = "commission";
					//   data3.email1 = bank_email;
					//   data3.email2 = infra_email;
					//   data3.mobile1 = bank_mobile;
					//   data3.mobile2 = infra_mobile;

					//   // transferNow([data2, data3]).then(function(result) {

					//   // });
					//   transferThis(data2, data3).then(function (result) {
					//     ;
					//   });

					//   res.status(200).json({
					//     status: result + " Transfer initiated and will be notified via email and sms"
					//   });
					// });
				}
			);
		}
	);
});

router.post("/editBankRule", (req, res) => {
	const { name, trans_type, trans_from, trans_to, active, ranges, token, rule_id } = req.body;
	Infra.findOne(
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
				Bank.findOne(
					{
						_id: bank_id
					},
					function(err, bank) {
						if (err) {
							res.status(401).json({
								error: err
							});
						} else {
							// Fee.findOne({
							//   "trans_type": trans_type,
							//   "bank_id" : bank_id
							// }, function (err, fee) {

							// });
							var edited = {
								name: name,
								trans_type: trans_type,
								active: active,
								trans_from: trans_from,
								trans_to: trans_to,
								ranges: JSON.stringify(ranges)
							};
							BankFee.findByIdAndUpdate(
								{
									_id: rule_id
								},
								edited,
								err => {
									if (err)
										return res.status(400).json({
											error: err
										});
									let content = "<p>Rule " + name + " has been updated, check it out</p>";
									let result = sendMail(content, "Rule Updated", bank.email);
									let content2 = "Rule " + name + " has been updated, check it out";
									sendSMS(content2, bank.mobile);
									res.status(200).json({
										status: true
									});
								}
							);
						}
					}
				);
			}
		}
	);
});

router.post("/getBank", function(req, res) {
	//res.send("hi");
	const { token, bank_id } = req.body;
	Infra.findOne(
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
				Bank.findOne(
					{
						_id: bank_id
					},
					function(err, bank) {
						if (err) {
							res.status(404).json({
								error: err
							});
						} else {
							res.status(200).json({
								banks: bank
							});
						}
					}
				);
			}
		}
	);
});

router.post("/getRules", function(req, res) {
	//res.send("hi");
	const { token, bank_id } = req.body;
	Infra.findOne(
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
				const user_id = user._id;
				// if (user.isAdmin) {
				Fee.find(
					{
						bank_id
					},
					function(err, rules) {
						if (err) {
							res.status(404).json({
								error: err
							});
						} else {
							res.status(200).json({
								rules: rules
							});
						}
					}
				);
				// } else {
				//   Fee.find({
				//     user_id,
				//     bank_id
				//   }, function (err, rules) {
				//     if (err) {
				//       res.status(404)
				//         .json({
				//           error: err
				//         });
				//     } else {
				//       res.status(200)
				//         .json({
				//           rules: rules
				//         });
				//     }
				//   });
				// }
			}
		}
	);
});

router.post("/getRule", function(req, res) {
	//res.send("hi");
	const { token, rule_id } = req.body;
	Infra.findOne(
		{
			// token,
			status: 1
		},
		function(err, user) {
			if (err || user == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				const user_id = user._id;

				Fee.findOne(
					{
						_id: rule_id
					},
					function(err, rules) {
						if (err) {
							res.status(404).json({
								error: err
							});
						} else {
							res.status(200).json({
								rules: rules
							});
						}
					}
				);
			}
		}
	);
});

// router.post('/getDocs', function (req, res) {
//   //res.send("hi");
//   const {
//     token,
//     bank_id
//   } = req.body;
//   Infra.findOne({
//     token
//   }, function (err, user) {
//     if (err) {
//       res.status(401)
//         .json({
//           error: err
//         });
//     } else {
//       const user_id = user._id;
//       Document.find({
//         bank_id
//       }, function (err, rules) {
//         ;
//         if (err) {
//           res.status(404)
//             .json({
//               error: err
//             });
//         } else {
//           res.status(200)
//             .json({
//               docs: rules
//             });
//         }
//       });

//     }
//   });
// });

router.post("/bankStatus", function(req, res) {
	//res.send("hi");
	const { token, status, bank_id } = req.body;

	Infra.findOne(
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
				Bank.findByIdAndUpdate(
					bank_id,
					{
						status: status
					},
					err => {
						if (err)
							return res.status(400).json({
								error: err
							});
						res.status(200).json({
							status: true
						});
					}
				);
			}
		}
	);
});

router.post("/getBanks", function(req, res) {
	//res.send("hi");
	const { token } = req.body;
	Infra.findOne(
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
				const user_id = user._id;
				// if (user.isAdmin) {
				Bank.find({}, function(err, bank) {
					if (err) {
						res.status(404).json({
							error: err
						});
					} else {
						res.status(200).json({
							banks: bank
						});
					}
				});
				// } else {
				//   Bank.find({
				//     user_id
				//   }, function (err, bank) {
				//     if (err) {
				//       res.status(404)
				//         .json({
				//           error: err
				//         });
				//     } else {
				//       res.status(200)
				//         .json({
				//           banks: bank
				//         });
				//     }
				//   });
				// }
			}
		}
	);
});

router.post("/getRoles", function(req, res) {
	//res.send("hi");
	const { token } = req.body;
	Infra.findOne(
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
				const user_id = user._id;
				Profile.find(
					{
						user_id
					},
					function(err, bank) {
						if (err) {
							res.status(404).json({
								error: err
							});
						} else {
							res.status(200).json({
								roles: bank
							});
						}
					}
				);
			}
		}
	);
});

router.post("/getInfraUsers", function(req, res) {
	//res.send("hi");
	const { token } = req.body;
	Infra.findOne(
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
				const user_id = user._id;
				Infra.find({}, function(err, bank) {
					if (err) {
						res.status(404).json({
							error: err
						});
					} else {
						res.status(200).json({
							users: bank
						});
					}
				});
			}
		}
	);
});

router.post("/getProfile", function(req, res) {
	//res.send("hi");
	const { token } = req.body;
	Infra.findOne(
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
					users: user
				});
			}
		}
	);
});

router.post("/editInfraProfile", function(req, res) {
	const { name, username, email, mobile, password, ccode, token } = req.body;
	Infra.findOne(
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
				let upd = {};
				if (password == "" || password == undefined || password == null) {
					upd = {
						name: name,
						email: email,
						mobile: mobile,
						username: username,
						ccode: ccode
					};
				} else {
					upd = {
						name: name,
						email: email,
						mobile: mobile,
						password: password,
						username: username,
						ccode: ccode
					};
				}

				Infra.findByIdAndUpdate(user._id, upd, err => {
					if (err)
						return res.status(400).json({
							error: err
						});
					res.status(200).json({
						success: true
					});
				});
			}
		}
	);
});

router.post("/generateOTP", function(req, res) {
	let data = new OTP();
	const { token, username, page, name, email, mobile, bcode } = req.body;
	Infra.findOne(
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
				data.user_id = user._id;
				data.otp = makeotp(6);
				data.page = page;
				if (page == "editBank") {
					Bank.findOne(
						{
							username
						},
						function(err, bank) {
							data.mobile = bank.mobile;
							data.save((err, ot) => {
								if (err)
									return res.json({
										error: err
									});

								let content = "Your OTP to edit Bank is " + data.otp;
								sendSMS(content, bank.mobile);
								sendMail(content, "OTP", bank.email);

								res.status(200).json({
									id: ot._id
								});
							});
						}
					);
				} else {
					Bank.find(
						{ $or: [{ name: name }, { email: email }, { mobile: mobile }, { bcode: bcode }] },
						function(err, bank) {
							if (bank == null || bank == undefined || bank.length == 0) {
								data.mobile = user.mobile;

								data.save((err, ot) => {
									if (err)
										return res.json({
											error: err
										});

									let content = "Your OTP to add Bank is " + data.otp;
									sendSMS(content, user.mobile);
									sendMail(content, "OTP", user.email);

									res.status(200).json({
										id: ot._id
									});
								});
							} else {
								res.status(400).json({
									error: "Duplicate Entry"
								});
							}
						}
					);
				}
			}
		}
	);
});

router.post("/transferMoney", function(req, res) {
	const { from, to, note, amount, auth, token } = req.body;

	if (auth == "infra") {
		Infra.findOne(
			{
				token,
				status: 1
			},
			function(err, f) {
				if (err || f == null) {
					res.status(401).json({
						error: "Unauthorized"
					});
				} else {
					const infra_email = f.email;
					const infra_mobile = f.mobile;

					var c = to.split("@");
					const bank = c[1];
					Bank.findOne(
						{
							name: bank
						},
						function(err, b) {
							const bank_email = b.email;
							const bank_mobile = b.mobile;
							var total_trans = b.total_trans ? b.total_trans : 0;
							var temp = (amount * mainFee) / 100;
							var fee = temp;
							//var oamount = amount - fee;
							var oamount = amount;

							var fee3 = 0;

							//    getTransactionCount(from).then(function (count) {
							//      count = Number(count)+1;
							//      Fee.findOne({
							//       bank_id: b._id,
							//       trans_type: "Wallet to Wallet",
							//       status: 1
							// }, function (err, fe) {

							// if (!fe || fe == null) {
							//   var temp = fee * defaultFee / 100;
							//   fee3 = temp + defaultAmt;
							// } else {
							//   var ranges = JSON.parse(fe.ranges);
							//   if(ranges.length > 0){

							//   ranges.map(function(v) {

							//     if(Number(count) >= Number(v.trans_from) && Number(count) <= Number(v.trans_to)){
							//       var temp = fee * Number(v.percentage) / 100;
							//       fee3 = temp + Number(v.fixed_amount);
							//       ;
							//     }

							//   });
							// }else{
							//   var temp = fee * defaultFee / 100;
							//   fee3 = temp + defaultAmt;
							// }
							// }

							// res.status(200).json({
							//   status: fee3
							// });

							let data = {};
							data.amount = oamount.toString();
							data.from = from;
							data.to = to;
							data.note = note;
							data.email1 = infra_email;
							data.email2 = infra_email;
							data.mobile1 = infra_mobile;
							data.mobile2 = infra_mobile;

							// let data2 = {};
							// data2.amount = fee.toString();
							// data2.from = from;
							// data2.to = "operational@" + bank;
							// data2.note = "commission";
							// data2.email1 = infra_email;
							// data2.email2 = bank_email;
							// data2.mobile1 = infra_mobile;
							// data2.mobile2 = bank_mobile;

							// let data3 = {};
							// data3.amount = fee3.toString();
							// data3.from = "operational@" + bank;
							// data3.to = "infra_operational@" + bank;
							// data3.note = "operational commission";
							// data3.email1 = bank_email;
							// data3.email2 = infra_email;
							// data3.mobile1 = bank_mobile;
							// data3.mobile2 = infra_mobile;

							// ;
							// ;
							// ;
							// transferNow([data, data2, data3]).then(function(result) {

							// });
							transferThis(data).then(function(result) {});
							res.status(200).json({
								status: "success"
							});

							// });

							// });
						}
					);
				}
			}
		);
	} else {
		res.status(200).json({
			status: null
		});
	}
});

router.post("/checkFee", function(req, res) {
	const { from, to, amount, auth, token } = req.body;

	if (auth == "infra") {
		Infra.findOne(
			{
				token,
				status: 1
			},
			function(err, f) {
				if (err || f == null) {
					res.status(401).json({
						error: "Unauthorized"
					});
				} else {
					var temp = (amount * mainFee) / 100;
					var fee = temp;
					res.status(200).json({
						fee: fee
					});
				}
			}
		);
	} else {
		res.status(200).json({
			fee: null
		});
	}
});

module.exports = router