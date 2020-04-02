const request = require("request");
const express = require("express");
const config = require("./config.json");
const db = require("./dbConfig");

//utils
const makeid = require("./routes/utils/idGenerator");
const sendSMS = require("./routes/utils/sendSMS");
const sendMail = require("./routes/utils/sendMail");
const doRequest = require("./routes/utils/doRequest");
const getTypeClass = require("./routes/utils/getTypeClass");

//services
const {
	createWallet,
	getStatement,
	rechargeNow,
	transferThis,
	getChildStatements,
	getTransactionCount,
	getBalance
} = require("./services/Blockchain.js");

//routes
const userRouter = require("./routes/Users");
const infraRouter = require("./routes/Infra");
const bankRouter = require("./routes/Bank");
const uploadRouter = require("./routes/Upload");
const cashierRouter = require("./routes/Cashier");
const branchRouter = require("./routes/Branch")
const bankUserRouter = require("./routes/BankUser")

var formidable = require("formidable");
var path = require("path");
var fs = require("fs-extra");
var cors = require("cors");
const bodyParser = require("body-parser");
const logger = require("morgan");
const nodemailer = require("nodemailer");
const cookieParser = require("cookie-parser");

const Infra = require("./models/Infra");
const Fee = require("./models/Fee");
const User = require("./models/User");
const Bank = require("./models/Bank");
const OTP = require("./models/OTP");
const Profile = require("./models/Profile");
const Document = require("./models/Document");
const Branch = require("./models/Branch");
const BankUser = require("./models/BankUser");
const Cashier = require("./models/Cashier");
const BankFee = require("./models/BankFee");
const CashierSend = require("./models/CashierSend");
const CashierPending = require("./models/CashierPending");
const CashierClaim = require("./models/CashierClaim");
const CashierLedger = require("./models/CashierLedger");
const CashierTransfer = require("./models/CashierTransfer");
const BranchSend = require("./models/BranchSend");
const BranchClaim = require("./models/BranchClaim");
const BranchLedger = require("./models/BranchLedger");
const CurrencyModel = require("./models/Currency");

const API_PORT = 3001;
const mainFee = config.mainFee;
const defaultFee = config.defaultFee;
const defaultAmt = config.defaultAmt;

const app = express();
app.use(cors());
app.use(cookieParser());
app.use(express.static("public"));
const router = express.Router();

app.use(logger("dev"));
app.use(
	bodyParser.json({
		limit: "50mb"
	})
);
app.use(
	bodyParser.urlencoded({
		limit: "50mb",
		extended: true
	})
);

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

router.get("/testGet", function(req, res) {
	return res.status(200).json({
		status: "Internal error please try again"
	});
});

router.get("/getBalance", (req, res) => {
	const { token, wallet_id, type } = req.query;
	const typeClass = getTypeClass(type);
	typeClass.findOne(
		{
			token,
			status: 1
		},
		function(err, bank) {
			if (err || bank == null) {
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
					if (type === "bank") {
						where = { _id: page_id };
					} else {
						where = { _id: page_id };
					}

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

router.post("/editCashier", (req, res) => {
	const {
		cashier_id,
		name,
		bcode,
		working_from,
		working_to,
		per_trans_amt,
		max_trans_amt,
		max_trans_count,
		token
	} = req.body;
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
	let data = new Bank();
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
							data2.save(err => {});
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
	const { name, trans_type, active, ranges, bank_id, token, selectedBankFeeId } = req.body;
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
											let result = sendMail(content, "New Rule Added", bank.email);
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
	const { name, trans_type, active, ranges, token, bank_id, rule_id, selectedBankFeeId } = req.body;
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
	//res.send("hi");
	const { token, bank_id } = req.body;

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
	const { token, bank_id } = req.body;

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

router.post("/getBankRules", function(req, res) {
	const { bank_id } = req.body;
	Bank.findOne(
		{
			_id: bank_id
		},
		function(err, user) {
			if (err || user == null) {
				res.status(401).json({
					error: "Unauthorized"
				});
			} else {
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
			}
		}
	);
});

router.post("/approveFee", function(req, res) {
	//res.send("hi");
	const { token, id } = req.body;
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
				Fee.findOne(
					{
						_id: id
					},
					function(err, fee) {
						var edited = JSON.parse(fee.editedRanges);
						edited.status = 1;
						edited.ranges = JSON.stringify(edited.ranges);
						edited.edit_status = 1;
						Fee.findByIdAndUpdate(id, edited, err => {
							if (err)
								return res.status(402).json({
									error: err.toString()
								});
							res.status(200).json({
								success: "Updated successfully"
							});
						});
					}
				);
			}
		}
	);
});

router.post("/declineFee", function(req, res) {
	//res.send("hi");
	const { token, id } = req.body;
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
						status: 2,
						edit_status: 2
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

router.post("/save-revenue-sharing-rules/:id", async (req, res) => {
	try {
		const { standardRevenueSharingRule, branchWithSpecificRevenue } = req.body;
		const { id } = req.params;

		await Fee.update(
			{ _id: id },
			{
				$set: {
					standardRevenueSharingRule,
					branchWithSpecificRevenue
				}
			}
		);

		res.send({ code: 1 });
	} catch (err) {
		res.send({ code: 0, message: err.message });
	}
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


router.post("/cashierLogin", function(req, res) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var date = new Date(start); // some mock date
	start = date.getTime();

	var thisday = new Date();
	thisday.setHours(0, 0, 0, 0);
	thisday = thisday.getTime();

	const { username, password } = req.body;
	BankUser.findOne(
		{
			username,
			password
		},
		function(err, bank) {
			if (err) {
				res.status(500).json({
					error: "Internal error please try again"
				});
			} else if (!bank || bank == null) {
				res.status(401).json({
					error: "Incorrect username or password"
				});
			} else if (bank.status == -1) {
				res.status(401).json({
					error: "Your account has been blocked, pls contact the admin!"
				});
			} else {
				Cashier.findOne(
					{
						bank_user_id: bank._id
					},
					function(err, ba) {
						var closingTime = new Date(ba.closing_time);
						closingTime.setHours(0, 0, 0, 0);
						closingTime = closingTime.getTime();

						if (err || ba == null) {
							res.status(401).json({
								error: "Incorrect username or password"
							});
						}
						// else if(ba.closing_time != null &&  closingTime >= thisday){
						//     res.status(401)
						//   .json({
						//     error: 'You are closed for the day, Please contact the manager'
						//   });
						// }
						else {
							let token = makeid(10);
							var upd = {
								token: token
							};

							// if( ba.closing_time != null){
							//   var ct = new Date(ba.closing_time);
							//   ct = ct.getTime();
							//   console.log(ct);
							//   console.log(start);
							//   if(ct < start) {
							//   upd={
							//     token: token,
							//     opening_balance: ba.closing_balance,
							//     cash_received: 0,
							//     fee_generated:0,
							//     cash_paid: 0,
							//     closing_balance: 0,
							//     closing_time: null
							//   }
							// }
							// }

							console.log(upd);

							Cashier.findByIdAndUpdate(ba._id, upd, err => {
								if (err)
									return res.status(400).json({
										error: err
									});
								res.status(200).json({
									token: token,
									name: ba.name,
									username: bank.username,
									status: ba.status,
									email: bank.email,
									mobile: bank.mobile,
									cashier_id: ba._id,
									id: bank._id
								});
							});
						}
					}
				);
			}
		}
	);
});



router.post("/infraSetupUpdate", function(req, res) {
	const { username, password, token } = req.body;
	Infra.findOne(
		{
			token,
			status: 1
		},
		function(err, bank) {
			if (err) {
				res.status(500).json({
					error: "Internal error please try again"
				});
			} else if (!bank || bank == null) {
				res.status(401).json({
					error: "Incorrect username or password"
				});
			} else {
				Infra.findByIdAndUpdate(
					bank._id,
					{
						username: username,
						password: password
					},
					err => {
						if (err)
							return res.status(400).json({
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
	const { token, username, page } = req.body;

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
				res.status(401).json({
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

router.get("/getRevenueFeeFromBankFeeId/:bankFeeId", async (req, res) => {
	try {
		const fee = await Fee.find({ bankFeeId: req.params.bankFeeId });
		if (fee.length == 0) throw { message: "no data" };

		res.send({ code: 1, fee: fee[0] });
	} catch (err) {
		res.status(200).send({ code: 0, message: err.message });
	}
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
	const { token, master_code } = req.body;
	//   Cashier.findOne({
	//     token,
	// status:1
	//   }, function (err, f) {
	//     if (err || f == null) {
	//       res.status(401)
	//         .json({
	//           error: "Unauthorized"
	//         });
	//     } else {

	getChildStatements(master_code).then(function(result) {
		res.status(200).json({
			status: "success",
			result: result
		});
	});

	//      CashierSend.find({transaction_code: transCode}, function (err, b) {
	//        console.log(b.master_code);
	//       var res1 = b;

	//         var mc = b[0].master_code;

	//            CashierClaim.find({transaction_code: transCode}, function (err, b) {
	//             var res2 = b;

	//     res.status(200).json({
	//       status: 'success',
	//       history1: res1,
	//       history2: res2,
	//       master_code: mc

	//   });

	// });

	// });

	//     }

	// });
});

router.post("/getHistoryTotal", function(req, res) {
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
		db.dropCollection("infras", function(err, c) {});
	}
	if (type == "all" || type == "otp") {
		db.dropCollection("otps", function(err, c) {});
	}
	if (type == "all" || type == "bank") {
		db.dropCollection("banks", function(err, c) {});
	}
	if (type == "all" || type == "profile") {
		db.dropCollection("profiles", function(err, c) {});
	}
	if (type == "all" || type == "fee") {
		db.dropCollection("fees", function(err, c) {});
	}
	if (type == "all" || type == "document") {
		db.dropCollection("documents", function(err, c) {});
	}
	if (type == "all" || type == "bankfee") {
		db.dropCollection("bankfees", function(err, c) {});
	}
	if (type == "all" || type == "branch") {
		db.dropCollection("branches", function(err, c) {});
	}
	if (type == "all" || type == "cashier") {
		db.dropCollection("cashiers", function(err, c) {});
	}

	if (type == "all" || type == "bankuser") {
		db.dropCollection("bankusers", function(err, c) {});
	}

	if (type == "all" || type == "cashiersend") {
		db.dropCollection("cashiersends", function(err, c) {});
	}

	if (type == "all" || type == "cashierclaim") {
		db.dropCollection("cashierclaims", function(err, c) {});
	}

	if (type == "all" || type == "cashierledger") {
		db.dropCollection("cashierledgers", function(err, c) {});
	}

	if (type == "all" || type == "branchsend") {
		db.dropCollection("branchsends", function(err, c) {});
	}

	if (type == "all" || type == "branchclaim") {
		db.dropCollection("branchclaims", function(err, c) {});
	}

	if (type == "all" || type == "branchledger") {
		db.dropCollection("branchledgers", function(err, c) {});
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

app.use("/api", router);
app.use("/api", userRouter);
app.use("/api", bankRouter);
app.use("/api", infraRouter);
app.use("/api", uploadRouter);
app.use("/api", cashierRouter);
app.use("/api", branchRouter);
app.use("/api", bankUserRouter);
app.listen(API_PORT, () => console.log("Backend Started"));
