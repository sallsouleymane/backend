const express = require("express");
const router = express.Router();

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");

const Bank = require("../models/Bank");
const Infra = require("../models/Infra");
const MerchantFee = require("../models/merchant/MerchantFee");
const Merchant = require("../models/merchant/Merchant");
const MerchantCashier = require("../models/merchant/MerchantCashier");
const Cashier = require("../models/Cashier");
const User = require("../models/User");
const PartnerCashier = require("../models/partner/Cashier");

const jwtTokenAuth = require("./JWTTokenAuth");

router.post("/merchantCashier/checkMerchantFee", jwtTokenAuth, (req, res) => {
	var { amount } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				MerchantFee.findOne(
					{ merchant_id: cashier.merchant_id, type: 1, status: 1 },
					(err, fee) => {
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
						} else if (fee == null) {
							return res.status(200).json({
								status: 0,
								message: "Fee rule not found",
							});
						} else {
							amount = Number(amount);
							var charge = 0;
							var range_found = false;
							fee.ranges.map((range) => {
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

router.post("/partnerCashier/checkMerchantFee", jwtTokenAuth, (req, res) => {
	var { merchant_id, amount } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				MerchantFee.findOne(
					{ merchant_id: merchant_id, type: 1, status: 1 },
					(err, fee) => {
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
						} else if (fee == null) {
							return res.status(200).json({
								status: 0,
								message: "Fee rule not found",
							});
						} else {
							amount = Number(amount);
							var charge = 0;
							var range_found = false;
							fee.ranges.map((range) => {
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

router.post("/bank/merchantFee/updatePartnersShare", function (req, res) {
	var { token, fee_id, percentage, partner_branch_share, specific_partners_share, specific_partners_branch_share } = req.body;
	if (!specific_partners_share) {
		specific_partners_share = [];
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
				MerchantFee.findOneAndUpdate(
					{
						_id: fee_id,
					},
					{
						partner_share_percentage: percentage,
						specific_partners_share: specific_partners_share,
						partner_branch_share: partner_branch_share,
						specific_partners_branch_share: specific_partners_branch_share
					},
					{ new: true },
					(err, fee) => {
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
						} else if (fee == null) {
							res.status(200).json({
								status: 0,
								message: "MerchantFee not found.",
							});
						} else {
							res.status(200).json({
								status: 1,
								message:
									"Merchant Fee Rule successfully updated with partner share",
								rule: fee,
							});
						}
					}
				);
			}
		}
	);
});
router.post("/bank/merchantFee/createRule", function (req, res) {
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
				Merchant.findOne({ _id: merchant_id }, (err, merchant) => {
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
							message: "Merchant not found",
						});
					} else {
						MerchantFee.findOne({ merchant_id, type }, (err, fee) => {
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
							} else if (fee != null) {
								res.status(200).json({
									status: 0,
									message: "Fee Rule already exist.",
								});
							} else {
								let merchantFee = new MerchantFee();
								merchantFee.name = name;
								merchantFee.merchant_id = merchant_id;
								merchantFee.bank_id = bank._id;
								merchantFee.active = active;
								merchantFee.type = type;
								merchantFee.description = description;
								ranges.forEach((range) => {
									var { trans_from, trans_to, fixed, percentage } = range;
									merchantFee.ranges.push({
										trans_from: trans_from,
										trans_to: trans_to,
										fixed: fixed,
										percentage: percentage,
									});
								});
								merchantFee.save((err) => {
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
											"<p>New fee rule has been added for merchant " +
											merchant.name +
											" for your bank in E-Wallet application</p><p>&nbsp;</p>";
										sendMail(content, "New Fee Rule Added", bank.email);
										sendMail(content, "New Fee Rule Added", merchant.email);
										let content2 =
											" E-Wallet: New fee rule rule has been added for merchant " +
											merchant.name;
										sendSMS(content2, bank.mobile);
										sendSMS(content2, merchant.mobile);

										res.status(200).json({
											status: 1,
											message: "Merchant Fee Rule created successfully",
											rule: merchantFee,
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

router.post("/bank/merchantFee/addInfraShare", function (req, res) {
	const { token, fee_id, fixed, percentage } = req.body;
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
				MerchantFee.findOneAndUpdate(
					{
						_id: fee_id,
					},
					{
						infra_approve_status: 3,
						"infra_share.fixed": fixed,
						"infra_share.percentage": percentage,
					},
					{ new: true },
					(err, fee) => {
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
						} else if (fee == null) {
							res.status(200).json({
								status: 0,
								message: "MerchantFee not found.",
							});
						} else {
							res.status(200).json({
								status: 1,
								message:
									"Merchant Fee Rule successfully updated with infra share",
								rule: fee,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bank/merchantFee/editRule", function (req, res) {
	const { token, fee_id, name, active, description, type, ranges } = req.body;
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
				MerchantFee.findOneAndUpdate(
					{
						_id: fee_id,
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
							"edited.type": type,
							"edited.active": active,
							"edited.ranges": ranges,
							"edited.merchant_approve_status": 0,
						},
					},
					{ new: true },
					(err, fee) => {
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
						} else if (fee == null) {
							res.status(200).json({
								status: 0,
								message: "This rule is not allowed to edit.",
							});
						} else {
							Merchant.findOne({ _id: fee.merchant_id }, (err, merchant) => {
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
										message: "Merchant not found",
									});
								} else {
									let content =
										"<p>Fee Rule rule has been edited for merchant " +
										merchant.name +
										" for your bank in E-Wallet application</p><p>&nbsp;</p>";
									sendMail(content, "Fee Rule Edited", bank.email);
									let content2 =
										" E-Wallet: Fee Rule rule has been edited for merchant " +
										merchant.name;
									sendSMS(content2, bank.mobile);

									res.status(200).json({
										status: 1,
										message: "Merchant Fee Rule edited successfully",
										fee: fee,
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

router.post("/bank/merchantFee/editInfraShare", function (req, res) {
	const { token, fee_id, fixed, percentage } = req.body;
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
				MerchantFee.findOneAndUpdate(
					{
						_id: fee_id,
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
					(err, fee) => {
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
						} else if (fee == null) {
							res.status(200).json({
								status: 0,
								message: "This rule is not allowed to edit.",
							});
						} else {
							res.status(200).json({
								status: 1,
								message: "Merchant Fee Rule's infra share edited successfully",
								fee: fee,
							});
						}
					}
				);
			}
		}
	);
});

router.get("/merchant/merchantFee/getRules", jwtTokenAuth, function (req, res) {
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
				MerchantFee.find(
					{
						merchant_id: merchant._id,
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
								message: "Merchant Fee Rule",
								rules: rules,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bank/merchantFee/getRules", function (req, res) {
	const { token, merchant_id } = req.body;
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
				MerchantFee.find({ merchant_id: merchant_id }, (err, rules) => {
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
							message: "MerchantFee Rule",
							rules: rules,
						});
					}
				});
			}
		}
	);
});

router.post("/infra/merchantFee/getRules", function (req, res) {
	const { token, merchant_id } = req.body;
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
				MerchantFee.find(
					{
						merchant_id: merchant_id,
						$or: [
							{
								$and: [{ rule_edit_status: 0 }, { merchant_approve_status: 1 }],
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
					async (err, rules) => {
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
								message: "Merchant Fee Rule",
								rules: rules,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/merchantFee/approve", jwtTokenAuth, function (req, res) {
	const { fee_id } = req.body;
	const username = req.sign_creds.username;
	Merchant.findOne(
		{
			username,
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
				Bank.findOne({ _id: merchant.bank_id }, (err, bank) => {
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
							message: "Merchant's bank not found.",
						});
					} else {
						MerchantFee.findOne(
							{
								_id: fee_id,
								$or: [
									{ merchant_approve_status: 0 },
									{ "edited.merchant_approve_status": 0 },
								],
							},
							(err, fee) => {
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
								} else if (fee == null) {
									res.status(200).json({
										status: 0,
										message: "MerchantFee not found.",
									});
								} else {
									if (fee.rule_edit_status == 1) {
										console.log("Condition 1");
										MerchantFee.updateOne(
											{
												_id: fee_id,
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
														" has approved the fee rule " +
														fee.name +
														"in Ewallet Application";
													sendMail(
														content,
														"Fee rule approved by merchant",
														bank.email
													);
													content =
														"Ewallet: Merchant " +
														merchant.name +
														" has approved the fee rule " +
														fee.name;
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
										MerchantFee.updateOne(
											{
												_id: fee_id,
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
														" has approved the fee rule " +
														fee.name +
														"in Ewallet Application";
													sendMail(
														content,
														"Fee rule approved by merchant",
														bank.email
													);
													content =
														"Ewallet: Merchant " +
														merchant.name +
														" has approved the fee rule " +
														fee.name;
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

router.post("/merchant/merchantFee/decline", jwtTokenAuth, function (req, res) {
	const { fee_id } = req.body;
	const username = req.sign_creds.username;
	Merchant.findOne(
		{
			username,
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
				MerchantFee.findOne(
					{
						_id: fee_id,
						$or: [
							{ merchant_approve_status: 0 },
							{ "edited.merchant_approve_status": 0 },
						],
					},
					(err, fee) => {
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
						} else if (fee == null) {
							res.status(200).json({
								status: 0,
								message: "MerchantFee not found.",
							});
						} else {
							if (fee.rule_edit_status == 1) {
								console.log("Condition 1");
								MerchantFee.updateOne(
									{
										_id: fee_id,
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
								MerchantFee.updateOne(
									{
										_id: fee_id,
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

router.post("/infra/merchantFee/approve", function (req, res) {
	const { token, fee_id } = req.body;
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
				try {
					MerchantFee.findOne(
						{
							_id: fee_id,
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
						async (err, fee) => {
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
							} else if (fee == null) {
								res.status(200).json({
									status: 0,
									message: "MerchantFee not found.",
								});
							} else {
								var merchant = Merchant.findOne({
									_id: fee.merchant_id,
									status: 1,
								});
								if (merchant == null) {
									throw new Error("Fee's Merchant not found");
								}
								var bank = Bank.findOne({ _id: merchant.bank_id, status: 1 });
								if (bank == null) {
									throw new Error("Merchant's bank not found");
								}
								if (
									fee.infra_share_edit_status == 0 &&
									fee.rule_edit_status == 1
								) {
									console.log("Condition 1");
									await MerchantFee.updateOne(
										{
											_id: fee_id,
										},
										{
											$set: {
												active: fee.edited.active,
												type: fee.edited.type,
												ranges: fee.edited.ranges,
												status: 1,
												infra_approve_status: 1,
												rule_edit_status: 0,
											},
											$unset: { edited: {} },
										}
									);
								} else if (
									fee.infra_share_edit_status == 1 &&
									fee.rule_edit_status == 1
								) {
									console.log("Condition 2");
									await MerchantFee.updateOne(
										{
											_id: fee_id,
										},
										{
											$set: {
												active: fee.edited.active,
												ranges: fee.edited.ranges,
												type: fee.edited.type,
												"infra_share.fixed": fee.edited.infra_share.fixed,
												"infra_share.percentage":
													fee.edited.infra_share.percentage,
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
									fee.infra_share_edit_status == 1 &&
									fee.rule_edit_status == 0
								) {
									console.log("Condition 3");
									await MerchantFee.updateOne(
										{
											_id: fee_id,
										},
										{
											$set: {
												"infra_share.fixed": fee.edited.infra_share.fixed,
												"infra_share.percentage":
													fee.edited.infra_share.percentage,
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
									await MerchantFee.updateOne(
										{
											_id: fee_id,
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
									"Infra has approved the fee rule " +
									fee.name +
									"in Ewallet Application";
								sendMail(content, "Fee rule approved by Infra", bank.email);
								content =
									"Ewallet: Infra has approved the fee rule " + fee.name;
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

router.post("/infra/merchantFee/decline", function (req, res) {
	const { token, fee_id } = req.body;
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
				MerchantFee.findOne(
					{
						_id: fee_id,
						$or: [
							{ infra_approve_status: 3 },
							{ "edited.infra_approve_status": 3 },
						],
					},
					(err, fee) => {
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
						} else if (fee == null) {
							res.status(200).json({
								status: 0,
								message: "MerchantFee not found.",
							});
						} else {
							if (fee.infra_share_edit_status == 1) {
								console.log("Condition 1");
								MerchantFee.updateOne(
									{
										_id: fee_id,
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
								MerchantFee.updateOne(
									{
										_id: fee_id,
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				MerchantFee.findOne(
					{ merchant_id: merchant_id, type: 1, status: 1 },
					(err, fee) => {
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
						} else if (fee == null) {
							return res.status(200).json({
								status: 0,
								message: "Fee rule not found",
							});
						} else {
							amount = Number(amount);
							var charge = 0;
							var range_found = false;
							fee.ranges.map((range) => {
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
			} else if (user == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				MerchantFee.findOne(
					{ merchant_id: merchant_id, type: 0, status: 1 },
					(err, fee) => {
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
						} else if (fee == null) {
							return res.status(200).json({
								status: 0,
								message: "Fee rule not found",
							});
						} else {
							amount = Number(amount);
							var charge = 0;
							var range_found = false;
							fee.ranges.map((range) => {
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
