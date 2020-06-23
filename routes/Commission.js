const express = require("express");
const router = express.Router();

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");

const Bank = require("../models/Bank");
const Infra = require("../models/Infra");
const Commission = require("../models/merchant/BankCommission");
const Merchant = require("../models/merchant/Merchant");
const jwtTokenAuth = require("./JWTTokenAuth");

router.post("/bank/commission/updatePartnersShare", function (req, res) {
	const {
		token,
		commission_id,
		percentage,
		specific_partners_share,
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
					error: "Internal Server Error",
				});
			} else if (bank == null) {
				res.status(200).json({
					status: 0,
					error: "Unauthorized",
				});
			} else {
				Commission.findOneAndUpdate(
					{
						_id: commission_id,
					},
					{
						partner_share_percentage: percentage,
						specific_partners_share: specific_partners_share,
					},
					{ new: true },
					(err, comm) => {
						if (err) {
							console.log(err);
							res.status(200).json({
								status: 0,
								error: "Internal Server Error",
							});
						} else if (comm == null) {
							res.status(200).json({
								status: 0,
								error: "Commission not found.",
							});
						} else {
							res.status(200).json({
								status: 1,
								message:
									"Commission Rule successfully updated with partner share",
								rule: comm,
							});
						}
					}
				);
			}
		}
	);
});
router.post("/bank/commission/createRule", function (req, res) {
	const { token, merchant_id, name, type, active, ranges } = req.body;
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
					error: "Internal Server Error",
				});
			} else if (bank == null) {
				res.status(200).json({
					status: 0,
					error: "Unauthorized",
				});
			} else {
				Merchant.findOne({ _id: merchant_id }, (err, merchant) => {
					if (err) {
						console.log(err);
						res.status(200).json({
							status: 0,
							error: "Internal Server Error",
						});
					} else if (merchant == null) {
						res.status(200).json({
							status: 0,
							error: "Merchant not found",
						});
					} else {
						Commission.findOne({ merchant_id: merchant_id }, (err, comm) => {
							if (err) {
								console.log(err);
								res.status(200).json({
									status: 0,
									error: "Internal Server Error",
								});
							} else if (comm != null) {
								res.status(200).json({
									status: 0,
									error: "Commision already exist.",
								});
							} else {
								let commission = new Commission();
								commission.merchant_id = merchant_id;
								commission.name = name;
								commission.type = type;
								commission.active = active;
								ranges.forEach((range) => {
									var { trans_from, trans_to, fixed, percentage } = range;
									commission.ranges.push({
										trans_from: trans_from,
										trans_to: trans_to,
										fixed: fixed,
										percentage: percentage,
									});
								});
								commission.save((err) => {
									if (err) {
										console.log(err);
										return res.status(200).json({
											status: 0,
											error: "Internal Server Error",
										});
									}
									let content =
										"<p>New commision rule has been added for merchant " +
										merchant.name +
										" for your bank in E-Wallet application</p><p>&nbsp;</p>";
									sendMail(content, "New Commision Added", bank.email);
									sendMail(content, "New Commision Added", merchant.email);
									let content2 =
										" E-Wallet: New commision rule has been added for merchant " +
										merchant.name;
									sendSMS(content2, bank.mobile);
									sendSMS(content2, merchant.mobile);

									res.status(200).json({
										status: 1,
										message: "Commission Rule created successfully",
										rule: commission,
									});
								});
							}
						});
					}
				});
			}
		}
	);
});

router.post("/bank/commission/addInfraShare", function (req, res) {
	const { token, commission_id, fixed, percentage } = req.body;
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
					error: "Internal Server Error",
				});
			} else if (bank == null) {
				res.status(200).json({
					status: 0,
					error: "Unauthorized",
				});
			} else {
				Commission.findOneAndUpdate(
					{
						_id: commission_id,
					},
					{
						"infra_share.fixed": fixed,
						"infra_share.percentage": percentage,
						infra_approve_status: 3,
					},
					{ new: true },
					(err, comm) => {
						if (err) {
							console.log(err);
							res.status(200).json({
								status: 0,
								error: "Internal Server Error",
							});
						} else if (comm == null) {
							res.status(200).json({
								status: 0,
								error: "Commission not found.",
							});
						} else {
							res.status(200).json({
								status: 1,
								message:
									"Commission Rule successfully updated with infra share",
								rule: comm,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bank/commission/editRule", function (req, res) {
	const { token, commission_id, name, type, active, ranges } = req.body;
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
					error: "Internal Server Error",
				});
			} else if (bank == null) {
				res.status(200).json({
					status: 0,
					error: "Unauthorized",
				});
			} else {
				Commission.findOneAndUpdate(
					{
						_id: commission_id,
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
					{new: true},
					(err, comm) => {
						if (err) {
							console.log(err);
							res.status(200).json({
								status: 0,
								error: "Internal Server Error",
							});
						} else if (comm == null) {
							res.status(200).json({
								status: 0,
								error: "This rule is not allowed to edit.",
							});
						} else {
							Merchant.findOne({ _id: comm.merchant_id }, (err, merchant) => {
								if (err) {
									console.log(err);
									res.status(200).json({
										status: 0,
										error: "Internal Server Error",
									});
								} else if (merchant == null) {
									res.status(200).json({
										status: 0,
										error: "Merchant not found",
									});
								} else {
									let content =
										"<p>Commision rule has been edited for merchant " +
										merchant.name +
										" for your bank in E-Wallet application</p><p>&nbsp;</p>";
									sendMail(content, "Commision Edited", bank.email);
									let content2 =
										" E-Wallet: Commision rule has been edited for merchant " +
										merchant.name;
									sendSMS(content2, bank.mobile);

									res.status(200).json({
										status: 1,
										message: "Commission Rule edited successfully",
										comm: comm
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

router.post("/bank/commission/editInfraShare", function (req, res) {
	const { token, commission_id, fixed, percentage } = req.body;
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
					error: "Internal Server Error",
				});
			} else if (bank == null) {
				res.status(200).json({
					status: 0,
					error: "Unauthorized",
				});
			} else {
				Commission.findOneAndUpdate(
					{
						_id: commission_id,
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
					{new:true},
					(err, comm) => {
						if (err) {
							console.log(err);
							res.status(200).json({
								status: 0,
								error: "Internal Server Error",
							});
						} else if (comm == null) {
							res.status(200).json({
								status: 0,
								error: "This rule is not allowed to edit",
							});
						} else {
							res.status(200).json({
								status: 1,
								message: "Commission Rule's infra share edited successfully",
								comm: comm
							});
						}
					}
				);
			}
		}
	);
});

router.get("/merchant/commission/getRules", jwtTokenAuth, function (req, res) {
	const username = req.sign_creds.username;
	Merchant.findOne(
		{
			username: username,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				console.log(err);
				res.status(200).json({
					status: 0,
					error: "Internal Server Error",
				});
			} else if (merchant == null) {
				res.status(200).json({
					status: 0,
					error: "Unauthorized",
				});
			} else {
				var excludeFields =
					"-infra_share_edit_status -infra_share.fixed -infra_share.percentage -edited.infra_share.fixed -edited.infra_share.percentage";
				Commission.find(
					{
						merchant_id: merchant._id,
					},
					excludeFields,
					(err, comms) => {
						if (err) {
							console.log(err);
							res.status(200).json({
								status: 0,
								error: "Internal Server Error",
							});
						} else {
							res.status(200).json({
								status: 1,
								message: "Commission Rules",
								rules: comms,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bank/commission/getRules", function (req, res) {
	const { token, merchant_id } = req.body;
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
					error: "Internal Server Error",
				});
			} else if (bank == null) {
				res.status(200).json({
					status: 0,
					error: "Unauthorized",
				});
			} else {
				Commission.find({ merchant_id: merchant_id }, (err, comms) => {
					if (err) {
						console.log(err);
						res.status(200).json({
							status: 0,
							error: "Internal Server Error",
						});
					} else {
						res.status(200).json({
							status: 1,
							message: "Commission Rules",
							rules: comms,
						});
					}
				});
			}
		}
	);
});

router.post("/infra/commission/getRules", function (req, res) {
	const { token, merchant_id } = req.body;
	Infra.findOne(
		{
			token,
			status: 1,
		},
		function (err, infra) {
			if (err) {
				console.log(err);
				res.status(200).json({
					status: 0,
					error: "Internal Server Error",
				});
			} else if (infra == null) {
				res.status(200).json({
					status: 0,
					error: "Unauthorized",
				});
			} else {
				Commission.find(
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
					(err, comms) => {
						if (err) {
							console.log(err);
							res.status(200).json({
								status: 0,
								error: "Internal Server Error",
							});
						} else {
							comms = comms.map((rule) => {
								if (rule.edited.merchant_approve_status == 0) {
									rule["edited"] = undefined;
								}
								return rule;
							});
							res.status(200).json({
								status: 1,
								message: "Commission Rule",
								rules: comms,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/commission/approve", jwtTokenAuth, function (req, res) {
	const { commission_id } = req.body;
	const username = req.sign_creds.username;
	Merchant.findOne(
		{
			username,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				console.log(err);
				res.status(200).json({
					status: 0,
					error: "Internal Server Error",
				});
			} else if (merchant == null) {
				res.status(200).json({
					status: 0,
					error: "Unauthorized",
				});
			} else {
				Commission.findOne(
					{
						_id: commission_id,
						$or: [
							{ merchant_approve_status: 0 },
							{ "edited.merchant_approve_status": 0 },
						],
					},
					(err, comm) => {
						if (err) {
							console.log(err);
							res.status(200).json({
								status: 0,
								error: "Internal Server Error",
							});
						} else if (comm == null) {
							res.status(200).json({
								status: 0,
								error: "Commission not found.",
							});
						} else {
							if (comm.rule_edit_status == 1) {
								console.log("Condition 1");
								Commission.updateOne(
									{
										_id: commission_id,
									},
									{
										$set: {
											"edited.merchant_approve_status": 1,
										},
									},
									(err) => {
										if (err) {
											console.log(err);
											res.status(200).json({
												status: 0,
												error: "Internal Server Error",
											});
										}
									}
								);
							} else {
								console.log("Condition 2");
								Commission.updateOne(
									{
										_id: commission_id,
									},
									{
										$set: {
											merchant_approve_status: 1,
										},
									},
									(err) => {
										if (err) {
											console.log(err);
											res.status(200).json({
												status: 0,
												error: "Internal Server Error",
											});
										}
									}
								);
							}
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

router.post("/merchant/commission/decline", jwtTokenAuth, function (req, res) {
	const { commission_id } = req.body;
	const username = req.sign_creds.username;
	Merchant.findOne(
		{
			username,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				console.log(err);
				res.status(200).json({
					status: 0,
					error: "Internal Server Error",
				});
			} else if (merchant == null) {
				res.status(200).json({
					status: 0,
					error: "Unauthorized",
				});
			} else {
				Commission.findOne(
					{
						_id: commission_id,
						$or: [
							{ merchant_approve_status: 0 },
							{ "edited.merchant_approve_status": 0 },
						],
					},
					(err, comm) => {
						if (err) {
							console.log(err);
							res.status(200).json({
								status: 0,
								error: "Internal Server Error",
							});
						} else if (comm == null) {
							res.status(200).json({
								status: 0,
								error: "Commission not found.",
							});
						} else {
							if (comm.rule_edit_status == 1) {
								console.log("Condition 1");
								Commission.updateOne(
									{
										_id: commission_id,
									},
									{
										$set: {
											"edited.merchant_approve_status": 2,
										},
									},
									(err) => {
										if (err) {
											console.log(err);
											return res.status(200).json({
												status: 0,
												error: "Internal Server Error",
											});
										}
									}
								);
							} else {
								console.log("Condition 2");
								Commission.updateOne(
									{
										_id: commission_id,
									},
									{
										$set: {
											merchant_approve_status: 2,
										},
									},
									(err) => {
										if (err) {
											console.log(err);
											return res.status(200).json({
												status: 0,
												error: "Internal Server Error",
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

router.post("/infra/commission/approve", function (req, res) {
	const { token, commission_id } = req.body;
	Infra.findOne(
		{
			token,
			status: 1,
		},
		function (err, infra) {
			if (err) {
				console.log(err);
				res.status(200).json({
					status: 0,
					error: "Internal Server Error",
				});
			} else if (infra == null) {
				res.status(200).json({
					status: 0,
					error: "Unauthorized",
				});
			} else {
				Commission.findOne(
					{
						_id: commission_id,
						$or: [
							{ infra_approve_status: 3 },
							{ "edited.infra_approve_status": 3 },
						],
						$or: [
							{
								$and: [{ rule_edit_status: 0 }, { merchant_approve_status: 1 }],
							},
							{
								$and: [
									{ rule_edit_status: 1 },
									{ "edited.merchant_approve_status": 1 },
								],
							},
						],
					},
					(err, comm) => {
						if (err) {
							console.log(err);
							res.status(200).json({
								status: 0,
								error: "Internal Server Error",
							});
						} else if (comm == null) {
							res.status(200).json({
								status: 0,
								error: "Commission not found.",
							});
						} else {
							if (
								comm.infra_share_edit_status == 0 &&
								comm.rule_edit_status == 1
							) {
								console.log("Condition 1");
								Commission.updateOne(
									{
										_id: commission_id,
									},
									{
										$set: {
											active: comm.edited.active,
											ranges: comm.edited.ranges,
											status: 1,
											infra_approve_status: 1,
											rule_edit_status: 0,
										},
										$unset: { edited: {} },
									},
									(err) => {
										if (err) {
											console.log(err);
											return res.status(200).json({
												status: 0,
												error: "Internal Server Error",
											});
										}
									}
								);
							} else if (
								comm.infra_share_edit_status == 1 &&
								comm.rule_edit_status == 1
							) {
								console.log("Condition 2");
								Commission.updateOne(
									{
										_id: commission_id,
									},
									{
										$set: {
											active: comm.edited.active,
											ranges: comm.edited.ranges,
											"infra_share.fixed": comm.edited.infra_share.fixed,
											"infra_share.percentage":
												comm.edited.infra_share.percentage,
											infra_share_edit_status: 0,
											rule_edit_status: 0,
											status: 1,
										},
										$unset: {
											edited: {},
										},
									},
									(err) => {
										if (err) {
											console.log(err);
											return res.status(200).json({
												status: 0,
												error: "Internal Server Error",
											});
										}
									}
								);
							} else if (
								comm.infra_share_edit_status == 1 &&
								comm.rule_edit_status == 0
							) {
								console.log("Condition 3");
								MerchantFee.updateOne(
									{
										_id: commission_id,
									},
									{
										$set: {
											"infra_share.fixed": comm.edited.infra_share.fixed,
											"infra_share.percentage":
												comm.edited.infra_share.percentage,
											infra_share_edit_status: 0,
											status: 1,
										},
										$unset: {
											edited: {},
										},
									},
									(err) => {
										if (err) {
											console.log(err);
											return res.status(200).json({
												status: 0,
												error: "Internal Server Error",
											});
										}
									}
								);
							} else {
								console.log("Condition 3");
								Commission.updateOne(
									{
										_id: commission_id,
									},
									{
										$set: {
											infra_approve_status: 1,
											status: 1,
										},
									},
									(err) => {
										if (err) {
											console.log(err);
											return res.status(200).json({
												status: 0,
												error: "Internal Server Error",
											});
										}
									}
								);
							}
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

router.post("/infra/commission/decline", function (req, res) {
	const { token, commission_id } = req.body;
	Infra.findOne(
		{
			token,
			status: 1,
		},
		function (err, infra) {
			if (err) {
				console.log(err);
				res.status(200).json({
					status: 0,
					error: "Internal Server Error",
				});
			} else if (infra == null) {
				res.status(200).json({
					status: 0,
					error: "Unauthorized",
				});
			} else {
				Commission.findOne(
					{
						_id: commission_id,
						$or: [
							{ infra_approve_status: 3 },
							{ "edited.infra_approve_status": 3 },
						],
					},
					(err, comm) => {
						if (err) {
							console.log(err);
							res.status(200).json({
								status: 0,
								error: "Internal Server Error",
							});
						} else if (comm == null) {
							res.status(200).json({
								status: 0,
								error: "Commission not found.",
							});
						} else {
							if (comm.infra_share_edit_status == 1) {
								console.log("Condition 1");
								Commission.updateOne(
									{
										commission_id,
									},
									{
										$set: {
											"edited.infra_approve_status": 2,
										},
									},
									(err) => {
										if (err) {
											console.log(err);
											return res.status(200).json({
												status: 0,
												error: "Internal Server Error",
											});
										}
									}
								);
							} else {
								console.log("Condition 2");
								Commission.updateOne(
									{
										commission_id,
									},
									{
										$set: {
											infra_approve_status: 2,
										},
									},
									(err) => {
										if (err) {
											console.log(err);
											return res.status(200).json({
												status: 0,
												error: "Internal Server Error",
											});
										}
									}
								);
							}
							res.status(200).json({
								status: 1,
								message: "Approved",
								merchant_approve_status: merchant_approve_status,
							});
						}
					}
				);
			}
		}
	);
});

module.exports = router;
