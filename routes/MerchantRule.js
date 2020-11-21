const express = require("express");
const router = express.Router();

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const getTypeClass = require("./utils/getTypeClass");
const { errorMessage, catchError } = require("./utils/errorHandler");

const Bank = require("../models/Bank");
const Infra = require("../models/Infra");
const MerchantRule = require("../models/merchant/MerchantRule");
const IBMerchantRule = require("../models/merchant/InterBankRule");
const Merchant = require("../models/merchant/Merchant");
const MerchantPosition = require("../models/merchant/Position");
const Cashier = require("../models/Cashier");
const User = require("../models/User");
const PartnerCashier = require("../models/partner/Cashier");

const jwtTokenAuth = require("./JWTTokenAuth");

router.post(
	"/:user/merchantRule/updateSharesForInterBank",
	async (req, res) => {
		try {
			const {
				token,
				type,
				merchant_id,
				branch_share,
				specific_branch_share,
				partner_share,
				specific_partner_share,
			} = req.body;

			const user = req.params.user;

			const Coll = getTypeClass(user);
			var data = await Coll.findOne({ token: token });
			if (data == null) {
				throw new Error("Token is invalid");
			}
			var ib_type;
			if (type == "IBNWM-F") {
				ib_type = "NWM-F";
			} else if (type == "IBNWM-C") {
				ib_type = "NWM-C";
			} else if (type == "IBWM-F") {
				ib_type = "WM-F";
			} else if (type == "IBWM-C") {
				ib_type = "WM-C";
			} else {
				throw new Error("Unknown fee rule type");
			}
			result = await MerchantRule.findOneAndUpdate(
				{
					type: ib_type,
					merchant_id: merchant_id,
				},
				{
					$set: {
						branch_share: branch_share,
						specific_branch_share: specific_branch_share,
						partner_share: partner_share,
						specific_partner_share: specific_partner_share,
					},
				}
			);
			if (result == null) {
				throw new Error("Fee rule Not Found");
			}

			res.send({ status: 1, message: "Fee rule updated successfully." });
		} catch (err) {
			res.send({ status: 0, message: err.message });
		}
	}
);

router.post(
	"/:user/merchantRule/getRevenueShareForInterBank",
	async (req, res) => {
		try {
			const { token, type, merchant_id } = req.body;
			const user = req.params.user;

			const Coll = getTypeClass(user);
			var data = await Coll.findOne({ token: token });
			if (data == null) {
				throw new Error("Token is invalid");
			}

			var ib_type;
			if (type == "IBNWM-F") {
				ib_type = "NWM-F";
			} else if (type == "IBNWM-C") {
				ib_type = "NWM-C";
			} else if (type == "IBWM-F") {
				ib_type = "WM-F";
			} else if (type == "IBWM-C") {
				ib_type = "WM-C";
			}
			const fee = await MerchantRule.findOne({
				type: ib_type,
				merchant_id: merchant_id,
			});
			if (fee == null) throw new Error("No Fee Rule found");

			res.send({
				status: 1,
				branch_share: fee.branch_share,
				partner_share: fee.partner_share,
				specific_branch_share: fee.specific_branch_share,
				specific_partner_share: fee.specific_partner_share,
			});
		} catch (err) {
			res.status(200).send({ status: 0, message: err.message });
		}
	}
);

router.post("/cashier/interBank/checkMerchantFee", (req, res) => {
	var { token, merchant_id, amount } = req.body;
	Cashier.findOne(
		{
			token,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				IBMerchantRule.findOne(
					{ merchant_id: merchant_id, type: "IBNWM-F", status: 1 },
					(err, rule) => {
						let result = errorMessage(err, rule, "Fee rule not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							amount = Number(amount);
							var charge = 0;
							var range_found = false;
							rule.ranges.map((range) => {
								if (amount >= range.trans_from && amount <= range.trans_to) {
									range_found = true;
									charge = (amount * range.percentage) / 100;
									charge = charge + range.fixed;
								}
							});
							if (range_found) {
								res.status(200).json({
									status: 1,
									message: "Inter Bank Non Wallet to Merchant fee",
									fee: charge,
								});
							} else {
								res.status(200).json({
									status: 1,
									message: "The amount is not within any range",
								});
							}
						}
					}
				);
			}
		}
	);
});

router.post("/user/interBank/checkMerchantFee", jwtTokenAuth, (req, res) => {
	var { merchant_id, amount } = req.body;
	const jwtusername = req.sign_creds.username;
	console.log(jwtusername);
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
				IBMerchantRule.findOne(
					{ merchant_id: merchant_id, type: "IBWM-F", status: 1 },
					(err, rule) => {
						let result = errorMessage(
							err,
							rule,
							"Inter Bank Fee rule not found"
						);
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							amount = Number(amount);
							var charge = 0;
							var range_found = false;
							rule.ranges.map((range) => {
								if (amount >= range.trans_from && amount <= range.trans_to) {
									range_found = true;
									charge = (amount * range.percentage) / 100;
									charge = charge + range.fixed;
								}
							});
							if (range_found) {
								res.status(200).json({
									status: 1,
									message: "Inter Bank Wallet to Merchant fee",
									fee: charge,
								});
							} else {
								res.status(200).json({
									status: 1,
									message: "The amount is not within any range",
								});
							}
						}
					}
				);
			}
		}
	);
});

router.post(
	"/partnerCashier/interBank/checkMerchantFee",
	jwtTokenAuth,
	(req, res) => {
		var { merchant_id, amount } = req.body;
		const jwtusername = req.sign_creds.username;
		PartnerCashier.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err, cashier) {
				let result = errorMessage(
					err,
					cashier,
					"Token changed or user not valid. Try to login again or contact system administrator."
				);
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					IBMerchantRule.findOne(
						{ merchant_id: merchant_id, type: "IBNWM-F", status: 1 },
						(err, rule) => {
							let result = errorMessage(err, rule, "Fee rule not found");
							if (result.status == 0) {
								res.status(200).json(result);
							} else {
								amount = Number(amount);
								var charge = 0;
								var range_found = false;
								rule.ranges.map((range) => {
									if (amount >= range.trans_from && amount <= range.trans_to) {
										range_found = true;
										charge = (amount * range.percentage) / 100;
										charge = charge + range.fixed;
									}
								});
								if (range_found) {
									res.status(200).json({
										status: 1,
										message: "Non Wallet to Merchant fee",
										fee: charge,
									});
								} else {
									res.status(200).json({
										status: 1,
										message: "The amount is not within any range",
									});
								}
							}
						}
					);
				}
			}
		);
	}
);

router.post("/merchant/merchantRule/interBank/approve", jwtTokenAuth, function (
	req,
	res
) {
	const { rule_id } = req.body;
	const username = req.sign_creds.username;
	Merchant.findOne(
		{
			username,
			status: 1,
		},
		function (err, merchant) {
			let result = errorMessage(
				err,
				merchant,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.findOne({ _id: merchant.bank_id }, (err, bank) => {
					let result = errorMessage(err, bank, "Merchant's bank not found.");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						IBMerchantRule.findOne(
							{
								_id: rule_id,
								$or: [
									{ merchant_approve_status: 0 },
									{ "edited.merchant_approve_status": 0 },
								],
							},
							(err, rule) => {
								let result = errorMessage(
									err,
									rule,
									"Merchant Rule not found."
								);
								if (result.status == 0) {
									res.status(200).json(result);
								} else {
									if (rule.rule_edit_status == 1) {
										console.log("Condition 1");
										IBMerchantRule.updateOne(
											{
												_id: rule_id,
											},
											{
												$set: {
													"edited.merchant_approve_status": 1,
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
													var content =
														"Merchant " +
														merchant.name +
														" has approved the rule " +
														rule.name +
														"in Ewallet Application";
													sendMail(
														content,
														"Rule approved by merchant",
														bank.email
													);
													content =
														"Ewallet: Merchant " +
														merchant.name +
														" has approved the rule " +
														rule.name;
													sendSMS(content, bank.mobile);
													res.status(200).json({
														status: 1,
														message: "Approved",
													});
												}
											}
										);
									} else {
										console.log("Condition 2");
										IBMerchantRule.updateOne(
											{
												_id: rule_id,
											},
											{
												$set: {
													merchant_approve_status: 1,
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
													var content =
														"Merchant " +
														merchant.name +
														" has approved the rule rule " +
														rule.name +
														"in Ewallet Application";
													sendMail(
														content,
														"Rule rule approved by merchant",
														bank.email
													);
													content =
														"Ewallet: Merchant " +
														merchant.name +
														" has approved the rule rule " +
														rule.name;
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
							}
						);
					}
				});
			}
		}
	);
});

router.post("/merchant/merchantRule/interBank/decline", jwtTokenAuth, function (
	req,
	res
) {
	const { rule_id } = req.body;
	const username = req.sign_creds.username;
	Merchant.findOne(
		{
			username,
			status: 1,
		},
		function (err, merchant) {
			let result = errorMessage(
				err,
				merchant,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				IBMerchantRule.findOne(
					{
						_id: rule_id,
						$or: [
							{ merchant_approve_status: 0 },
							{ "edited.merchant_approve_status": 0 },
						],
					},
					(err, rule) => {
						let result = errorMessage(err, rule, "MerchantRule not found.");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							if (rule.rule_edit_status == 1) {
								console.log("Condition 1");
								IBMerchantRule.updateOne(
									{
										_id: rule_id,
									},
									{
										$set: {
											"edited.merchant_approve_status": 2,
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
										}
									}
								);
							} else {
								console.log("Condition 2");
								IBMerchantRule.updateOne(
									{
										_id: rule_id,
									},
									{
										$set: {
											merchant_approve_status: 2,
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
										}
									}
								);
							}
							res.status(200).json({
								status: 1,
								message: "Declined",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/infra/merchantRule/interBank/approve", function (req, res) {
	const { token, rule_id } = req.body;
	Infra.findOne(
		{
			token,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				try {
					IBMerchantRule.findOne(
						{
							_id: rule_id,
							$or: [
								{ infra_approve_status: 3 },
								{ "edited.infra_approve_status": 3 },
							],
							$or: [
								{
									$and: [
										{ rule_edit_status: 0 },
										{ merchant_approve_status: 1 },
									],
								},
								{
									$and: [
										{ rule_edit_status: 1 },
										{ "edited.merchant_approve_status": 1 },
									],
								},
							],
						},
						async (err, rule) => {
							let result = errorMessage(err, rule, "Merchant Rule not found.");
							if (result.status == 0) {
								res.status(200).json(result);
							} else {
								try {
									var merchant = await Merchant.findOne({
										_id: rule.merchant_id,
										status: 1,
									});
									if (merchant == null) {
										throw new Error("Rule's Merchant not found");
									}
									var bank = await Bank.findOne({
										_id: merchant.bank_id,
										status: 1,
									});
									if (bank == null) {
										throw new Error("Merchant's bank not found");
									}
									if (
										rule.infra_share_edit_status == 0 &&
										rule.rule_edit_status == 1
									) {
										console.log("Condition 1");
										await IBMerchantRule.updateOne(
											{
												_id: rule_id,
											},
											{
												$set: {
													active: rule.edited.active,
													ranges: rule.edited.ranges,
													status: 1,
													infra_approve_status: 1,
													rule_edit_status: 0,
												},
												$unset: { edited: {} },
											}
										);
									} else if (
										rule.infra_share_edit_status == 1 &&
										rule.rule_edit_status == 1
									) {
										console.log("Condition 2");
										await IBMerchantRule.updateOne(
											{
												_id: rule_id,
											},
											{
												$set: {
													active: rule.edited.active,
													ranges: rule.edited.ranges,
													"infra_share.fixed": rule.edited.infra_share.fixed,
													"infra_share.percentage":
														rule.edited.infra_share.percentage,
													infra_share_edit_status: 0,
													rule_edit_status: 0,
													status: 1,
												},
												$unset: {
													edited: {},
												},
											}
										);
									} else if (
										rule.infra_share_edit_status == 1 &&
										rule.rule_edit_status == 0
									) {
										console.log("Condition 3");
										await IBMerchantRule.updateOne(
											{
												_id: rule_id,
											},
											{
												$set: {
													"infra_share.fixed": rule.edited.infra_share.fixed,
													"infra_share.percentage":
														rule.edited.infra_share.percentage,
													infra_share_edit_status: 0,
													status: 1,
												},
												$unset: {
													edited: {},
												},
											}
										);
									} else {
										console.log("Condition 4");
										await IBMerchantRule.updateOne(
											{
												_id: rule_id,
											},
											{
												$set: {
													infra_approve_status: 1,
													status: 1,
												},
											}
										);
									}
									var content =
										"Infra has approved the merchant rule " +
										rule.name +
										"in Ewallet Application";
									sendMail(content, "Merchant rule approved", bank.email);
									content =
										"Ewallet: Infra has approved the merchant rule " +
										rule.name;
									sendSMS(content, bank.mobile);
									res.status(200).json({
										status: 1,
										message: "Approved",
									});
								} catch (err) {
									console.log(err);
									res.status(200).json({ status: 0, message: err.message });
								}
							}
						}
					);
				} catch (err) {
					console.log(err);
					var message = err.toString();
					if (err.message) {
						message = err.message;
					}
					res.status(200).json({ status: 0, message: message });
				}
			}
		}
	);
});

router.post("/infra/merchantRule/interBank/decline", function (req, res) {
	const { token, rule_id } = req.body;
	Infra.findOne(
		{
			token,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				IBMerchantRule.findOne(
					{
						_id: rule_id,
						$or: [
							{ infra_approve_status: 3 },
							{ "edited.infra_approve_status": 3 },
						],
					},
					(err, rule) => {
						let result = errorMessage(err, rule, "MerchantRule not found.");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							if (rule.infra_share_edit_status == 1) {
								console.log("Condition 1");
								IBMerchantRule.updateOne(
									{
										_id: rule_id,
									},
									{
										$set: {
											"edited.infra_approve_status": 2,
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
										}
									}
								);
							} else {
								console.log("Condition 2");
								IBMerchantRule.updateOne(
									{
										_id: rule_id,
									},
									{
										$set: {
											infra_approve_status: 2,
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
										}
									}
								);
							}
							res.status(200).json({
								status: 1,
								message: "Declined",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/infra/merchantRule/interBank/getAll", function (req, res) {
	const { token, page, merchant_id } = req.body;
	var query = [];
	if (page == "fee") {
		query = [{ type: "IBNWM-F" }, { type: "IBWM-F" }];
	} else if (page == "commission") {
		query = [{ type: "IBNWM-C" }, { type: "IBWM-C" }];
	} else {
		res.status(200).json({
			status: 0,
			message: "Page not found",
		});
		return;
	}
	Infra.findOne(
		{
			token,
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
				IBMerchantRule.find(
					{
						merchant_id: merchant_id,
						$and: [
							{ $or: query },
							{
								$or: [
									{
										$and: [
											{ rule_edit_status: 0 },
											{ merchant_approve_status: 1 },
										],
									},
									{
										$and: [
											{ rule_edit_status: 1 },
											{
												$or: [
													{ "edited.merchant_approve_status": 1 },
													{ merchant_approve_status: 1 },
												],
											},
										],
									},
								],
							},
						],
					},
					(err, rules) => {
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
							rules = rules.map((rule) => {
								if (rule.edited.merchant_approve_status == 0) {
									rule["edited"] = undefined;
								}
								return rule;
							});
							res.status(200).json({
								status: 1,
								message: "Merchant Rules",
								rules: rules,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bank/merchantRule/interBank/getAll", function (req, res) {
	const { token, page, merchant_id } = req.body;
	var query = [];
	if (page == "fee") {
		query = [{ type: "IBNWM-F" }, { type: "IBWM-F" }];
	} else if (page == "commission") {
		query = [{ type: "IBNWM-C" }, { type: "IBWM-C" }];
	} else {
		res.status(200).json({
			status: 0,
			message: "Page not found",
		});
		return;
	}
	Bank.findOne(
		{
			token,
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
				IBMerchantRule.find(
					{ merchant_id: merchant_id, $or: query },
					(err, rules) => {
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
								message: "Merchant Rules",
								rules: rules,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/interBank/getRules", jwtTokenAuth, function (req, res) {
	const { page } = req.body;
	var query = [];
	if (page == "fee") {
		query = [{ type: "IBNWM-F" }, { type: "IBWM-F" }];
	} else if (page == "commission") {
		query = [{ type: "IBNWM-C" }, { type: "IBWM-C" }];
	} else {
		res.status(200).json({
			status: 0,
			message: "Page not found",
		});
		return;
	}
	const username = req.sign_creds.username;
	Merchant.findOne(
		{
			username: username,
			status: 1,
		},
		function (err, merchant) {
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
			} else if (merchant == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				var excludeFields =
					"-infra_approve_status -infra_share_edit_status -infra_share.fixed -infra_share.percentage -edited.infra_share.fixed -edited.infra_share.percentage";
				IBMerchantRule.find(
					{
						merchant_id: merchant._id,
						$or: query,
					},
					excludeFields,
					(err, rules) => {
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
								message: "Merchant Rules",
								rules: rules,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bank/merchantRule/interBank/editInfraShare", function (req, res) {
	const { token, rule_id, fixed, percentage } = req.body;
	Bank.findOne(
		{
			token,
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
				IBMerchantRule.findOneAndUpdate(
					{
						_id: rule_id,
						$or: [
							{ infra_approve_status: 1 },
							{ infra_approve_status: 2 },
							{ "edited.infra_approve_status": 2 },
						],
					},
					{
						$set: {
							"edited.infra_share.fixed": fixed,
							"edited.infra_share.percentage": percentage,
							"edited.infra_approve_status": 3,
							infra_share_edit_status: 1,
						},
					},
					{ new: true },
					(err, rule) => {
						let result = errorMessage(
							err,
							rule,
							"This rule is not allowed to edit."
						);
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							res.status(200).json({
								status: 1,
								message:
									"Merchant Rule " +
									rule.name +
									" infra share edited successfully",
								rule: rule,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bank/merchantRule/interBank/editRule", function (req, res) {
	const { token, rule_id, name, active, description, ranges } = req.body;
	Bank.findOne(
		{
			token,
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
				IBMerchantRule.findOneAndUpdate(
					{
						_id: rule_id,
						$or: [
							{ merchant_approve_status: 1 },
							{ merchant_approve_status: 2 },
							{ "edited.merchant_approve_status": 2 },
						],
					},
					{
						$set: {
							rule_edit_status: 1,
							"edited.name": name,
							"edited.active": active,
							"edited.ranges": ranges,
							"edited.description": description,
							"edited.merchant_approve_status": 0,
						},
					},
					{ new: true },
					(err, rule) => {
						let result = errorMessage(
							err,
							rule,
							"This rule is not allowed to edit."
						);
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							Merchant.findOne({ _id: rule.merchant_id }, (err, merchant) => {
								let result = errorMessage(err, merchant, "Merchant not found");
								if (result.status == 0) {
									res.status(200).json(result);
								} else {
									let content =
										"<p>Rule " +
										rule.name +
										" has been edited for merchant " +
										merchant.name +
										" for your bank in E-Wallet application</p><p>&nbsp;</p>";
									sendMail(content, "Merchant Rule Edited", bank.email);
									let content2 =
										" E-Wallet: Rule " +
										rule.name +
										" has been edited for merchant " +
										merchant.name;
									sendSMS(content2, bank.mobile);

									res.status(200).json({
										status: 1,
										message:
											"Merchant Rule " + rule.name + " edited successfully",
										rule: rule,
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

router.post("/bank/merchantRule/interBank/updateOtherBankShare", function (
	req,
	res
) {
	var { token, rule_id, other_bank_share } = req.body;
	Bank.findOne(
		{
			token,
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
				IBMerchantRule.findOneAndUpdate(
					{
						_id: rule_id,
					},
					{
						other_bank_share: other_bank_share,
					},
					{ new: true },
					(err, rule) => {
						let result = errorMessage(err, rule, "Merchant Rule not found.");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							res.status(200).json({
								status: 1,
								message:
									"Merchant Rule " +
									rule.name +
									" successfully updated with branch and partner share",
								rule: rule,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bank/merchantRule/interBank/addInfraShare", function (req, res) {
	const { token, rule_id, fixed, percentage } = req.body;
	Bank.findOne(
		{
			token,
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
				IBMerchantRule.findOneAndUpdate(
					{
						_id: rule_id,
					},
					{
						infra_approve_status: 3,
						"infra_share.fixed": fixed,
						"infra_share.percentage": percentage,
					},
					{ new: true },
					(err, rule) => {
						let result = errorMessage(err, rule, "Merchant Rule not found.");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							res.status(200).json({
								status: 1,
								message:
									"Merchant Rule " +
									rule.name +
									" successfully updated with infra share",
								rule: rule,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bank/merchantRule/interBank/createRule", function (req, res) {
	const {
		token,
		name,
		merchant_id,
		active,
		type,
		ranges,
		description,
	} = req.body;
	Bank.findOne(
		{
			token,
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
				Merchant.findOne({ _id: merchant_id }, (err, merchant) => {
					let result = errorMessage(err, merchant, "Merchant not found");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						IBMerchantRule.findOne({ merchant_id, type }, (err, rule) => {
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
							} else if (rule != null) {
								res.status(200).json({
									status: 0,
									message: "Rule already exist.",
								});
							} else {
								let merchantRule = new IBMerchantRule();
								merchantRule.name = name;
								merchantRule.merchant_id = merchant_id;
								merchantRule.bank_id = bank._id;
								merchantRule.active = active;
								merchantRule.type = type;
								merchantRule.description = description;
								ranges.forEach((range) => {
									var { trans_from, trans_to, fixed, percentage } = range;
									merchantRule.ranges.push({
										trans_from: trans_from,
										trans_to: trans_to,
										fixed: fixed,
										percentage: percentage,
									});
								});
								merchantRule.save((err, rule) => {
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
											"<p>New rule-" +
											name +
											" has been added for merchant " +
											merchant.name +
											" by your bank in E-Wallet application</p><p>&nbsp;</p>";
										sendMail(content, "New Merchant Rule Added", bank.email);
										sendMail(content, "New Rule Added", merchant.email);
										let content2 =
											" E-Wallet: New rule-" +
											name +
											" has been added for merchant " +
											merchant.name;
										sendSMS(content2, bank.mobile);
										sendSMS(content2, merchant.mobile);

										res.status(200).json({
											status: 1,
											message:
												"Merchant Rule " + name + " created successfully",
											rule: rule,
										});
									}
								});
							}
						});
					}
				});
			}
		}
	);
});

router.post("/merchantStaff/checkMerchantFee", jwtTokenAuth, (req, res) => {
	var { amount } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			type: "cashier",
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantRule.findOne(
					{ merchant_id: cashier.merchant_id, type: "M-F", status: 1 },
					(err, rule) => {
						let result = errorMessage(err, rule, "Fee rule not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							amount = Number(amount);
							var charge = 0;
							var range_found = false;
							rule.ranges.map((range) => {
								if (amount >= range.trans_from && amount <= range.trans_to) {
									range_found = true;
									charge = (amount * range.percentage) / 100;
									charge = charge + range.fixed;
								}
							});
							if (range_found) {
								res.status(200).json({
									status: 1,
									message: "Merchant fee",
									fee: charge,
								});
							} else {
								res.status(200).json({
									status: 1,
									message: "The amount is not within any range",
								});
							}
						}
					}
				);
			}
		}
	);
});

router.post("/partnerCashier/checkMerchantFee", jwtTokenAuth, (req, res) => {
	var { merchant_id, amount } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantRule.findOne(
					{ merchant_id: merchant_id, type: "NWM-F", status: 1 },
					(err, rule) => {
						let result = errorMessage(err, rule, "Fee rule not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							amount = Number(amount);
							var charge = 0;
							var range_found = false;
							rule.ranges.map((range) => {
								if (amount >= range.trans_from && amount <= range.trans_to) {
									range_found = true;
									charge = (amount * range.percentage) / 100;
									charge = charge + range.fixed;
								}
							});
							if (range_found) {
								res.status(200).json({
									status: 1,
									message: "Non Wallet to Merchant fee",
									fee: charge,
								});
							} else {
								res.status(200).json({
									status: 1,
									message: "The amount is not within any range",
								});
							}
						}
					}
				);
			}
		}
	);
});

router.post("/bank/merchantRule/updatePartnersShare", function (req, res) {
	var {
		token,
		rule_id,
		branch_share,
		partner_share,
		specific_branch_share,
		specific_partner_share,
	} = req.body;
	if (!specific_partner_share) {
		specific_partner_share = [];
	}
	Bank.findOne(
		{
			token,
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
				MerchantRule.findOneAndUpdate(
					{
						_id: rule_id,
					},
					{
						branch_share: branch_share,
						specific_branch_share: specific_branch_share,
						partner_share: partner_share,
						specific_partner_share: specific_partner_share,
					},
					{ new: true },
					(err, rule) => {
						let result = errorMessage(err, rule, "Merchant RUle not found.");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							res.status(200).json({
								status: 1,
								message:
									"Merchant Rule " +
									rule.name +
									" successfully updated with branch and partner share",
								rule: rule,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bank/merchantRule/createRule", function (req, res) {
	const {
		token,
		name,
		merchant_id,
		active,
		type,
		ranges,
		description,
	} = req.body;
	Bank.findOne(
		{
			token,
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
				Merchant.findOne({ _id: merchant_id }, (err, merchant) => {
					let result = errorMessage(err, merchant, "Merchant not found");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						MerchantRule.findOne({ merchant_id, type }, (err, rule) => {
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
							} else if (rule != null) {
								res.status(200).json({
									status: 0,
									message: "Rule already exist.",
								});
							} else {
								let merchantRule = new MerchantRule();
								merchantRule.name = name;
								merchantRule.merchant_id = merchant_id;
								merchantRule.bank_id = bank._id;
								merchantRule.active = active;
								merchantRule.type = type;
								merchantRule.description = description;
								ranges.forEach((range) => {
									var { trans_from, trans_to, fixed, percentage } = range;
									merchantRule.ranges.push({
										trans_from: trans_from,
										trans_to: trans_to,
										fixed: fixed,
										percentage: percentage,
									});
								});
								merchantRule.save((err, rule) => {
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
											"<p>New rule-" +
											name +
											" has been added for merchant " +
											merchant.name +
											" by your bank in E-Wallet application</p><p>&nbsp;</p>";
										sendMail(content, "New Merchant Rule Added", bank.email);
										sendMail(content, "New Rule Added", merchant.email);
										let content2 =
											" E-Wallet: New rule-" +
											name +
											" has been added for merchant " +
											merchant.name;
										sendSMS(content2, bank.mobile);
										sendSMS(content2, merchant.mobile);

										res.status(200).json({
											status: 1,
											message:
												"Merchant Rule " + name + " created successfully",
											rule: rule,
										});
									}
								});
							}
						});
					}
				});
			}
		}
	);
});

router.post("/bank/merchantRule/addInfraShare", function (req, res) {
	const { token, rule_id, fixed, percentage } = req.body;
	Bank.findOne(
		{
			token,
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
				MerchantRule.findOneAndUpdate(
					{
						_id: rule_id,
					},
					{
						infra_approve_status: 3,
						"infra_share.fixed": fixed,
						"infra_share.percentage": percentage,
					},
					{ new: true },
					(err, rule) => {
						let result = errorMessage(err, rule, "Merchant Rule not found.");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							res.status(200).json({
								status: 1,
								message:
									"Merchant Rule " +
									rule.name +
									" successfully updated with infra share",
								rule: rule,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bank/merchantRule/editRule", function (req, res) {
	const { token, rule_id, name, active, description, ranges } = req.body;
	Bank.findOne(
		{
			token,
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
				MerchantRule.findOneAndUpdate(
					{
						_id: rule_id,
						$or: [
							{ merchant_approve_status: 1 },
							{ merchant_approve_status: 2 },
							{ "edited.merchant_approve_status": 2 },
						],
					},
					{
						$set: {
							rule_edit_status: 1,
							"edited.name": name,
							"edited.active": active,
							"edited.ranges": ranges,
							"edited.description": description,
							"edited.merchant_approve_status": 0,
						},
					},
					{ new: true },
					(err, rule) => {
						let result = errorMessage(
							err,
							rule,
							"This rule is not allowed to edit."
						);
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							Merchant.findOne({ _id: rule.merchant_id }, (err, merchant) => {
								let result = errorMessage(err, merchant, "Merchant not found");
								if (result.status == 0) {
									res.status(200).json(result);
								} else {
									let content =
										"<p>Rule " +
										rule.name +
										" has been edited for merchant " +
										merchant.name +
										" for your bank in E-Wallet application</p><p>&nbsp;</p>";
									sendMail(content, "Merchant Rule Edited", bank.email);
									let content2 =
										" E-Wallet: Rule " +
										rule.name +
										" has been edited for merchant " +
										merchant.name;
									sendSMS(content2, bank.mobile);

									res.status(200).json({
										status: 1,
										message:
											"Merchant Rule " + rule.name + " edited successfully",
										rule: rule,
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

router.post("/bank/merchantRule/editInfraShare", function (req, res) {
	const { token, rule_id, fixed, percentage } = req.body;
	Bank.findOne(
		{
			token,
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
				MerchantRule.findOneAndUpdate(
					{
						_id: rule_id,
						$or: [
							{ infra_approve_status: 1 },
							{ infra_approve_status: 2 },
							{ "edited.infra_approve_status": 2 },
						],
					},
					{
						$set: {
							"edited.infra_share.fixed": fixed,
							"edited.infra_share.percentage": percentage,
							"edited.infra_approve_status": 3,
							infra_share_edit_status: 1,
						},
					},
					{ new: true },
					(err, rule) => {
						let result = errorMessage(
							err,
							rule,
							"This rule is not allowed to edit."
						);
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							res.status(200).json({
								status: 1,
								message:
									"Merchant Rule " +
									rule.name +
									" infra share edited successfully",
								rule: rule,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/getRules", jwtTokenAuth, function (req, res) {
	const { page } = req.body;
	var query = [];
	if (page == "fee") {
		query = [{ type: "NWM-F" }, { type: "WM-F" }, { type: "M-F" }];
	} else if (page == "commission") {
		query = [{ type: "NWM-C" }, { type: "WM-C" }, { type: "M-C" }];
	} else {
		res.status(200).json({
			status: 0,
			message: "Page not found",
		});
		return;
	}
	const username = req.sign_creds.username;
	Merchant.findOne(
		{
			username: username,
			status: 1,
		},
		function (err, merchant) {
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
			} else if (merchant == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				var excludeFields =
					"-infra_approve_status -infra_share_edit_status -infra_share.fixed -infra_share.percentage -edited.infra_share.fixed -edited.infra_share.percentage";
				MerchantRule.find(
					{
						merchant_id: merchant._id,
						$or: query,
					},
					excludeFields,
					(err, rules) => {
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
								message: "Merchant Rules",
								rules: rules,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bank/merchantRule/getAll", function (req, res) {
	const { token, page, merchant_id } = req.body;
	var query = [];
	if (page == "fee") {
		query = [{ type: "NWM-F" }, { type: "WM-F" }, { type: "M-F" }];
	} else if (page == "commission") {
		query = [{ type: "NWM-C" }, { type: "WM-C" }, { type: "M-C" }];
	} else {
		res.status(200).json({
			status: 0,
			message: "Page not found",
		});
		return;
	}
	Bank.findOne(
		{
			token,
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
				MerchantRule.find(
					{ merchant_id: merchant_id, $or: query },
					(err, rules) => {
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
								message: "Merchant Rules",
								rules: rules,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/infra/merchantRule/getAll", function (req, res) {
	const { token, page, merchant_id } = req.body;
	var query = [];
	if (page == "fee") {
		query = [{ type: "NWM-F" }, { type: "WM-F" }, { type: "M-F" }];
	} else if (page == "commission") {
		query = [{ type: "NWM-C" }, { type: "WM-C" }, { type: "M-C" }];
	} else {
		res.status(200).json({
			status: 0,
			message: "Page not found",
		});
		return;
	}
	Infra.findOne(
		{
			token,
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
				MerchantRule.find(
					{
						merchant_id: merchant_id,
						$and: [
							{ $or: query },
							{
								$or: [
									{
										$and: [
											{ rule_edit_status: 0 },
											{ merchant_approve_status: 1 },
										],
									},
									{
										$and: [
											{ rule_edit_status: 1 },
											{
												$or: [
													{ "edited.merchant_approve_status": 1 },
													{ merchant_approve_status: 1 },
												],
											},
										],
									},
								],
							},
						],
					},
					(err, rules) => {
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
							rules = rules.map((rule) => {
								if (rule.edited.merchant_approve_status == 0) {
									rule["edited"] = undefined;
								}
								return rule;
							});
							res.status(200).json({
								status: 1,
								message: "Merchant Rules",
								rules: rules,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/merchantRule/approve", jwtTokenAuth, function (
	req,
	res
) {
	const { rule_id } = req.body;
	const username = req.sign_creds.username;
	Merchant.findOne(
		{
			username,
			status: 1,
		},
		function (err, merchant) {
			let result = errorMessage(
				err,
				merchant,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.findOne({ _id: merchant.bank_id }, (err, bank) => {
					let result = errorMessage(err, bank, "Merchant's bank not found.");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						MerchantRule.findOne(
							{
								_id: rule_id,
								$or: [
									{ merchant_approve_status: 0 },
									{ "edited.merchant_approve_status": 0 },
								],
							},
							(err, rule) => {
								let result = errorMessage(
									err,
									rule,
									"Merchant Rule not found."
								);
								if (result.status == 0) {
									res.status(200).json(result);
								} else {
									if (rule.rule_edit_status == 1) {
										console.log("Condition 1");
										MerchantRule.updateOne(
											{
												_id: rule_id,
											},
											{
												$set: {
													"edited.merchant_approve_status": 1,
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
													var content =
														"Merchant " +
														merchant.name +
														" has approved the rule " +
														rule.name +
														"in Ewallet Application";
													sendMail(
														content,
														"Rule approved by merchant",
														bank.email
													);
													content =
														"Ewallet: Merchant " +
														merchant.name +
														" has approved the rule " +
														rule.name;
													sendSMS(content, bank.mobile);
													res.status(200).json({
														status: 1,
														message: "Approved",
													});
												}
											}
										);
									} else {
										console.log("Condition 2");
										MerchantRule.updateOne(
											{
												_id: rule_id,
											},
											{
												$set: {
													merchant_approve_status: 1,
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
													var content =
														"Merchant " +
														merchant.name +
														" has approved the rule rule " +
														rule.name +
														"in Ewallet Application";
													sendMail(
														content,
														"Rule rule approved by merchant",
														bank.email
													);
													content =
														"Ewallet: Merchant " +
														merchant.name +
														" has approved the rule rule " +
														rule.name;
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
							}
						);
					}
				});
			}
		}
	);
});

router.post("/merchant/merchantRule/decline", jwtTokenAuth, function (
	req,
	res
) {
	const { rule_id } = req.body;
	const username = req.sign_creds.username;
	Merchant.findOne(
		{
			username,
			status: 1,
		},
		function (err, merchant) {
			let result = errorMessage(
				err,
				merchant,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantRule.findOne(
					{
						_id: rule_id,
						$or: [
							{ merchant_approve_status: 0 },
							{ "edited.merchant_approve_status": 0 },
						],
					},
					(err, rule) => {
						let result = errorMessage(err, rule, "MerchantRule not found.");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							if (rule.rule_edit_status == 1) {
								console.log("Condition 1");
								MerchantRule.updateOne(
									{
										_id: rule_id,
									},
									{
										$set: {
											"edited.merchant_approve_status": 2,
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
										}
									}
								);
							} else {
								console.log("Condition 2");
								MerchantRule.updateOne(
									{
										_id: rule_id,
									},
									{
										$set: {
											merchant_approve_status: 2,
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
										}
									}
								);
							}
							res.status(200).json({
								status: 1,
								message: "Declined",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/infra/merchantRule/approve", function (req, res) {
	const { token, rule_id } = req.body;
	Infra.findOne(
		{
			token,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				try {
					MerchantRule.findOne(
						{
							_id: rule_id,
							$or: [
								{ infra_approve_status: 3 },
								{ "edited.infra_approve_status": 3 },
							],
							$or: [
								{
									$and: [
										{ rule_edit_status: 0 },
										{ merchant_approve_status: 1 },
									],
								},
								{
									$and: [
										{ rule_edit_status: 1 },
										{ "edited.merchant_approve_status": 1 },
									],
								},
							],
						},
						async (err, rule) => {
							let result = errorMessage(err, rule, "MerchantRule not found.");
							if (result.status == 0) {
								res.status(200).json(result);
							} else {
								var merchant = Merchant.findOne({
									_id: rule.merchant_id,
									status: 1,
								});
								if (merchant == null) {
									throw new Error("Rule's Merchant not found");
								}
								var bank = Bank.findOne({ _id: merchant.bank_id, status: 1 });
								if (bank == null) {
									throw new Error("Merchant's bank not found");
								}
								if (
									rule.infra_share_edit_status == 0 &&
									rule.rule_edit_status == 1
								) {
									console.log("Condition 1");
									await MerchantRule.updateOne(
										{
											_id: rule_id,
										},
										{
											$set: {
												active: rule.edited.active,
												ranges: rule.edited.ranges,
												status: 1,
												infra_approve_status: 1,
												rule_edit_status: 0,
											},
											$unset: { edited: {} },
										}
									);
								} else if (
									rule.infra_share_edit_status == 1 &&
									rule.rule_edit_status == 1
								) {
									console.log("Condition 2");
									await MerchantRule.updateOne(
										{
											_id: rule_id,
										},
										{
											$set: {
												active: rule.edited.active,
												ranges: rule.edited.ranges,
												"infra_share.fixed": rule.edited.infra_share.fixed,
												"infra_share.percentage":
													rule.edited.infra_share.percentage,
												infra_share_edit_status: 0,
												rule_edit_status: 0,
												status: 1,
											},
											$unset: {
												edited: {},
											},
										}
									);
								} else if (
									rule.infra_share_edit_status == 1 &&
									rule.rule_edit_status == 0
								) {
									console.log("Condition 3");
									await MerchantRule.updateOne(
										{
											_id: rule_id,
										},
										{
											$set: {
												"infra_share.fixed": rule.edited.infra_share.fixed,
												"infra_share.percentage":
													rule.edited.infra_share.percentage,
												infra_share_edit_status: 0,
												status: 1,
											},
											$unset: {
												edited: {},
											},
										}
									);
								} else {
									console.log("Condition 4");
									await MerchantRule.updateOne(
										{
											_id: rule_id,
										},
										{
											$set: {
												infra_approve_status: 1,
												status: 1,
											},
										}
									);
								}
								var content =
									"Infra has approved the merchant rule " +
									rule.name +
									"in Ewallet Application";
								sendMail(content, "Merchant rule approved", bank.email);
								content =
									"Ewallet: Infra has approved the merchant rule " + rule.name;
								sendSMS(content, bank.mobile);
								res.status(200).json({
									status: 1,
									message: "Approved",
								});
							}
						}
					);
				} catch (err) {
					console.log(err);
					var message = err.toString();
					if (err.message) {
						message = err.message;
					}
					res.status(200).json({ status: 0, message: message });
				}
			}
		}
	);
});

router.post("/infra/merchantRule/decline", function (req, res) {
	const { token, rule_id } = req.body;
	Infra.findOne(
		{
			token,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantRule.findOne(
					{
						_id: rule_id,
						$or: [
							{ infra_approve_status: 3 },
							{ "edited.infra_approve_status": 3 },
						],
					},
					(err, rule) => {
						let result = errorMessage(err, rule, "MerchantRule not found.");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							if (rule.infra_share_edit_status == 1) {
								console.log("Condition 1");
								MerchantRule.updateOne(
									{
										_id: rule_id,
									},
									{
										$set: {
											"edited.infra_approve_status": 2,
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
										}
									}
								);
							} else {
								console.log("Condition 2");
								MerchantRule.updateOne(
									{
										_id: rule_id,
									},
									{
										$set: {
											infra_approve_status: 2,
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
										}
									}
								);
							}
							res.status(200).json({
								status: 1,
								message: "Declined",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/cashier/checkMerchantFee", (req, res) => {
	var { token, merchant_id, amount } = req.body;
	Cashier.findOne(
		{
			token,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantRule.findOne(
					{ merchant_id: merchant_id, type: "NWM-F", status: 1 },
					(err, rule) => {
						let result = errorMessage(err, rule, "Fee rule not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							amount = Number(amount);
							var charge = 0;
							var range_found = false;
							rule.ranges.map((range) => {
								if (amount >= range.trans_from && amount <= range.trans_to) {
									range_found = true;
									charge = (amount * range.percentage) / 100;
									charge = charge + range.fixed;
								}
							});
							if (range_found) {
								res.status(200).json({
									status: 1,
									message: "Non Wallet to Merchant fee",
									fee: charge,
								});
							} else {
								res.status(200).json({
									status: 1,
									message: "The amount is not within any range",
								});
							}
						}
					}
				);
			}
		}
	);
});

router.post("/user/checkMerchantFee", jwtTokenAuth, (req, res) => {
	var { merchant_id, amount } = req.body;
	const jwtusername = req.sign_creds.username;
	console.log(jwtusername);
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
				MerchantRule.findOne(
					{ merchant_id: merchant_id, type: "WM-F", status: 1 },
					(err, rule) => {
						let result = errorMessage(err, rule, "Fee rule not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							amount = Number(amount);
							var charge = 0;
							var range_found = false;
							rule.ranges.map((range) => {
								if (amount >= range.trans_from && amount <= range.trans_to) {
									range_found = true;
									charge = (amount * range.percentage) / 100;
									charge = charge + range.fixed;
								}
							});
							if (range_found) {
								res.status(200).json({
									status: 1,
									message: "Wallet to Merchant fee",
									fee: charge,
								});
							} else {
								res.status(200).json({
									status: 1,
									message: "The amount is not within any range",
								});
							}
						}
					}
				);
			}
		}
	);
});

module.exports = router;
