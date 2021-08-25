const express = require("express");
const router = express.Router();

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const makeid = require("./utils/idGenerator");
const makeotp = require("./utils/makeotp");
const getTypeClass = require("./utils/getTypeClass");
const JWTTokenAuth = require("./JWTTokenAuth");
const { errorMessage, catchError } = require("./utils/errorHandler");
const txstate = require("../controllers/transactions/services/states");

//models
const Bank = require("../models/Bank");
const Branch = require("../models/Branch");
const Cashier = require("../models/Cashier");
const CashierSend = require("../models/CashierSend");
const CashierClaim = require("../models/CashierClaim");
const CashierLedger = require("../models/CashierLedger");
const Partner = require("../models/partner/Partner");
const PartnerCashier = require("../models/partner/Cashier");
const PartnerBranch = require("../models/partner/Branch");
const Infra = require("../models/Infra");
const InterBankRule = require("../models/InterBankRule");
const Fee = require("../models/Fee");
const User = require("../models/User");
const NWUser = require("../models/NonWalletUsers");

//controllers
const cashSendTransCntrl = require("../controllers/cashier/interBankSendTransaction");
const cashClaimTransCntrl = require("../controllers/cashier/interBankClaimTransaction");
const userSendTransCntrl = require("../controllers/user/interBankSendTransaction");

router.post(
	"/partnerCashier/interBank/sendToOperational",
	JWTTokenAuth,
	cashSendTransCntrl.partnerSendToOperational
);

router.post(
	"/cashier/interBank/sendToOperational",
	JWTTokenAuth,
	cashSendTransCntrl.cashierSendToOperational
);

router.post("/user/interBank/checkFee", JWTTokenAuth, function (req, res) {
	const { type, amount } = req.body;
	const jwtusername = req.sign_creds.username;
	if (type == "IBWNW" || type == "IBWW") {
		User.findOne(
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
					const find = {
						bank_id: user.bank_id,
						type: type,
						status: 1,
						active: 1,
					};
					InterBankRule.findOne(find, function (err1, rule) {
						let result1 = errorMessage(
							err1,
							rule,
							"Transaction cannot be done at this time"
						);
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							var amnt = Number(amount);
							var fee = 0;
							var range_found = false;
							rule.ranges.map((range) => {
								if (amnt >= range.trans_from && amnt <= range.trans_to) {
									range_found = true;
									fee = (amnt * range.percentage) / 100;
									fee = fee + range.fixed;
								}
							});
							if (range_found) {
								res.status(200).json({
									status: 1,
									message: "Inter Bank " + rule.name + " Fee",
									fee: fee,
								});
							} else {
								res.status(200).json({
									status: 1,
									message: "The amount is not within any range",
								});
							}
						}
					});
				}
			}
		);
	} else {
		res.status(200).json({
			status: 0,
			message: "Invalid rule type",
		});
	}
});

router.post(
	"/user/interBank/sendMoneyToWallet",
	JWTTokenAuth,
	userSendTransCntrl.sendMoneyToWallet
);

router.post(
	"/partnerCashier/interBank/sendMoneyToWallet",
	JWTTokenAuth,
	cashSendTransCntrl.partnerSendMoneyToWallet
);

router.post(
	"/cashier/interBank/sendMoneyToWallet",
	JWTTokenAuth,
	cashSendTransCntrl.cashierSendMoneyToWallet
);

router.post(
	"/user/interBank/sendMoneyToNonWallet",
	JWTTokenAuth,
	userSendTransCntrl.sendMoneyToNonWallet
);

router.post(
	"/partnerCashier/interBank/claimMoney",
	JWTTokenAuth,
	cashClaimTransCntrl.partnerClaimMoney
);

router.post(
	"/partnerCashier/interBank/SendMoneyToNonWallet",
	JWTTokenAuth,
	cashSendTransCntrl.partnerSendMoney
);

router.post(
	"/cashier/interBank/claimMoney",
	JWTTokenAuth,
	cashClaimTransCntrl.cashierClaimMoney
);

router.post(
	"/cashier/interBank/SendMoneyToNonWallet",
	JWTTokenAuth,
	cashSendTransCntrl.cashierSendMoney
);

router.post(
	"/partnerCashier/interBank/checkFee",
	JWTTokenAuth,
	function (req, res) {
		const { type, amount } = req.body;
		const jwtusername = req.sign_creds.username;
		if (type == "IBNWNW" || type == "IBNWW" || type == "IBNWO") {
			PartnerCashier.findOne(
				{
					username: jwtusername,
					status: 1,
				},
				function (err1, cashier) {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message) {
							message1 = err1.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else if (cashier == null) {
						return res.status(200).json({
							status: 0,
							message:
								"Token changed or user not valid. Try to login again or contact system administrator.",
						});
					} else {
						const find = {
							bank_id: cashier.bank_id,
							type: type,
							status: 1,
							active: 1,
						};
						InterBankRule.findOne(find, function (err, rule) {
							if (err2) {
								console.log(err2);
								var message2 = err2;
								if (err2.message) {
									message2 = err2.message;
								}
								res.status(200).json({
									status: 0,
									message: message2,
								});
							} else if (rule == null) {
								return res.status(200).json({
									status: 0,
									message: "Transaction cannot be done at this time",
								});
							} else {
								var amnt = Number(amount);
								var fee = 0;
								var range_found = false;
								rule.ranges.map((range) => {
									if (amnt >= range.trans_from && amnt <= range.trans_to) {
										range_found = true;
										fee = (amnt * range.percentage) / 100;
										fee = fee + range.fixed;
									}
								});
								if (range_found) {
									res.status(200).json({
										status: 1,
										message: "Inter Bank " + rule.name + " Fee",
										fee: fee,
									});
								} else {
									res.status(200).json({
										status: 1,
										message: "The amount is not within any range",
									});
								}
							}
						});
					}
				}
			);
		} else {
			res.status(200).json({
				status: 0,
				message: "Invalid rule type",
			});
		}
	}
);

router.post("/cashier/interBank/checkFee", JWTTokenAuth, function (req, res) {
	const { type, amount } = req.body;
	if (type == "IBNWNW" || type == "IBNWW" || type == "IBNWO") {
		const jwtusername = req.sign_creds.username;
		Cashier.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err, cashier) {
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
				} else if (cashier == null) {
					return res.status(200).json({
						status: 0,
						message:
							"Token changed or user not valid. Try to login again or contact system administrator.",
					});
				} else {
					const find = {
						bank_id: cashier.bank_id,
						type: type,
						status: 1,
						active: 1,
					};
					InterBankRule.findOne(find, function (err1, rule) {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						} else if (rule == null) {
							return res.status(200).json({
								status: 0,
								message: "Transaction cannot be done at this time",
							});
						} else {
							var amnt = Number(amount);
							var fee = 0;
							var range_found = false;
							rule.ranges.map((range) => {
								if (amnt >= range.trans_from && amnt <= range.trans_to) {
									range_found = true;
									fee = (amnt * range.percentage) / 100;
									fee = fee + range.fixed;
								}
							});
							if (range_found) {
								res.status(200).json({
									status: 1,
									message: "Inter Bank " + rule.name + " Fee",
									fee: fee,
									active: rule.active,
									bankid: cashier.bank_id,
								});
							} else {
								res.status(200).json({
									status: 1,
									message: "The amount is not within any range",
								});
							}
						}
					});
				}
			}
		);
	} else {
		res.status(200).json({
			status: 0,
			message: "Invalid rule type",
		});
	}
});

router.post("/bank/interBank/getRules", JWTTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
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
			} else if (bank == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				InterBankRule.find({ bank_id: bank._id }, (err1, rules) => {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message) {
							message1 = err1.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else {
						res.status(200).json({
							status: 1,
							message: "Inter Bank Rules",
							rules: rules,
						});
					}
				});
			}
		}
	);
});

router.post("/infra/interBank/getRules", JWTTokenAuth, function (req, res) {
	const { bank_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
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
			} else if (infra == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				InterBankRule.find(
					{
						bank_id: bank_id,
					},
					(err1, rules) => {
						if (err1) {
							console.log(err1);
							var message1= err1;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						} else {
							rules = rules.map((rule) => {
								if (rule.edit_status == 0) {
									rule["edited"] = undefined;
								}
								return rule;
							});
							res.status(200).json({
								status: 1,
								message: "Inter Bank Fee Rule",
								rules: rules,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/infra/interBank/declineShare", JWTTokenAuth, function (req, res) {
	const { rule_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
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
			} else if (infra == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				InterBankRule.findOneAndUpdate(
					{
						_id: rule_id,
					},
					{
						infra_approval_status: -1,
					},
					(err1, rule) => {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						} else if (rule == null) {
							res.status(200).json({
								status: 0,
								message: "Rule not found.",
							});
						} else {
							Bank.findOne({ _id: rule.bank_id }, (errr, bank) => {
								if (err2) {
									console.log(err2);
									var message2 = err2;
									if (err2.message) {
										message2 = err2.message;
									}
									res.status(200).json({
										status: 0,
										message: message2,
									});
								} else if (rule == null) {
									res.status(200).json({
										status: 0,
										message: "Bank not found.",
									});
								} else {
									var content =
										"Infra has declined the fee rule " +
										rule.name +
										"in Ewallet Application";
									sendMail(content, "Share declined by Infra", bank.email);
									content =
										"Ewallet: Infra has declined the share of fee rule " +
										rule.name;
									sendSMS(content, bank.mobile);
									res.status(200).json({
										status: 1,
										message: "Declined",
									});
								}
							});
						}
					}
				);
			}
		}
	);
});

router.post("/infra/interBank/approveShare", JWTTokenAuth, function (req, res) {
	const { rule_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
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
			} else if (infra == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				InterBankRule.findOne(
					{
						_id: rule_id,
					},
					async (err1, rule) => {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						} else if (rule == null) {
							res.status(200).json({
								status: 0,
								message: "Rule not found.",
							});
						} else {
							try {
								var bank = Bank.findOne({ _id: rule.bank_id });
								if (!bank) {
									throw new Error("Bank not found");
								}
								if (rule.status == 0) {
									await InterBankRule.updateOne(
										{ _id: rule._id },
										{
											status: 1,
											infra_approval_status: 1,
										}
									);
								} else {
									await InterBankRule.updateOne(
										{ _id: rule._id },
										{
											$set: {
												infra_share: rule.edited.infra_share,
												infra_approval_status: 1,
											},
											$unset: {
												edited: {},
											},
										}
									);
								}
							} catch (error) {
								console.log(error);
								var message5 = error.toString();
								if (error.message) {
									message5 = error.message;
								}
								res.status(200).json({ status: 0, message: message5 });
							}
							var content =
								"Infra has approved the share of " +
								rule.name +
								" rule in Ewallet Application";
							sendMail(content, "Share approved by Infra", bank.email);
							content = "Ewallet: Infra has approved the fee rule " + rule.name;
							sendSMS(content, bank.mobile);
							res.status(200).json({
								status: 1,
								message: "Approved",
							});
						}
					}
				);
			}
		}
	);
});

router.post(
	"/bank/interBank/updateOtherBankShares",
	JWTTokenAuth,
	function (req, res) {
		const { rule_id, other_bank_share } = req.body;
		const jwtusername = req.sign_creds.username;
		Bank.findOne(
			{
				username: jwtusername,
				status: 1,
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
				} else if (bank == null) {
					res.status(200).json({
						status: 0,
						message:
							"Token changed or user not valid. Try to login again or contact system administrator.",
					});
				} else {
					InterBankRule.findOneAndUpdate(
						{
							_id: rule_id,
						},
						{
							$set: {
								other_bank_share: other_bank_share,
							},
						},
						(err1, rule) => {
							if (err1) {
								console.log(err1);
								var message1 = err1;
								if (err1.message) {
									message1 = err1.message;
								}
								res.status(200).json({
									status: 0,
									message: message1,
								});
							} else if (rule == null) {
								res.status(200).json({
									status: 0,
									message: "Rule not found.",
								});
							} else {
								res.status(200).json({
									status: 1,
									message:
										"Updated Bank shares in " +
										rule.name +
										" transactions fee rule",
									rule: rule,
								});
							}
						}
					);
				}
			}
		);
	}
);

router.post("/bank/interBank/editRule", JWTTokenAuth, function (req, res) {
	const { rule_id, name, active, description, ranges } = req.body;
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
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
			} else if (bank == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				InterBankRule.findOneAndUpdate(
					{
						_id: rule_id,
					},
					{
						$set: {
							name: name,
							active: active,
							ranges: ranges,
							description: description,
						},
					},
					{ new: true },
					(err1, rule) => {
						if (err1) {
							console.log(err1);
							var message1= err1;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						} else if (rule == null) {
							res.status(200).json({
								status: 0,
								message: "Rule not found.",
							});
						} else {
							let content =
								"<p>Fee Rule for " +
								rule.name +
								" transactions is edited for your bank in E-Wallet application</p><p>&nbsp;</p>";
							sendMail(content, "Fee Rule Edited", bank.email);
							let content2 =
								" E-Wallet: Fee Rule for " +
								rule.name +
								" transactions is edited";
							sendSMS(content2, bank.mobile);

							res.status(200).json({
								status: 1,
								message: "Fee Rule edited successfully",
								rule: rule,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bank/interBank/createRule", JWTTokenAuth, function (req, res) {
	const { name, active, type, ranges, description } = req.body;
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
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
			} else if (bank == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				InterBankRule.findOne({ bank_id: bank._id, type }, (err1, rule) => {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message) {
							message1 = err1.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else if (rule != null) {
						res.status(200).json({
							status: 0,
							message: "Fee Rule already exist.",
						});
					} else {
						let interBankRule = new InterBankRule();
						interBankRule.name = name;
						interBankRule.bank_id = bank._id;
						interBankRule.active = active;
						interBankRule.type = type;
						interBankRule.description = description;
						ranges.forEach((range) => {
							var { trans_from, trans_to, fixed, percentage } = range;
							interBankRule.ranges.push({
								trans_from: trans_from,
								trans_to: trans_to,
								fixed: fixed,
								percentage: percentage,
							});
						});
						interBankRule.save((err2) => {
							if (err2) {
								console.log(err2);
								var message2 = err2;
								if (err2.message) {
									message2 = err2.message;
								}
								res.status(200).json({
									status: 0,
									message: message2,
								});
							} else {
								let content =
									"<p>An Inter Bank fee rule for " +
									name +
									" transactions is added in E-Wallet application</p><p>&nbsp;</p>";
								sendMail(content, "New Fee Rule Added", bank.email);
								let content2 =
									" E-Wallet: An Inter Bank fee rule for " +
									name +
									" transactions is added";
								sendSMS(content2, bank.mobile);

								res.status(200).json({
									status: 1,
									message:
										"Inter Bank Rule for " + name + " created successfully",
									rule: interBankRule,
								});
							}
						});
					}
				});
			}
		}
	);
});

router.post(
	"/bank/interBank/sendShareForApproval",
	JWTTokenAuth,
	function (req, res) {
		const { rule_id, infra_share } = req.body;
		const jwtusername = req.sign_creds.username;
		Bank.findOne(
			{
				username: jwtusername,
				status: 1,
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
				} else if (bank == null) {
					res.status(200).json({
						status: 0,
						message:
							"Token changed or user not valid. Try to login again or contact system administrator.",
					});
				} else {
					Infra.findById({ _id: bank.user_id }, (errr, infra) => {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						} else if (infra == null) {
							res.status(200).json({
								status: 0,
								message:
									"Token changed or user not valid. Try to login again or contact system administrator.",
							});
						} else {
							InterBankRule.findOneAndUpdate(
								{
									_id: rule_id,
								},
								{ new: true },
								async (err2, rule) => {
									if (err2) {
										console.log(err2);
										var message2 = err2;
										if (err2.message) {
											message2 = err2.message;
										}
										res.status(200).json({
											status: 0,
											message: message2,
										});
									} else if (rule == null) {
										res.status(200).json({
											status: 0,
											message: "Infra share can not be added.",
										});
									} else {
										try {
											if (rule.status == 0) {
												rule = await InterBankRule.findOneAndUpdate(
													{ _id: rule_id },
													{
														infra_share: infra_share,
														infra_approval_status: 2,
													},
													{ new: true }
												);
											} else {
												rule = await InterBankRule.findOneAndUpdate(
													{ _id: rule_id },
													{
														"edited.infra_share": infra_share,
														infra_approval_status: 2,
													},
													{ new: true }
												);
											}
											let content =
												"<p>Share of an Inter Bank fee rule for " +
												rule.name +
												" transactions is sent for approval in E-Wallet application</p><p>&nbsp;</p>";
											sendMail(content, "Waiting for approval", infra.email);
											let content2 =
												" E-Wallet: Share of an Inter Bank fee rule for " +
												rule.name +
												" transactions needs approval";
											sendSMS(content2, infra.mobile);
											res.status(200).json({
												status: 1,
												message:
													"Inter Bank " + rule.name + " Rule sent for approval",
												rule: rule,
											});
										} catch (error) {
											console.log(error);
											var message5 = error.toString();
											if (error && error.message) {
												message5 = error.message;
											}
											res
												.status(200)
												.json({ status: 0, message: message5, err: error });
										}
									}
								}
							);
						}
					});
				}
			}
		);
	}
);

module.exports = router;
