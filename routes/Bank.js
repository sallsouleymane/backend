const express = require("express");
const router = express.Router();
const config = require("../config.json");

//utils
const makeid = require("./utils/idGenerator");
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const makeotp = require("./utils/makeotp");
const getWalletIds = require("./utils/getWalletIds");
const jwtTokenAuth = require("./JWTTokenAuth");
const { errorMessage, catchError } = require("./utils/errorHandler");

//services
const {
	createWallet,
	getStatement,
	getBalance,
	initiateTransfer,
} = require("../services/Blockchain.js");

const Bank = require("../models/Bank");
const OTP = require("../models/OTP");
const Branch = require("../models/Branch");
const BankUser = require("../models/BankUser");
const Cashier = require("../models/Cashier");
const Fee = require("../models/Fee");
const CashierLedger = require("../models/CashierLedger");
const Merchant = require("../models/merchant/Merchant");
const FailedTX = require("../models/FailedTXLedger");
const Partner = require("../models/partner/Partner");
const Document = require("../models/Document");
const Infra = require("../models/Infra");

<<<<<<< HEAD
router.post("/bank/getMerchantById",jwtTokenAuth, function (req, res) {
=======
router.post("/bank/getMerchantById", jwtTokenAuth, function (req, res) {
>>>>>>> e8ae0cef567bb59e2b3c78be5bebec4bbd7c1a52
	const jwtusername = req.sign_creds.username;
	const { merchant_id } = req.body;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			let result = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Merchant.findOne(
					{ _id: merchant_id, bank_id: bank._id },
					(err, merchant) => {
						let result = errorMessage(err, merchant, "Merchant not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							res.status(200).json({
								status: 1,
								merchant: merchant,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bank/getMyWalletIds", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			let result = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				res.status(200).json({ status: 1, wallet_ids: bank.wallet_ids });
			}
		}
	);
});

router.post("/bank/generateOTP", jwtTokenAuth, function (req, res) {
	let data = new OTP();
	const { username, page, name, email, mobile, code } = req.body;
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			let result = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				data.user_id = bank._id;
				data.otp = makeotp(6);
				data.page = page;
				if (page == "editPartner") {
					Partner.findOne(
						{
							username,
						},
						function (err, partner) {
							data.mobile = partner.mobile;
							data.save((err, ot) => {
								if (err) {
									console.log(err);
									var message = err;
									if (err.message) {
										message = err.message;
									}
									res.status(200).json({
										status: 0,
										message: message,
									});
								} else {
									let content = "Your OTP to edit Partner is " + data.otp;
									sendSMS(content, partner.mobile);
									sendMail(content, "OTP", partner.email);

									res.status(200).json({
										status: 1,
										id: ot._id,
									});
								}
							});
						}
					);
				} else {
					Partner.find(
						{
							$or: [
								{ name: name },
								{ email: email },
								{ mobile: mobile },
								{ code: code },
							],
						},
						function (err, partner) {
							if (
								partner == null ||
								partner == undefined ||
								partner.length == 0
							) {
								data.mobile = bank.mobile;

								data.save((err, ot) => {
									if (err) {
										console.log(err);
										var message = err;
										if (err.message) {
											message = err.message;
										}
										res.status(200).json({
											status: 0,
											message: message,
										});
									} else {
										let content = "Your OTP to add Partner is " + data.otp;
										sendSMS(content, bank.mobile);
										sendMail(content, "OTP", bank.email);

										res.status(200).json({
											status: 1,
											id: ot._id,
										});
									}
								});
							} else {
								if (name == partner[0].name) {
									res.status(200).json({
										status: 0,
										message: "Name already taken",
									});
								} else if (email == partner[0].email) {
									res.status(200).json({
										status: 0,
										message: "Email already taken",
									});
								} else if (mobile == partner[0].mobile) {
									res.status(200).json({
										status: 0,
										message: "Mobile already taken",
									});
								} else if (code == partner[0].code) {
									res.status(200).json({
										status: 0,
										message: "Code already taken",
									});
								} else {
									res.status(200).json({
										status: 0,
										message: "Duplicate entry",
									});
								}
							}
						}
					);
				}
			}
		}
	);
});

router.post(
	"/getRevenueFeeFromBankFeeId/:bankFeeId",
	jwtTokenAuth,
	async function (req, res) {
		try {
			const jwtusername = req.sign_creds.username;
			var result = await Bank.findOne({ username: jwtusername, status: 1 });
			if (result == null) {
				throw new Error(
					"Token changed or user not valid. Try to login again or contact system administrator."
				);
			}
			const fee = await Fee.findById(req.params.bankFeeId);
			if (fee == null) throw new Error("No Fee Rule found");

			res.send({
				status: 1,
				fee: fee.revenue_sharing_rule,
				infra_status: fee.status,
			});
		} catch (err) {
			return catchError(err);
		}
	}
);

router.post(
	"/bank/getRevenueFeeForInterBank",
	jwtTokenAuth,
	async function (req, res) {
		try {
			const { type } = req.body;
			const jwtusername = req.sign_creds.username;
			var bank = await Bank.findOne({ username: jwtusername, status: 1 });
			if (bank == null) {
				throw new Error(
					"Token changed or user not valid. Try to login again or contact system administrator."
				);
			}
			var ib_type;
			if (type == "IBNWNW") {
				ib_type = "Non Wallet to Non Wallet";
			} else if (type == "IBWNW") {
				ib_type = "Wallet to Non Wallet";
			} else if (type == "IBWW") {
				ib_type = "Wallet to Wallet";
			} else if (type == "IBNWW") {
				ib_type = "Non Wallet to Wallet";
			} else if (type == "IBNWW") {
				ib_type = "Non Wallet to Wallet";
			} else if (type == "IBNWO") {
				ib_type = "Non Wallet to Operational";
			} else {
				res.status(200).json({
					status: 0,
					message: "Interbank rule type not supported.",
				});
			}
			const fee = await Fee.findOne({ trans_type: ib_type, bank_id: bank._id });
			if (fee == null) throw new Error("No Fee Rule found");

			res.send({
				status: 1,
				fee: fee.revenue_sharing_rule,
				infra_status: fee.status,
			});
		} catch (err) {
			return catchError(err);
		}
	}
);

router.post(
	"/bank/updateRevenueSharingRules",
	jwtTokenAuth,
	async function (req, res) {
		try {
			const { type, revenue_sharing_rule } = req.body;
			const jwtusername = req.sign_creds.username;
			var bank = await Bank.findOne({ username: jwtusername, status: 1 });
			if (bank == null) {
				throw new Error("Token is invalid");
			}
			var ib_type;
			if (type == "IBNWNW") {
				ib_type = "Non Wallet to Non Wallet";
			} else if (type == "IBWNW") {
				ib_type = "Wallet to Non Wallet";
			} else if (type == "IBWW") {
				ib_type = "Wallet to Wallet";
			} else if (type == "IBNWW") {
				ib_type = "Non Wallet to Wallet";
			} else if (type == "IBNWO") {
				ib_type = "Non Wallet to Operational";
			} else {
				res.status(200).json({
					status: 0,
					message: "Interbank rule type not supported.",
				});
			}
			result = await Fee.findOneAndUpdate(
				{
					trans_type: ib_type,
					bank_id: bank._id,
				},
				{
					$set: {
						"revenue_sharing_rule.branch_share.claim":
							revenue_sharing_rule.branch_share.claim,
						"revenue_sharing_rule.branch_share.send":
							revenue_sharing_rule.branch_share.send,
						"revenue_sharing_rule.specific_branch_share":
							revenue_sharing_rule.specific_branch_share,
						"revenue_sharing_rule.partner_share.claim":
							revenue_sharing_rule.partner_share.claim,
						"revenue_sharing_rule.partner_share.send":
							revenue_sharing_rule.partner_share.send,
						"revenue_sharing_rule.specific_partner_share":
							revenue_sharing_rule.specific_partner_share,
					},
				}
			);
			if (result == null) {
				throw new Error("Not Found");
			}

			res.send({ status: 1 });
		} catch (err) {
			return catchError(err);
		}
	}
);

router.post(
	"/save-revenue-sharing-rules/:id",
	jwtTokenAuth,
	async function (req, res) {
		try {
			const { revenue_sharing_rule } = req.body;
			const { id } = req.params;
			const jwtusername = req.sign_creds.username;
			var result = await Bank.findOne({ username: jwtusername, status: 1 });
			if (result == null) {
				throw new Error("Token is invalid");
			}
			result = await Fee.updateOne(
				{ _id: id },
				{
					$set: {
						"revenue_sharing_rule.branch_share.claim":
							revenue_sharing_rule.branch_share.claim,
						"revenue_sharing_rule.branch_share.send":
							revenue_sharing_rule.branch_share.send,
						"revenue_sharing_rule.specific_branch_share":
							revenue_sharing_rule.specific_branch_share,
						"revenue_sharing_rule.partner_share.claim":
							revenue_sharing_rule.partner_share.claim,
						"revenue_sharing_rule.partner_share.send":
							revenue_sharing_rule.partner_share.send,
						"revenue_sharing_rule.specific_partner_share":
							revenue_sharing_rule.specific_partner_share,
					},
				}
			);
			if (result == null) {
				throw new Error("Not Found");
			}

			res.send({ status: 1, message: "Revenue share updated successfully" });
		} catch (err) {
			return catchError(err);
		}
	}
);

router.post("/bank/sendShareForApproval", jwtTokenAuth, function (req, res) {
	const { trans_type, percentage, fixed } = req.body;
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			let result = errorMessage(err, bank, "Token is invalid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Fee.findOneAndUpdate(
					{
						trans_type: trans_type,
						bank_id: bank._id.toString(),
					},
					{
						$set: {
							status: 2,
							"revenue_sharing_rule.infra_share.fixed": fixed,
							"revenue_sharing_rule.infra_share.percentage": percentage,
						},
					},
					function (err, fee) {
						let result = errorMessage(
							err,
							fee,
							"Bank's fee rule not found of transaction type " + trans_type
						);
						if (result.status == 0) {
							res.status(200).json(result);
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
								status: 1,
								message: "Share is sent for approval to infra",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bankSetupUpdate", jwtTokenAuth, function (req, res) {
	const { username, password } = req.body;
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
		},
		function (err, bank) {
			let result = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.findByIdAndUpdate(
					bank._id,
					{
						username: username,
						password: password,
						initial_setup: true,
					},
					(err) => {
						if (err) {
							console.log(err);
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else {
							res.status(200).json({
								status: 1,
								success: "Updated successfully",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bankActivate", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
		},
		function (err, bank) {
			if (err) {
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (!bank) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Infra.findOne({ _id: bank.user_id }, (err, infra) => {
					if (err) {
						console.log(err);
						var message = err;
						if (err.message) {
							message = err.message;
						}
						res.status(200).json({
							status: 0,
							message: message,
						});
					} else if (!infra) {
						res.status(200).json({
							status: 0,
							message: "Infra not found.",
						});
					} else {
						const bank_wallet_ids = getWalletIds(
							"bank",
							bank.bcode,
							bank.bcode
						);
						const infra_wallet_ids = getWalletIds(
							"infra",
							infra.username,
							bank.bcode
						);
						createWallet([
							bank_wallet_ids.operational,
							bank_wallet_ids.escrow,
							bank_wallet_ids.master,
							infra_wallet_ids.operational,
							infra_wallet_ids.master,
						])
							.then(function (result) {
								if (result != "" && !result.includes("wallet already exists")) {
									console.log(result);
									res.status(200).json({
										status: 0,
										message:
											"Blockchain service was unavailable. Please try again.",
										result: result,
									});
								} else {
									Bank.findByIdAndUpdate(
										bank._id,
										{
											status: 1,
											wallet_ids: {
												operational: bank_wallet_ids.operational,
												master: bank_wallet_ids.master,
												escrow: bank_wallet_ids.escrow,
												infra_operational: infra_wallet_ids.operational,
												infra_master: infra_wallet_ids.master,
											},
										},
										(err) => {
											if (err) {
												console.log(err);
												var message = err;
												if (err.message) {
													message = err.message;
												}
												res.status(200).json({
													status: 0,
													message: message,
												});
											} else {
												res.status(200).json({
													status: 1,
													walletStatus: result,
												});
											}
										}
									);
								}
							})
							.catch((err) => {
								console.log(err);
								let message = err;
								if (err && err.message) {
									message = err.message;
								}
								res.status(200).json({
									status: 0,
									message: message,
								});
							});
					}
				});
			}
		}
	);
});

router.post("/getBankDashStats", jwtTokenAuth, function (req, res) {
	try {
		const jwtusername = req.sign_creds.username;
		Bank.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			async function (err, user) {
				let result = errorMessage(
					err,
					user,
					"Token changed or user not valid. Try to login again or contact system administrator."
				);
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					const user_id = user._id;
					var branchCount = await Branch.countDocuments({
						bank_id: user_id,
					});
					var merchantCount = await Merchant.countDocuments({
						bank_id: user_id,
					});

					res.status(200).json({
						status: 1,
						totalBranches: branchCount,
						totalMerchants: merchantCount,
					});
				}
			}
		);
	} catch (err) {
		return catchError(err);
	}
});

router.get("/getBankOperationalBalance", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, ba) {
			let result = errorMessage(
				err,
				ba,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const wallet_id = ba.wallet_ids.operational;

				getBalance(wallet_id)
					.then(function (result) {
						res.status(200).json({
							status: 1,
							balance: result,
						});
					})
					.catch((err) => {
						return catchError(err);
					});
			}
		}
	);
});

router.post("/getBranches", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			let result = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const bank_id = bank._id;
				Branch.find({ bank_id: bank_id }, function (err, branch) {
					if (err) {
						console.log(err);
						var message = err;
						if (err.message) {
							message = err.message;
						}
						res.status(200).json({
							status: 0,
							message: message,
						});
					} else {
						res.status(200).json({
							status: 1,
							branches: branch,
						});
					}
				});
			}
		}
	);
});

router.post("/getBankUsers", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const user_id = user._id;
				BankUser.find(
					{
						bank_id: user_id,
					},
					function (err, bank) {
						if (err) {
							console.log(err);
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else {
							res.status(200).json({
								status: 1,
								users: bank,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/addBranch", jwtTokenAuth, function (req, res) {
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
		working_from,
		working_to,
	} = req.body;

	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			let result = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const wallet_ids = getWalletIds("branch", bcode, bank.bcode);
				createWallet([wallet_ids.operational, wallet_ids.master])
					.then(function (result) {
						if (result != "" && !result.includes("wallet already exists")) {
							console.log(result);
							res.status(200).json({
								status: 0,
								message:
									"Blockchain service was unavailable. Please try again.",
								result: result,
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
							data.wallet_ids.operational = wallet_ids.operational;
							data.wallet_ids.master = wallet_ids.master;
							let bankName = bank.name;

							data.save((err) => {
								if (err) {
									console.log(err);
									var message = err;
									if (err.message) {
										message = err.message;
									}
									res.status(200).json({
										status: 0,
										message: message,
									});
								} else {
									Bank.updateOne(
										{ _id: bank._id },
										{ $inc: { total_branches: 1 } },
										(err) => {
											if (err) {
												console.log(err);
												var message = err;
												if (err.message) {
													message = err.message;
												}
												res.status(200).json({
													status: 0,
													message: message,
												});
											} else {
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
												res.status(200).json({
													status: 1,
													message: "Branch Created",
													walletStatus: result.toString(),
												});
											}
										}
									);
								}
							});
						}
					})
					.catch((err) => {
						console.log(err);
						res.status(200).json({
							status: 0,
							message: err.message,
						});
					});
			}
		}
	);
});

router.post("/editBranch", jwtTokenAuth, function (req, res) {
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
		working_from,
		working_to,
	} = req.body;

	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
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
						if (err) {
							console.log(err);
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else {
							res.status(200).json({
								status: 1,
								message: "Branch edited successfully",
								data: data,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/branchStatus", jwtTokenAuth, function (req, res) {
	const { status, branch_id } = req.body;

	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Branch.findByIdAndUpdate(
					branch_id,
					{
						status: status,
					},
					(err) => {
						if (err) {
							console.log(err);
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else {
							res.status(200).json({
								status: 1,
								message: "Branch status updated",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/addBankUser", jwtTokenAuth, function (req, res) {
	let data = new BankUser();
	const {
		name,
		email,
		ccode,
		mobile,
		username,
		password,
		branch_id,
		logo,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
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
					if (err) {
						console.log(err);
						var message = err;
						if (err.message) {
							message = err.message;
						}
						res.status(200).json({
							status: 0,
							message: message,
						});
					} else {
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
						res.status(200).json({
							status: 1,
							message: "Added bank user successfully.",
						});
					}
				});
			}
		}
	);
});

router.post("/editBankUser", jwtTokenAuth, function (req, res) {
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
	} = req.body;

	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
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
						if (err) {
							console.log(err);
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else {
							res.status(200).json({
								status: 1,
								message: "Bank user edited sucessfully.",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/getBankHistory", jwtTokenAuth, function (req, res) {
	const { from } = req.body;

	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, b) {
			let result = errorMessage(
				err,
				b,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const wallet = b.wallet_ids[from];
				getStatement(wallet)
					.then(function (history) {
						FailedTX.find({ wallet_id: wallet }, (err, failed) => {
							if (err) {
								console.log(err);
								var message = err;
								if (err.message) {
									message = err.message;
								}
								res.status(200).json({
									status: 0,
									message: message,
								});
							} else {
								res.status(200).json({
									status: 1,
									history: history,
									failed: failed,
								});
							}
						});
					})
					.catch((err) => {
						return catchError(err);
					});
			}
		}
	);
});

router.post("/addCashier", jwtTokenAuth, function (req, res) {
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
		cashier_length,
	} = req.body;

	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			let result = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
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
					if (err) {
						console.log(err);
						var message = err;
						if (err.message) {
							message = err.message;
						}
						res.status(200).json({
							status: 0,
							message: message,
						});
					} else {
						if (cashier_length == 0) {
							Branch.findOne(
								{
									_id: branch_id,
								},
								function (err, branch) {
									let result = errorMessage(err, branch, message);
									if (result.status == 0) {
										res.status(200).json(result);
									} else {
										let data = new CashierLedger();
										data.amount = branch.cash_in_hand;
										data.cashier_id = d._id;
										data.trans_type = "OB";
										let td = {};
										data.transaction_details = JSON.stringify(td);

										data.save((err) => {
											if (err) {
												console.log(err);
												var message = err;
												if (err.message) {
													message = err.message;
												}
												res.status(200).json({
													status: 0,
													message: message,
												});
											} else {
												Bank.updateOne(
													{ _id: bank._id },
													{ $inc: { total_cashiers: 1 } },
													(err) => {
														if (err) {
															console.log(err);
															var message = err;
															if (err.message) {
																message = err.message;
															}
															res.status(200).json({
																status: 0,
																message: message,
															});
														} else {
															Cashier.findByIdAndUpdate(
																d._id,
																{
																	opening_balance: branch.cash_in_hand,
																	cash_in_hand: branch.cash_in_hand,
																},
																(err) => {
																	if (err) {
																		console.log(err);
																		var message = err;
																		if (err.message) {
																			message = err.message;
																		}
																		res.status(200).json({
																			status: 0,
																			message: message,
																		});
																	} else {
																		Branch.findByIdAndUpdate(
																			branch_id,
																			{
																				$inc: { total_cashiers: 1 },
																				cash_in_hand: 0,
																			},
																			function (err) {
																				if (err) {
																					console.log(err);
																					var message = err;
																					if (err.message) {
																						message = err.message;
																					}
																					res.status(200).json({
																						status: 0,
																						message: message,
																					});
																				} else {
																					res.status(200).json({
																						status: 1,
																						data: data,
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
											}
										});
									}
								}
							);
						} else {
							Bank.updateOne(
								{ _id: bank._id },
								{ $inc: { total_cashiers: 1 } },
								(err) => {
									if (err) {
										console.log(err);
										var message = err;
										if (err.message) {
											message = err.message;
										}
										res.status(200).json({
											status: 0,
											message: message,
										});
									} else {
										Branch.findByIdAndUpdate(
											branch_id,
											{ $inc: { total_cashiers: 1 } },
											function (e) {
												res.status(200).json({
													status: 1,
													data: data,
												});
											}
										);
									}
								}
							);
						}
					}
				});
			}
		}
	);
});

router.post("/createBankRules", jwtTokenAuth, function (req, res) {
	let fee = new Fee();
	const { name, trans_type, active, ranges } = req.body;
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			let result = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const bank_id = bank._id;

				fee.bank_id = bank_id;
				fee.name = name;
				fee.trans_type = trans_type;
				fee.active = active;
				fee.status = 0;
				ranges.forEach((range) => {
					var { trans_from, trans_to, fixed, percentage } = range;
					fee.ranges.push({
						trans_from: trans_from,
						trans_to: trans_to,
						fixed: fixed,
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
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else if (result == null) {
							fee.save((err) => {
								if (err) {
									console.log(err);
									var message = err;
									if (err.message) {
										message = err.message;
									}
									res.status(200).json({
										status: 0,
										message: message,
									});
								} else {
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
										message: "Rule created successfully",
									});
								}
							});
						} else {
							res.status(200).json({
								status: 0,
								message: "This rule type already exists for this bank",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/editBankBankRule", jwtTokenAuth, function (req, res) {
	const { name, trans_type, active, ranges, rule_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			let result = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
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
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else {
							let content =
								"<p>Rule " + name + " has been updated, check it out</p>";
							sendMail(content, "Rule Updated", bank.email);
							let content2 = "Rule " + name + " has been updated, check it out";
							sendSMS(content2, bank.mobile);
							res.status(200).json({
								status: 1,
								message: "Bank fee rule edited successfully",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/generateBankOTP", jwtTokenAuth, function (req, res) {
	let data = new OTP();
	const { page, email, mobile, txt } = req.body;
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				data.user_id = user._id;
				data.otp = makeotp(6);
				data.page = page;
				data.mobile = mobile;
				data.save((err, ot) => {
					if (err) {
						console.log(err);
						var message = err;
						if (err.message) {
							message = err.message;
						}
						res.status(200).json({
							status: 0,
							message: message,
						});
					} else {
						let content = txt + data.otp;
						sendSMS(content, mobile);
						sendMail(content, "OTP", email);

						res.status(200).json({
							status: 1,
							id: ot._id,
						});
					}
				});
			}
		}
	);
});

module.exports = router;
