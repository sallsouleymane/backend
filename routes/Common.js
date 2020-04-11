const express = require("express");
const router = express.Router();
const db = require("../dbConfig");

//utils
const makeid = require("./utils/idGenerator");
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const getTypeClass = require("./utils/getTypeClass");
const makeotp = require("./utils/makeotp");

//services
const {
	rechargeNow,
	getChildStatements,
	getBalance
} = require("../services/Blockchain.js");

const Infra = require("../models/Infra");
const Fee = require("../models/Fee");
const Bank = require("../models/Bank");
const OTP = require("../models/OTP");
const Document = require("../models/Document");
const Branch = require("../models/Branch");
const BankUser = require("../models/BankUser");
const Cashier = require("../models/Cashier");
const CashierSend = require("../models/CashierSend");
const CashierPending = require("../models/CashierPending");
const CashierClaim = require("../models/CashierClaim");
const BranchSend = require("../models/BranchSend");
const BranchClaim = require("../models/BranchClaim");
const CurrencyModel = require("../models/Currency");

router.get("/testGet", function(req, res) {
	return res.status(200).json({
		status: "Internal error please try again"
	});
});

router.get("/getBalance", (req, res) => {
	const { token, wallet_id, type } = req.query;
	console.log(type);
	const typeClass = getTypeClass(type);
	console.log(typeClass)
	typeClass.findOne(
		{
			token,
			status: 1
		},
		function(err, result) {
			if (err || result == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				getBalance(wallet_id).then(function(result) {
					res.status(200).json({
						status: "success",
						balance: result
					});
				});
			}
		}
	);
});

router.get("/getWalletBalance", function(req, res) {
	const { bank, type, page, token, wallet_id } = req.query;

	if (wallet_id != null && wallet_id != undefined && wallet_id != "") {
		getBalance(wallet_id).then(function(result) {
			res.status(200).json({
				status: "success",
				balance: result
			});
		});
	} else {
		const typeClass = getTypeClass(type);
		typeClass.findOne(
			{
				token,
				status: 1
			},
			function(e, b) {
				if (e || b == null) {
					res.status(401).json({
						error: "Unauthorized"
					});
				} else {
					Bank.findOne(
						{
							name: bank
						},
						function(err, ba) {
							if (err || ba == null) {
								res.status(404).json({
									error: "Not found"
								});
							} else {
								let wallet_id = page + "@" + ba.name;
								if (type == "branch") {
									wallet_id = b.bcode + "_" + page + "@" + ba.name;
								}

								getBalance(wallet_id).then(function(result) {
									res.status(200).json({
										status: "success",
										balance: result
									});
								});
							}
						}
					);
				}
			}
		);
	}
});

router.post("/getOne", function(req, res) {
	const { page, type, page_id, token } = req.body;

	const pageClass = getTypeClass(page);
	const typeClass = getTypeClass(type);

	typeClass.findOne(
		{
			token,
			status: 1
		},
		function(err, t1) {
			if (err || t1 == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				if (page === type) {
					res.status(200).json({
						row: t1
					});
				} else {
					let where;
					where = { _id: page_id };

					pageClass.findOne(where, function(err, data) {
						if (err) {
							res.status(404).json({
								error: err
							});
						} else {
							res.status(200).json({
								row: data
							});
						}
					});
				}
			}
		}
	);
});

router.post("/getAll", function(req, res) {
	const { page, type, where, token } = req.body;

	const pageClass = getTypeClass(page);
	const typeClass = getTypeClass(type);

	typeClass.findOne(
		{
			token,
			status: 1
		},
		function(err, t1) {
			if (err || t1 == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				const type_id = t1._id;

				let whereData = where;
				if (where === undefined || where === "") {
					if (type === "bank") {
						whereData = { bank_id: type_id };
					}
				}
				pageClass.find(whereData, function(err, data) {
					if (err) {
						res.status(404).json({
							error: err
						});
					} else {
						res.status(200).json({
							rows: data
						});
					}
				});
			}
		}
	);
});

router.post("/editCashier", (req, res) => {
	const {
		cashier_id,
		name,
		bcode,
		working_from,
		working_to,
		per_trans_amt,
		max_trans_amt,
		max_trans_count	} = req.body;
	Cashier.findByIdAndUpdate(
		cashier_id,
		{
			name: name,
			working_from: working_from,
			working_to: working_to,
			per_trans_amt: per_trans_amt,
			bcode: bcode,
			max_trans_count: max_trans_count,
			max_trans_amt: max_trans_amt
		},
		err => {
			if (err)
				return res.status(400).json({
					error: err
				});

			return res.status(200).json(true);
		}
	);
});

router.post("/editBankBank", (req, res) => {
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
		logo,
		contract,
		otp_id,
		otp,
		working_from,
		working_to
	} = req.body;

	// const user_id = user._id;
	OTP.findOne(
		{
			_id: otp_id,
			otp: otp
		},
		function(err, otpd) {
			if (err || otpd == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				if (otpd.otp == otp) {
					if (name == "" || address1 == "" || state == "" || mobile == "" || email == "") {
						return res.status(402).json({
							error: "Please provide valid inputs"
						});
					}

					Bank.findByIdAndUpdate(
						bank_id,
						{
							name: name,
							bcode: bcode,
							address1: address1,
							state: state,
							zip: zip,
							ccode: ccode,
							bcode: bcode,
							mobile: mobile,
							country: country,
							email: email,
							logo: logo,
							working_from: working_from,
							working_to: working_to,
							contract: contract
						},
						err => {
							if (err)
								return res.status(400).json({
									error: err
								});

							let data2 = new Document();
							data2.bank_id = bank_id;
							data2.contract = contract;
							data2.save(() => {});
							return res.status(200).json({
								success: true
							});
						}
					);
					// data.save((err, ) => {
					//   if (err) return res.json({
					//     error: "Duplicate entry!"
					//   });

					// let content = "<p>Your bank is added in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://"+config.mainIP+"/bank'>http://"+config.mainIP+"/bank</a></p><p><p>Your username: " + data.username + "</p><p>Your password: " + data.password + "</p>";
					// sendMail(content, "Bank Account Created", email);

					//return res.status(200).json(data);
					//});
				} else {
					res.status(200).json({
						error: "OTP Missmatch"
					});
				}
			}
		}
	);
});

router.get("/rechargeWallet", (req, res) => {
	const { wallet_id, amount } = req.query;

	let data = {};
	data.amount = amount.toString();
	data.from = "recharge";
	data.to = wallet_id.toString();

	rechargeNow([data]).then(function(result) {
		res.status(200).json({
			status: result.toString()
		});
	});
});

router.get("/showBalance", (req, res) => {
	const { wallet_id } = req.query;

	getBalance(wallet_id).then(function(result) {
		res.status(200).json({
			status: "success",
			balance: result
		});
	});
});

router.post("/createRules", (req, res) => {
	//fee
	let data = new Fee();
	const { name, trans_type, active, ranges, bank_id, selectedBankFeeId } = req.body;
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
							data.bank_id = bank_id;
							data.user_id = user._id;
							data.name = name;
							data.trans_type = trans_type;
							data.active = active;
							data.ranges = JSON.stringify(ranges);
							data.bankFeeId = selectedBankFeeId;
							var edited = {
								name: name,
								trans_type: trans_type,
								active: active,
								ranges: ranges
							};
							data.editedRanges = JSON.stringify(edited);

							Fee.findOne(
								{
									trans_type: trans_type,
									bank_id: bank_id
								},
								function(err, fee) {
									if (fee == null) {
										data.save(err => {
											if (err)
												return res.status(400).json({
													error: err
												});
											let content =
												"<p>New fee rule has been added for your bank in E-Wallet application</p><p>&nbsp;</p><p>Fee Name: " +
												name +
												"</p>";
											let content2 =
												"New fee rule has been added for your bank in E-Wallet application Fee Name: " +
												name;
											sendSMS(content2, bank.mobile);
											res.status(200).json({
												success: true
											});
										});
									} else {
										res.status(400).json({
											error: "This rule type already exists for this bank"
										});
									}
								}
							);
						}
					}
				);
			}
		}
	);
});

router.post("/editRule", (req, res) => {
	const { name, trans_type, active, ranges, bank_id, rule_id } = req.body;
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
								ranges: ranges
							};
							Fee.findByIdAndUpdate(
								{
									_id: rule_id
								},
								{
									editedRanges: JSON.stringify(edited),
									edit_status: 0
								},
								err => {
									if (err)
										return res.status(400).json({
											error: err
										});
									let content = "<p>Rule " + name + " has been updated, check it out</p>";
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

router.post("/getBankByName", function(req, res) {
	//res.send("hi");
	const { name } = req.body;

	Bank.findOne(
		{
			name: name
		},
		function(err, bank) {
			if (err || bank == null) {
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
});

router.post("/getBankRules", function(req, res) {
	const { bank_id } = req.body;
	Bank.findOne(
		{
			_id: bank_id
		},
		function(err, bank) {
			if (err) {
				console.log(err),
				res.status(500).json({
					status: 0,
					error: "Internal Server Error"
				})
			}
			if ( bank == null) {
				res.status(401).json({
					status: 0,
					error: "Unauthorized"
				});
			} else {
				Fee.find(
					{
						bank_id: bank_id
					},
					function(err, rules) {
						if (err) {
							res.status(500).json({
								status: 0,
								error: "Internal Server Error"
							});
						} else {
							res.status(200).json({
								status: 1,
								rules: rules
							});
						}
					}
				);
			}
		}
	);
});

router.post("/get-branch-details-by-id/:id", async (req, res) => {
	try {
		const branchId = req.params.id;
		const { bank_id } = req.body;
		const branch = await Branch.find({ bank_id, bcode: branchId });
		if (branch.length == 0) throw { message: "Branch not found" };

		res.send({ code: 1, branch });
	} catch (err) {
		res.send({ code: 0, message: err.message });
	}
});

router.post("/getBranchByName", function(req, res) {
	//res.send("hi");
	const { name } = req.body;

	Branch.findOne(
		{
			name: name
		},
		function(err, bank) {
			if (err || bank == null) {
				res.status(404).json({
					error: "Not found"
				});
			} else {
				Bank.findOne(
					{
						_id: bank.bank_id
					},
					function(err, ba) {
						if (err || ba == null) {
							res.status(404).json({
								error: "Not found"
							});
						} else {
							var obj = {};
							obj["logo"] = ba.logo;
							obj["bankName"] = ba.name;
							obj["name"] = bank.name;
							obj["mobile"] = bank.mobile;
							obj["_id"] = bank._id;
							obj["bcode"] = ba.bcode;

							res.status(200).json({
								banks: obj
							});
						}
					}
				);
			}
		}
	);
});

router.post("/getWalletsOperational", function(req, res) {
	const { bank_id } = req.body;

	Bank.findOne(
		{
			_id: bank_id
		},
		function(err, bank) {
			if (err) {
				res.status(500).json({
					error: err
				});
			} else {
				res.status(200).json({
					from: "infra_operational@" + bank.name,
					to: "infra_master@" + bank.name
				});
			}
		}
	);
});

router.post("/getWalletsMaster", function(req, res) {
	//res.send("hi");
	const { bank_id } = req.body;

	Bank.findOne(
		{
			_id: bank_id
		},
		function(err, bank) {
			if (err) {
				res.status(500).json({
					error: err
				});
			} else {
				res.status(200).json({
					from: "infra_master@" + bank.name,
					to: "master@" + bank.name
				});
			}
		}
	);
});


router.post("/updateStatus", function(req, res) {
	//res.send("hi");
	const { token, status, type_id, page, type } = req.body;
	const pageClass = getTypeClass(page);
	const typeClass = getTypeClass(type);
	typeClass.findOne(
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
				pageClass.findByIdAndUpdate(
					type_id,
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

router.post("/getDocs", function(req, res) {
	//res.send("hi");
	const { bank_id } = req.body;
	Document.find(
		{
			bank_id
		},
		function(err, user) {
			if (err) {
				res.status(404).json({
					error: err
				});
			}
			res.status(200).json({
				docs: user
			});
		}
	);
});



router.post("/declineFee", function(req, res) {
	//res.send("hi");
	const { id } = req.body;
	Bank.findOne(
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
				Fee.findByIdAndUpdate(
					id,
					{
						status: 0
					},
					err => {
						if (err)
							return res.status(402).json({
								error: err
							});
						res.status(200).json({
							success: "Updated successfully"
						});
					}
				);
			}
		}
	);
});

router.put("/updateOne", function(req, res) {
	const { page, type, page_id, updateData, token } = req.body;

	const pageClass = getTypeClass(page);
	const typeClass = getTypeClass(type);

	typeClass.findOne(
		{
			token,
			status: 1
		},
		function(err, t1) {
			if (err || t1 == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				pageClass.findByIdAndUpdate(page_id, updateData, function(err, data) {
					if (err) {
						res.status(404).json({
							error: "Not Found"
						});
					} else {
						res.status(200).json({
							row: data
						});
					}
				});
			}
		}
	);
});

router.put("/updateCashier", function(req, res) {
	const { page, type, page_id, updateData, token } = req.body;

	const pageClass = getTypeClass(page);
	const typeClass = getTypeClass(type);

	typeClass.findOne(
		{
			token,
			status: 1
		},
		function(err, t1) {
			if (err || t1 == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
				Cashier.countDocuments({ bank_user_id: updateData.bank_user_id }, function(err, c) {
					console.log(c);
					if (c > 0) {
						res.status(200).json({
							error: "User is already assigned to this or another cashier"
						});
					} else {
						pageClass.findByIdAndUpdate(page_id, updateData, function(err, data) {
							if (err) {
								res.status(404).json({
									error: "Not Found"
								});
							} else {
								res.status(200).json({
									row: data
								});
							}
						});
					}
				});
			}
		}
	);
});


router.post("/bankForgotPassword", function(req, res) {
	//res.send("hi");
	let data = new OTP();
	const { mobile } = req.body;
	Bank.findOne(
		{
			mobile: mobile
		},
		function(err, bank) {
			if (err || bank == null) {
				res.status(401).json({
					error: "Account not found!"
				});
			} else {
				data.user_id = bank._id;
				data.otp = makeotp(6);
				data.page = "bankForgotPassword";
				data.mobile = mobile;

				data.save(err => {
					if (err)
						return res.status(400).json({
							error: err
						});

					let content = "Your OTP to change password is " + data.otp;
					sendSMS(content, mobile);
					sendMail(content, "OTP", bank.email);

					res.status(200).json({
						mobile: mobile,
						username: bank.username
					});
				});
			}
		}
	);
});

router.post("/branchForgotPassword", function(req, res) {
	//res.send("hi");
	let data = new OTP();
	const { mobile } = req.body;
	Branch.findOne(
		{
			mobile: mobile
		},
		function(err, bank) {
			if (err || bank == null) {
				res.status(401).json({
					error: "Account not found!"
				});
			} else {
				data.user_id = bank._id;
				data.otp = makeotp(6);
				data.page = "branchForgotPassword";
				data.mobile = mobile;

				data.save(err => {
					if (err)
						return res.status(400).json({
							error: err
						});

					let content = "Your OTP to change password is " + data.otp;
					sendSMS(content, mobile);
					sendMail(content, "OTP", bank.email);

					res.status(200).json({
						mobile: mobile,
						username: bank.username
					});
				});
			}
		}
	);
});

router.post("/cashierForgotPassword", function(req, res) {
	//res.send("hi");
	let data = new OTP();
	const { mobile } = req.body;
	BankUser.findOne(
		{
			mobile: mobile
		},
		function(err, bank) {
			if (err || bank == null) {
				res.status(401).json({
					error: "Account not found!"
				});
			} else {
				data.user_id = bank._id;
				data.otp = makeotp(6);
				data.page = "cashierForgotPassword";
				data.mobile = mobile;

				data.save(err => {
					if (err)
						return res.status(400).json({
							error: err
						});

					let content = "Your OTP to change password is " + data.otp;
					sendSMS(content, mobile);
					sendMail(content, "OTP", bank.email);

					res.status(200).json({
						mobile: mobile,
						username: bank.username
					});
				});
			}
		}
	);
});

router.post("/forgotPassword", function(req, res) {
	//res.send("hi");
	let data = new OTP();
	const { mobile } = req.body;
	Infra.findOne(
		{
			mobile: mobile
		},
		function(err, bank) {
			if (err || bank == null) {
				res.status(401).json({
					error: "Account not found!"
				});
			} else {
				data.user_id = bank._id;
				data.otp = makeotp(6);
				data.page = "forgotPassword";
				data.mobile = mobile;

				data.save(err => {
					if (err)
						return res.status(400).json({
							error: err
						});

					let content = "Your OTP to change password is " + data.otp;
					sendSMS(content, mobile);
					sendMail(content, "OTP", bank.email);

					res.status(200).json({
						mobile: mobile,
						username: bank.username
					});
				});
			}
		}
	);
});
/* Bank APIs end */

router.post("/sendOTP", function(req, res) {
	let data = new OTP();
	const { token, page, type, email, mobile, txt } = req.body;
	const typeClass = getTypeClass(type);
	typeClass.findOne(
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
				data.mobile = mobile;
				data.save((err, ot) => {
					if (err)
						return res.json({
							error: err.toString()
						});

					let content = txt + data.otp;
					sendSMS(content, mobile);
					sendMail(content, "OTP", email);

					res.status(200).json({
						id: ot._id
					});
				});
			}
		}
	);
});

router.post("/generateOTPBank", function(req, res) {
	let data = new OTP();
	const { username } = req.body;

	Bank.findOne(
		{
			username
		},
		function(err, bank) {
			data.user_id = "0";
			data.otp = makeotp(6);
			data.page = "bankbankinfo";
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
});

router.post("/verifyOTP", function(req, res) {
	const { mobile, otp } = req.body;
	OTP.findOne(
		{
			mobile,
			otp
		},
		function(err, ot) {
			if (err || ot == null) {
				res.status(403).json({
					error: "Invalid OTP!"
				});
			} else {
				if (ot.otp == otp && ot.mobile == mobile) {
					let token = makeid(10);
					let page = Infra;
					if (ot.page == "bankForgotPassword") {
						page = Bank;
					} else if (ot.page == "branchForgotPassword") {
						page = Branch;
					} else if (ot.page == "cashierForgotPassword") {
						page = BankUser;
					}
					page.findByIdAndUpdate(
						ot.user_id,
						{
							token: token
						},
						err => {
							if (err)
								return res.json({
									success: false,
									error: err
								});
							res.status(200).json({
								token: token
							});
						}
					);
				} else {
					res.status(402).json({
						error: "Invalid OTP!"
					});
				}
			}
		}
	);
});

router.post("/InfraVrifyOTP", function(req, res) {
	const { mobile, otp } = req.body;
	OTP.findOne(
		{
			mobile,
			otp
		},
		function(err, ot) {
			if (err || ot == null) {
				res.status(401).json({
					error: "Invalid OTP!"
				});
			} else {
				if (ot.otp == otp && ot.mobile == mobile) {
					let token = makeid(10);
					Infra.findByIdAndUpdate(
						ot.user_id,
						{
							token: token
						},
						err => {
							if (err)
								return res.json({
									success: false,
									error: err
								});
							res.status(200).json({
								token: token
							});
						}
					);
				} else {
					res.status(402).json({
						error: "Invalid OTP!"
					});
				}
			}
		}
	);
});

router.post("/getRule", function(req, res) {
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
					function(err, rule) {
						if (err) {
							res.status(404).json({
								error: err
							});
						} else {
							res.status(200).json({
								rules: rule
							});
						}
					}
				);
			}
		}
	);
});

router.post("/getHistory", function(req, res) {
	const { from, token, where } = req.body;
	const pageClass = getTypeClass(from);
	pageClass.findOne(
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
				if (from == "cashier") {
					CashierSend.find(where, function(err, b) {
						var res1 = b;
						console.log(res);
						CashierClaim.find(where, function(err, b) {
							var res2 = b;
							const result = {};
							let key;

							for (key in res1) {
								if (res1.hasOwnProperty(key)) {
									result[key] = res1[key];
								}
							}

							for (key in res2) {
								if (res2.hasOwnProperty(key)) {
									result[key] = res2[key];
								}
							}
							res.status(200).json({
								status: "success",
								history: result
							});
						});
					});
				}
			}
		}
	);
});

router.post("/getCashierHistory", function(req, res) {
	const { from, token, where } = req.body;
	const pageClass = getTypeClass(from);
	pageClass.findOne(
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
				if (from == "cashier") {
					CashierSend.find(where, function(err, b) {
						var res1 = b;

						CashierClaim.find(where, function(err, b) {
							var res2 = b;

							CashierPending.find(where, function(err, b) {
								var res3 = b;
								res.status(200).json({
									status: "success",
									history1: res1,
									history2: res2,
									history3: res3
								});
							});
						});
					});
				}
			}
		}
	);
});

router.post("/getBranchTransHistory", function(req, res) {
	const { from, token, where } = req.body;
	const pageClass = getTypeClass(from);
	pageClass.findOne(
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
				if (from == "branch") {
					BranchSend.find(where, function(err, b) {
						var res1 = b;

						BranchClaim.find(where, function(err, b) {
							var res2 = b;

							res.status(200).json({
								status: "success",
								history1: res1,
								history2: res2
							});
						});
					});
				}
			}
		}
	);
});

router.post("/getTransHistory", function(req, res) {
	const { master_code } = req.body;

	getChildStatements(master_code).then(function(result) {
		res.status(200).json({
			status: "success",
			result: result
		});
	});
});

router.post("/getHistoryTotal", function(req, res) {
	const { from, token } = req.body;
	const pageClass = getTypeClass(from);
	pageClass.findOne(
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
				if (from == "cashier") {
					CashierSend.countDocuments({}, function(err, c) {
						var res1 = c;
						console.log(res1);
						CashierClaim.countDocuments({}, function(err, c) {
							var res2 = c;
							var result = res1 + res2;
							res.status(200).json({
								status: "success",
								history: result
							});
						});
					});
				}
			}
		}
	);
});

router.get("/clearDb", function(req, res) {
	const type = req.query.type;

	if (type == "all" || type == "infra") {
		db.dropCollection("infras", function() {});
	}
	if (type == "all" || type == "otp") {
		db.dropCollection("otps", function() {});
	}
	if (type == "all" || type == "bank") {
		db.dropCollection("banks", function() {});
	}
	if (type == "all" || type == "profile") {
		db.dropCollection("profiles", function() {});
	}
	if (type == "all" || type == "fee") {
		db.dropCollection("fees", function() {});
	}
	if (type == "all" || type == "document") {
		db.dropCollection("documents", function() {});
	}
	if (type == "all" || type == "bankfee") {
		db.dropCollection("bankfees", function() {});
	}
	if (type == "all" || type == "branch") {
		db.dropCollection("branches", function() {});
	}
	if (type == "all" || type == "cashier") {
		db.dropCollection("cashiers", function() {});
	}

	if (type == "all" || type == "bankuser") {
		db.dropCollection("bankusers", function() {});
	}

	if (type == "all" || type == "cashiersend") {
		db.dropCollection("cashiersends", function() {});
	}

	if (type == "all" || type == "cashierclaim") {
		db.dropCollection("cashierclaims", function() {});
	}

	if (type == "all" || type == "cashierledger") {
		db.dropCollection("cashierledgers", function() {});
	}

	if (type == "all" || type == "branchsend") {
		db.dropCollection("branchsends", function() {});
	}

	if (type == "all" || type == "branchclaim") {
		db.dropCollection("branchclaims", function() {});
	}

	if (type == "all" || type == "branchledger") {
		db.dropCollection("branchledgers", function() {});
	}

	res.status(200).json({
		status: "success"
	});
});

router.post("/save-currency", async (req, res) => {
	try {
		const input = req.body;
		const currencyData = await CurrencyModel.find({});
		if (currencyData.length == 0) {
			await CurrencyModel(input).save();
		} else {
			await CurrencyModel.update({ _id: currencyData[0]._id }, { $set: input });
		}
		res.status(200).json({ message: "saved", input });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

router.get("/get-currency", async (req, res) => {
	try {
		const data = await CurrencyModel.find({});
		res.status(200).json(data);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;