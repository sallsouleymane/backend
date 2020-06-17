const express = require("express");
const router = express.Router();
const config = require("../config.json");

//utils
const makeid = require("./utils/idGenerator");
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const getTypeClass = require("./utils/getTypeClass");
const makeotp = require("./utils/makeotp");

//services
const { createWallet, getStatement, getBalance } = require("../services/Blockchain.js");

const Bank = require("../models/Bank");
const OTP = require("../models/OTP");
const Branch = require("../models/Branch");
const BankUser = require("../models/BankUser");
const Cashier = require("../models/Cashier");
const Fee = require("../models/Fee");
const CashierLedger = require("../models/CashierLedger");
const Merchant = require("../models/merchant/Merchant");
const FailedTX = require("../models/FailedTXLedger");

router.post("/bank/listMerchants", function (req, res) {
	var { token } = req.body;
	Bank.findOne(
		{
			token,
			status: 1,
		},
		function (err, bank) {
			if (err) {
				console.log(err);
				res.status(200).json({
					status: 0,
					message: "Internal error please try again",
				});
			} else if (bank == null) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else {
				Merchant.find({ bank_id: bank._id}, "-password", (err, merchants) => {
					if (err) {
						console.log(err);
						res.status(200).json({
							status: 0,
							message: "Internal Server Error",
						});
					} else {
						res.status(200).json({
							status: 1,
							message: "Merchant List",
							list: merchants,
						});
					}
				});
			}
		}
	);
});

router.post("/bank/createMerchant", function (req, res) {
	var {
		token,
		code,
		name,
		logo,
		description,
		document_hash,
		email,
		mobile,
	} = req.body;
	Bank.findOne(
		{
			token,
			status: 1,
		},
		function (err, bank) {
			if (err) {
				console.log(err);
				res.status(200).json({
					status: 0,
					message: "Internal error please try again",
				});
			} else if (bank == null) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else {
				if (!code) {
					res.status(200).json({
						status: 0,
						message: "Code is a required field",
					});
				} else {
					const wallet = code + "_operational@" + bank.name;
					createWallet([wallet]).then((result) => {
						if (result.status == 0) {
							res.status(200).json({
								status: 0,
								message: "Blockchain service is unavailabel",
							});
						} else {
							const data = new Merchant();
							data.name = name;
							data.logo = logo;
							data.description = description;
							data.document_hash = document_hash;
							data.email = email;
							data.mobile = mobile;
							data.code = code;
							data.username = code;
							data.password = makeid(8);
							data.bank_id = bank._id;
							data.status = 0;
							data.creator = 0;

							data.save((err) => {
								if (err) {
									console.log(err);
									res.status(200).json({
										status: 0,
										message: "Either merchant id/ email / mobile aready exist",
									});
								} else {
									let content =
										"<p>You are added as a Merchant in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
										config.mainIP +
										"/merchant/" +
										bank.name +
										"'>http://" +
										config.mainIP +
										"/merchant/" +
										bank.name +
										"</a></p><p><p>Your username: " +
										data.username +
										"</p><p>Your password: " +
										data.password +
										"</p>";
									sendMail(content, "Bank Merchant Created", email);
									let content2 =
										"You are added as a Merchant in E-Wallet application Login URL: http://" +
										config.mainIP +
										"/merchant/" +
										bank.name +
										" Your username: " +
										data.username +
										" Your password: " +
										data.password;
									sendSMS(content2, mobile);
									res.status(200).json({
										status: 1,
										message: "Merchant created successfully",
										blockchain_result: result,
									});
								}
							});
						}
					});
				}
			}
		}
	);
});

router.post("/bank/editMerchant", function (req, res) {
	var { token, merchant_id, name, logo, description, document_hash, email} = req.body;
	Bank.findOne(
		{
			token,
			status: 1,
		},
		function (err, bank) {
			if (err) {
				console.log(err);
				res.status(200).json({
					status: 0,
					message: "Internal error please try again",
				});
			} else if (bank == null) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else {
				Merchant.findOneAndUpdate({ _id: merchant_id , creator: 0, bank_id: bank._id}, {
					name: name,
					logo: logo,
					description: description,
					document_hash: document_hash,
					email: email,
				},(err , merchant) => {
					if (err) {
						console.log(err);
						res.status(200).json({
							status: 0,
							message: "Email already exist.",
						});
					}
					else if (merchant == null) {
						res.status(200).json({
							status: 0,
							message: "Merchant not found.",
						});
					} else {
						res.status(200).json({
							status: 1,
							message: "Merchant edited successfully",
						});
					}
				})
			}
		}
	);
});

router.post("/getRevenueFeeFromBankFeeId/:bankFeeId", async (req, res) => {
	try {
		const { token } = req.body;
		var result= await Bank.findOne({token: token});
		if ( result == null ) {
			throw { message: "Unauthorized"}
		}
		const fee = await Fee.findById(req.params.bankFeeId);
		if (fee == null) throw { message: "No Fee Rule found" };

		res.send({ status: 1, fee: fee.revenue_sharing_rule, infra_status: fee.status});
	} catch (err) {
		res.status(403).send({ status: 0, message: err.message });
	}
});

router.post("/save-revenue-sharing-rules/:id", async (req, res) => {
	try {
		const { token, revenue_sharing_rule } = req.body;
		const { id } = req.params;
		var result= await Bank.findOne({token: token});
		if ( result == null ) {
			throw { message: "Unauthorized"}
		}
		result = await Fee.updateOne(
			{ _id: id },
			{
				$set: {
				'revenue_sharing_rule.branch_share.claim': revenue_sharing_rule.branch_share.claim, 
				'revenue_sharing_rule.branch_share.send': revenue_sharing_rule.branch_share.send,
				'revenue_sharing_rule.specific_branch_share': revenue_sharing_rule.specific_branch_share
			}
			}
		);
		if ( result == null ) {
			throw { message: "Not Found"}
		}

		res.send({ status: 1 });
	} catch (err) {
		res.send({ status: 0, message: err.message });
	}
});

router.post("/bank/sendShareForApproval", function (req, res) {
	const { token, trans_type, percentage, fixed } = req.body;
	Bank.findOne(
		{
			token,
			status: 1
		},
		function (err, bank) {
			if (err) {
				console.log(err);
				res.status(500).json({
					status: 0,
					error: "Internal Server Error"
				});
			} else if (bank == null) {
				res.status(403).json({
					status: 0,
					error: "Unauthorized"
				});
			} else {
				Fee.findOneAndUpdate(
					{
						trans_type: trans_type,
						bank_id: bank._id.toString()
					},
					{
						$set: {
							status: 2,
							'revenue_sharing_rule.infra_share.fixed': fixed, 
							'revenue_sharing_rule.infra_share.percentage': percentage
						}
					},
					function (err, fee) {
						if (err) {
							console.log(err);
							res.status(500).json({
								status: 0,
								error: "Internal Server Error"
							});
						} else if (fee == null) {
							res.status(403).json({
								status: 0,
								error: "Rule not found"
							});
						} else {
							let content =
								"<p>Revenue sharing rule of infra is changed and sent for approval to infra.</p><p>&nbsp;</p><p>Fee Name: " +
								fee.name +
								"</p>";
							sendMail(content, "Fee Rule Updated", bank.email);
							let content2 =
								"Revenue sharing rule of infra is changed and sent for approval to infra: " +
								fee.name;
							sendSMS(content2, bank.mobile);
							res.status(200).json({
								status: 1
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bankSetupUpdate", function (req, res) {
	const { username, password, token } = req.body;
	Bank.findOne(
		{
			token,
		},
		function (err, bank) {
			if (err || bank == null) {
				res.status(500).json({
					error: err.toString(),
				});
			} else if (!bank) {
				res.status(401).json({
					error: "Incorrect username or password",
				});
			} else {
				Bank.findByIdAndUpdate(
					bank._id,
					{
						username: username,
						password: password,
						initial_setup: true,
					},
					(err) => {
						if (err)
							return res.status(400).json({
								error: err,
							});
						res.status(200).json({
							success: "Updated successfully",
						});
					}
				);
			}
		}
	);
});

router.post("/bankActivate", function (req, res) {
	const { token } = req.body;
	Bank.findOne(
		{
			token,
		},
		function (err, bank) {
			if (err) {
				res.status(500).json({
					error: "Internal error please try again",
				});
			} else if (!bank) {
				res.status(401).json({
					error: "Account not found",
				});
			} else {
				Bank.findByIdAndUpdate(
					bank._id,
					{
						status: 1,
					},
					(err) => {
						if (err)
							return res.status(400).json({
								error: err,
							});
						createWallet(
							[
								"testuser@" + bank.name,
								"operational@" + bank.name,
								"escrow@" + bank.name,
								"master@" + bank.name,
								"infra_operational@" + bank.name,
								"infra_master@" + bank.name,
							]
						).then(function (result) {
							res.status(200).json({
								status: "activated",
								walletStatus: result,
							});
						});
					}
				);
			}
		}
	);
});

router.post("/getBankDashStats", function (req, res) {
	const { token } = req.body;
	Bank.findOne(
		{
			token,
			status: 1,
		},
		function (err, user) {
			if (err || user == null) {
				res.status(401).json({
					error: "Unauthorized",
				});
			} else {
				const user_id = user._id;
				Branch.countDocuments(
					{
						bank_id: user_id,
					},
					function (err, branch) {
						if (err) {
							res.status(402).json({
								error: err,
							});
						} else {
							res.status(200).json({
								totalBranches: branch,
							});
						}
					}
				);
			}
		}
	);
});

router.get("/getBankOperationalBalance", function (req, res) {
	const { bank } = req.query;

	Bank.findOne(
		{
			token: bank,
			status: 1,
		},
		function (err, ba) {
			if (err || ba == null) {
				res.status(401).json({
					error: "Unauthorized",
				});
			} else {
				const wallet_id = "operational@" + ba.name;

				getBalance(wallet_id).then(function (result) {
					res.status(200).json({
						status: "success",
						balance: result,
					});
				});
			}
		}
	);
});

router.post("/getBranches", function (req, res) {
	const { token } = req.body;
	Bank.findOne(
		{
			token,
			status: 1,
		},
		function (err, bank) {
			if (err || bank == null) {
				res.status(401).json({
					error: "Unauthorized",
				});
			} else {
				const bank_id = bank._id;
				// if (user.isAdmin) {
				Branch.find({ bank_id: bank_id }, function (err, branch) {
					if (err) {
						res.status(404).json({
							error: err,
						});
					} else {
						res.status(200).json({
							branches: branch,
						});
					}
				});
			}
		}
	);
});

router.post("/getBankUsers", function (req, res) {
	//res.send("hi");
	const { token } = req.body;
	Bank.findOne(
		{
			token,
			status: 1,
		},
		function (err, user) {
			if (err || user == null) {
				res.status(401).json({
					error: "Unauthorized",
				});
			} else {
				const user_id = user._id;
				BankUser.find(
					{
						bank_id: user_id,
					},
					function (err, bank) {
						if (err) {
							res.status(404).json({
								error: err,
							});
						} else {
							res.status(200).json({
								users: bank,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/addBranch", (req, res) => {
	let data = new Branch();
	const {
		name,
		bcode,
		username,
		credit_limit,
		cash_in_hand,
		address1,
		state,
		zip,
		country,
		ccode,
		mobile,
		email,
		token,
		working_from,
		working_to,
	} = req.body;

	Bank.findOne(
		{
			token,
			status: 1,
		},
		function (err, bank) {
			if (err || bank == null) {
				res.status(401).json({
					error: "Unauthorized",
				});
			} else {
				data.name = name;
				data.bcode = bcode;
				if (credit_limit !== "" && credit_limit != null) {
					data.credit_limit = credit_limit;
				}
				if (cash_in_hand !== "" && cash_in_hand != null) {
					data.cash_in_hand = cash_in_hand;
				}
				data.username = username;
				data.address1 = address1;
				data.state = state;
				data.country = country;
				data.zip = zip;
				data.ccode = ccode;
				data.mobile = mobile;
				data.email = email;
				data.bank_id = bank._id;
				data.password = makeid(10);
				data.working_from = working_from;
				data.working_to = working_to;
				let bankName = bank.name;

				data.save((err) => {
					if (err)
						return res.json({
							error: err.toString(),
						});
					createWallet([bcode + "_operational@" + bank.name, bcode + "_master@" + bank.name]).then(
						function (result) {
							let content =
								"<p>Your branch is added in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
								config.mainIP +
								"/branch/" +
								bankName +
								"'>http://" +
								config.mainIP +
								"/branch/" +
								bankName +
								"</a></p><p><p>Your username: " +
								data.username +
								"</p><p>Your password: " +
								data.password +
								"</p>";
							sendMail(content, "Bank Branch Created", email);
							let content2 =
								"Your branch is added in E-Wallet application Login URL: http://" +
								config.mainIP +
								"/branch/" +
								bankName +
								" Your username: " +
								data.username +
								" Your password: " +
								data.password;
							sendSMS(content2, mobile);
							// return res.status(200).json(data);
							res.status(200).json({
								status: "Branch Created",
								walletStatus: result.toString(),
							});
						}
					);
				});
			}
		}
	);
});

router.post("/editBranch", (req, res) => {
	let data = new Branch();
	const {
		branch_id,
		name,
		username,
		credit_limit,
		bcode,
		address1,
		state,
		zip,
		country,
		ccode,
		mobile,
		email,
		token,
		working_from,
		working_to,
	} = req.body;

	Bank.findOne(
		{
			token,
			status: 1,
		},
		function (err, user) {
			if (err || user == null) {
				res.status(401).json({
					error: "Unauthorized",
				});
			} else {
				Branch.findByIdAndUpdate(
					branch_id,
					{
						name: name,
						credit_limit: credit_limit,
						username: username,
						address1: address1,
						state: state,
						zip: zip,
						ccode: ccode,
						bcode: bcode,
						country: country,
						mobile: mobile,
						email: email,
						working_from: working_from,
						working_to: working_to,
					},
					(err) => {
						if (err)
							return res.status(400).json({
								error: err,
							});

						return res.status(200).json(data);
					}
				);
			}
		}
	);
});

router.post("/branchStatus", function (req, res) {
	//res.send("hi");
	const { token, status, branch_id } = req.body;

	Bank.findOne(
		{
			token,
			status: 1,
		},
		function (err, user) {
			if (err || user == null) {
				res.status(401).json({
					error: "Unauthorized",
				});
			} else {
				Branch.findByIdAndUpdate(
					branch_id,
					{
						status: status,
					},
					(err) => {
						if (err)
							return res.status(400).json({
								error: err,
							});
						res.status(200).json({
							status: true,
						});
					}
				);
			}
		}
	);
});

router.get("/getWalletBalance", function (req, res) {
	const { bank, type, page, token, wallet_id } = req.query;

	if (wallet_id != null && wallet_id !== "") {
		getBalance(wallet_id).then(function (result) {
			res.status(200).json({
				status: "success",
				balance: result,
			});
		});
	} else {
		const typeClass = getTypeClass(type);
		typeClass.findOne(
			{
				token,
				status: 1,
			},
			function (e, b) {
				if (e || b == null) {
					res.status(401).json({
						error: "Unauthorized",
					});
				} else {
					Bank.findOne(
						{
							name: bank,
						},
						function (err, ba) {
							if (err || ba == null) {
								res.status(404).json({
									error: "Not found",
								});
							} else {
								let wallet_id = page + "@" + ba.name;
								if (type === "branch") {
									wallet_id = b.bcode + "_" + page + "@" + ba.name;
								}

								getBalance(wallet_id).then(function (result) {
									res.status(200).json({
										status: "success",
										balance: result,
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

router.post("/addBankUser", (req, res) => {
	let data = new BankUser();
	const { name, email, ccode, mobile, username, password, branch_id, logo, token } = req.body;
	Bank.findOne(
		{
			token,
			status: 1,
		},
		function (err, user) {
			if (err || user == null) {
				res.status(401).json({
					error: "Unauthorized",
				});
			} else {
				data.name = name;
				data.email = email;
				data.mobile = mobile;
				data.username = username;
				data.password = password;
				data.branch_id = branch_id;
				data.bank_id = user._id;
				data.ccode = ccode;
				data.logo = logo;

				data.save((err) => {
					if (err)
						return res.json({
							error: "User ID / Email / Mobile already exists",
						});
					let content =
						"<p>Your have been added as a Bank User in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
						config.mainIP +
						"/cashier/yourBranchName'>http://" +
						config.mainIP +
						"/</a></p><p><p>Your username: " +
						username +
						"</p><p>Your password: " +
						password +
						"</p>";
					sendMail(content, "Bank User Account Created", email);
					let content2 =
						"Your have been added as Bank User in E-Wallet application Login URL: http://" +
						config.mainIP +
						"/cashier/yourBranchName Your username: " +
						username +
						" Your password: " +
						password;
					sendSMS(content2, mobile);
					return res.status(200).json({
						success: "True",
					});
				});
			}
		}
	);
});
router.post("/editBankUser", (req, res) => {
	const {
		name,
		email,
		ccode,
		mobile,
		username,
		password,
		branch_id,
		logo,
		user_id,
		token,
	} = req.body;
	Bank.findOne(
		{
			token,
		},
		function (err, user) {
			if (err || user == null) {
				res.status(401).json({
					error: "Unauthorized",
				});
			} else {
				BankUser.findOneAndUpdate(
					{
						_id: user_id,
					},
					{
						name: name,
						email: email,
						ccode: ccode,
						mobile: mobile,
						username: username,
						password: password,
						branch_id: branch_id,
						logo: logo,
					},
					(err) => {
						if (err)
							return res.status(400).json({
								error: err,
							});

						return res.status(200).json({
							success: true,
						});
					}
				);
			}
		}
	);
});

router.post("/getBankHistory", function (req, res) {
	const { from, token } = req.body;

	Bank.findOne(
		{
			token,
			status: 1,
		},
		function (err, b) {
			if (err || b == null) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else {
				const wallet = from + "@" + b.name;
				getStatement(wallet).then(function (history) {
					FailedTX.find({ wallet_id: wallet }, (err, failed) => {
						if (err) {
							res.status(200).json({
								status: 0,
								message: "Internal server error",
							});
						} else {
							res.status(200).json({
								status: 1,
								history: history,
								failed: failed,
							});
						}
					});
				});
				// });
			}
		}
	);
});

router.post("/addBranch", (req, res) => {
	let data = new Branch();
	const {
		name,
		bcode,
		username,
		credit_limit,
		cash_in_hand,
		address1,
		state,
		zip,
		country,
		ccode,
		mobile,
		email,
		token,
		working_from,
		working_to,
	} = req.body;

	Bank.findOne(
		{
			token,
			status: 1,
		},
		function (err, bank) {
			if (err || bank == null) {
				res.status(401).json({
					error: "Unauthorized",
				});
			} else {
				data.name = name;
				data.bcode = bcode;
				if (credit_limit != "" && credit_limit != null && credit_limit != undefined) {
					data.credit_limit = credit_limit;
				}
				if (cash_in_hand != "" && cash_in_hand != null && cash_in_hand != undefined) {
					data.cash_in_hand = cash_in_hand;
				}
				data.username = username;
				data.address1 = address1;
				data.state = state;
				data.country = country;
				data.zip = zip;
				data.ccode = ccode;
				data.mobile = mobile;
				data.email = email;
				data.bank_id = bank._id;
				data.password = makeid(10);
				data.working_from = working_from;
				data.working_to = working_to;
				let bankName = bank.name;

				data.save((err, d) => {
					if (err)
						return res.json({
							error: err.toString(),
						});
					createWallet([bcode + "_operational@" + bank.name, bcode + "_master@" + bank.name]).then(
						function (result) {
							let content =
								"<p>Your bracnch is added in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
								config.mainIP +
								"/branch/" +
								bankName +
								"'>http://" +
								config.mainIP +
								"/branch/" +
								bankName +
								"</a></p><p><p>Your username: " +
								data.username +
								"</p><p>Your password: " +
								data.password +
								"</p>";
							sendMail(content, "Bank Branch Created", email);
							let content2 =
								"Your branch is added in E-Wallet application Login URL: http://" +
								config.mainIP +
								"/branch/" +
								bankName +
								" Your username: " +
								data.username +
								" Your password: " +
								data.password;
							sendSMS(content2, mobile);
							// return res.status(200).json(data);
							res.status(200).json({
								status: "Branch Created",
								walletStatus: result.toString(),
							});
						}
					);
				});
			}
		}
	);
});

router.post("/addCashier", (req, res) => {
	let data = new Cashier();
	const {
		name,
		branch_id,
		credit_limit,
		bcode,
		working_from,
		working_to,
		per_trans_amt,
		max_trans_amt,
		max_trans_count,
		token,
		cashier_length,
	} = req.body;

	Bank.findOne(
		{
			token,
			status: 1,
		},
		function (err, bank) {
			if (err || bank == null) {
				res.status(401).json({
					error: "Unauthorized",
				});
			} else {
				data.name = name;
				data.bcode = bcode;
				data.credit_limit = credit_limit;
				data.working_from = working_from;
				data.working_to = working_to;
				data.per_trans_amt = per_trans_amt;
				data.max_trans_amt = max_trans_amt;
				data.max_trans_count = max_trans_count;
				data.bank_id = bank._id;
				data.branch_id = branch_id;
				if (cashier_length == 0) {
					data.central = true;
				}

				data.save((err, d) => {
					if (err)
						return res.json({
							error: err.toString(),
						});

					if (cashier_length == 0) {
						Branch.findOne(
							{
								_id: branch_id,
							},
							function (err, branch) {
								let data = new CashierLedger();
								data.amount = branch.cash_in_hand;
								data.cashier_id = d._id;
								data.trans_type = "OB";
								let td = {};
								data.transaction_details = JSON.stringify(td);

								data.save((err) => {
									if (err)
										return res.status(200).json({
											error: err.toString(),
										});
									Cashier.findByIdAndUpdate(
										d._id,
										{
											opening_balance: branch.cash_in_hand,
											cash_in_hand: branch.cash_in_hand,
										},
										(err, d) => {
											Branch.findByIdAndUpdate(
												branch_id,
												{ $inc: { total_cashiers: 1 }, cash_in_hand: 0 },
												function (e, v) {
													return res.status(200).json(data);
												}
											);
										}
									);
								});
							}
						);
					} else {
						Branch.findByIdAndUpdate(branch_id, { $inc: { total_cashiers: 1 } }, function (e, v) {
							return res.status(200).json(data);
						});
					}
				});
			}
		}
	);
});

router.post("/createBankRules", (req, res) => {
	let fee = new Fee();
	const { name, trans_type, active, ranges, token } = req.body;
	Bank.findOne(
		{
			token,
			status: 1,
		},
		function (err, bank) {
			if (err) {
				console.log(err);
				res.status(500).json({
					status: 0,
					error: "Internal Server Error",
				});
			} else if (bank == null) {
				res.status(401).json({
					status: 0,
					error: "Unauthorized",
				});
			} else {
				const bank_id = bank._id;

				fee.bank_id = bank_id;
				fee.name = name;
				fee.trans_type = trans_type;
				fee.active = active;
				fee.status = 0;
				ranges.forEach((range) => {
					var { trans_from, trans_to, fixed_amount, percentage } = range;
					fee.ranges.push({
						trans_from: trans_from,
						trans_to: trans_to,
						fixed_amount: fixed_amount,
						percentage: percentage,
					});
				});

				Fee.findOne(
					{
						trans_type: trans_type,
						bank_id: bank_id,
					},
					function (err, result) {
						if (err) {
							console.log(err);
							res.status(500).json({
								status: 0,
								error: "Internal Server Error",
							});
						} else if (result == null) {
							fee.save((err) => {
								if (err) {
									console.log(err);
									return res.status(500).json({
										status: 0,
										error: "Internal Server Error",
									});
								}
								let content =
									"<p>New fee rule has been added for users of your bank in E-Wallet application</p><p>&nbsp;</p><p>Fee Name: " +
									name +
									"</p>";
								sendMail(content, "New Rule Added", bank.email);
								let content2 =
									"New fee rule has been added for users of your bank in E-Wallet application Fee Name: " +
									name;
								sendSMS(content2, bank.mobile);
								res.status(200).json({
									status: 1,
									message: "Rule created successfully"
								});
							});
						} else {
							res.status(400).json({
								status: 0,
								error: "This rule type already exists for this bank",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/editBankBankRule", (req, res) => {
	const { name, trans_type, active, ranges, token, rule_id } = req.body;
	Bank.findOne(
		{
			token,
			status: 1,
		},
		function (err, bank) {
			if (err) {
				console.log(err);
				res.status(500).json({
					status: 0,
					error: "Internal Server Error",
				});
			}
			if ( bank == null) {
				res.status(403).json({
					status: 0,
					error: "Unauthorized",
				});
			} else {
				Fee.findByIdAndUpdate(
					rule_id,
					{
						name: name,
						trans_type: trans_type,
						active: active,
						ranges: ranges,
					},
					(err) => {
						if (err) {
						console.log(err);
						res.status(500).json({
							status: 0,
							error: "Internal Server Error",
						});
					}
						let content = "<p>Rule " + name + " has been updated, check it out</p>";
						sendMail(content, "Rule Updated", bank.email);
						let content2 = "Rule " + name + " has been updated, check it out";
						sendSMS(content2, bank.mobile);
						res.status(200).json({
							status: 1
						});
					}
				);
			}
		}
	);
});

router.post("/generateBankOTP", function (req, res) {
	let data = new OTP();
	const { token, page, email, mobile, txt } = req.body;
	Bank.findOne(
		{
			token,
			status: 1,
		},
		function (err, user) {
			if (err || user == null) {
				res.status(401).json({
					error: "Unauthorized",
				});
			} else {
				data.user_id = user._id;
				data.otp = makeotp(6);
				data.page = page;
				data.mobile = mobile;
				data.save((err, ot) => {
					if (err)
						return res.json({
							error: err,
						});

					let content = txt + data.otp;
					sendSMS(content, mobile);
					sendMail(content, "OTP", email);

					res.status(200).json({
						id: ot._id,
					});
				});
			}
		}
	);
});

module.exports = router;
