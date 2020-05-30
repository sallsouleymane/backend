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
const {
	createWallet,
	getStatement,
	getBalance,
} = require("../services/Blockchain.js");

const Bank = require("../models/Bank");
const Infra = require("../models/Infra");
const Commission = require("../models/merchant/BankCommission");
const Merchant = require("../models/merchant/Merchant");
const jwtTokenAuth = require("./JWTTokenAuth");

router.post("/bank/commission/createRule", function (req, res) {
	const { token, merchant_id, fixed, percentage } = req.body;
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
				Merchant.findById({ _id: merchant_id }, (err, merchant) => {
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
								commission.current.fixed = fixed;
								commission.current.percentage = percentage;
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
										rule: commission
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
						"current.infra_fixed": fixed,
						"current.infra_percentage": percentage,
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
								rule: comm
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bank/commission/editRule", function (req, res) {
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
					{ _id: commission_id },
					{
						$set: {
							rule_edit_status: 1,
							"edited.fixed": fixed,
							"edited.percentage": percentage,
							"edited.merchant_approve_status": 0,
							"edited.infra_approve_status": 0,
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
								error: "Commission rule not found",
							});
						} else {
							Merchant.findById({ _id: comm.merchant_id }, (err, merchant) => {
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
										rule: comm
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
					},
					{
						infra_share_edit_status: 1,
						"edited.infra_fixed": fixed,
						"edited.infra_percentage": percentage,
						"edited.infra_approve_status": 0,
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
								message: "Commission Rule's infra share edited successfully",
								rule: comm
							});
						}
					}
				);
			}
		}
	);
});

router.get("/merchant/commission/getRule", jwtTokenAuth, function (req, res) {
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
						"-current.infra_fixed -current.infra_percentage -infra_share_edit_status -edited.infra_fixed -edited.infra_percentage";
				Commission.findOne(
					{
						merchant_id: merchant._id
					},
					excludeFields,
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
								message: "Commission Rule",
								rule: comm,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/:user/commission/getRule", function (req, res) {
	const user = req.params.user;
	allowedUsers = ["bank", "infra"];
	if (!allowedUsers.includes(user)) {
		return res.status(200).json({
			status: 0,
			error: "User is not authorized to view this rule",
		});
	}

	const { token, merchant_id } = req.body;
	const Type = getTypeClass(user);
	Type.findOne(
		{
			token,
			status: 1,
		},
		function (err, type) {
			if (err) {
				console.log(err);
				res.status(200).json({
					status: 0,
					error: "Internal Server Error",
				});
			} else if (type == null) {
				res.status(200).json({
					status: 0,
					error: "Unauthorized",
				});
			} else {
				Commission.findOne(
					{
						merchant_id: merchant_id,
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
							res.status(200).json({
								status: 1,
								message: "Commission Rule",
								rule: comm,
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
							{ 'current.merchant_approve_status': 0 },
							{ 'edited.merchant_approve_status': 0 },
						]
					},
					async (err, comm) => {
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
							var infra_approve_status = 0;
							if (comm.rule_edit_status == 1 && comm.infra_edit_status == 1 && comm.edited.infra_approve_status == 1) {
								infra_approve_status = 1;
								console.log("Condition 1");
								Commission.findOneAndUpdate(
									{
										_id: commission_id,
									},
									{
										$set: {
											"current.fixed": comm.edited.fixed,
											"current.percentage": comm.edited.percentage,
											"current.infra_fixed": comm.edited.infra_fixed,
											"current.infra_percentage": comm.edited.infra_percentage,
											"current.infra_approve_status": 1,
											"current.merchant_approve_status": 1,
											status: 1,
											rule_edit_status: 0,
											infra_share_edit_status: 0,
										},
										$unset: { edited: {} },
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
							} else if (comm.rule_edit_status == 1 && comm.infra_edit_status == 0 && comm.edited.infra_approve_status == 1) {
								infra_approve_status = 1;
								console.log("Condition 2");
								Commission.findOneAndUpdate(
									{
										_id: commission_id,
									},
									{
										$set: {
											"current.fixed": comm.edited.fixed,
											"current.percentage": comm.edited.percentage,
											"current.infra_approve_status": 1,
											"current.merchant_approve_status": 1,
											status: 1,
											rule_edit_status: 0,
										},
										$unset: { edited: {} },
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
							} else if ( comm.rule_edit_status == 1 ) {
								console.log("Condition 3");
								Commission.updateOne(
									{
										_id: commission_id,
									},
									{
										$set: {
											"edited.merchant_approve_status": 1,
										},
									},
									( err ) => {
										if (err) {
											console.log(err);
											res.status(200).json({
												status: 0,
												error: "Internal Server Error",
											});
										}
									}
								);
							} else if ( comm.current.infra_approve_status == 1 ) {
								console.log("Condition 4");
								infra_approve_status = 1;
								Commission.updateOne(
									{
										_id: commission_id,
									},
									{
										$set: {
											"current.merchant_approve_status": 1,
											status: 1,
										},
									},
									( err ) => {
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
							else {
								console.log("Condition 5");
								Commission.updateOne(
									{
										_id: commission_id,
									},
									{
										$set: {
											"current.merchant_approve_status": 1,
										},
									},
									( err ) => {
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
								infra_approve_status: infra_approve_status
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
							{ 'current.merchant_approve_status': 0 },
							{ 'edited.merchant_approve_status': 0 },
						]
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
							if ( comm.rule_edit_status == 1 ) {
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
									( err ) => {
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
											"current.merchant_approve_status": 2,
										},
									},
									( err ) => {
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
								message: "Declined"
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
							{ 'current.infra_approve_status': 0 },
							{ 'edited.infra_approve_status': 0 },
						]
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
							var merchant_approve_status = 0;
							if ( comm.infra_share_edit_status == 1 && comm.rule_edit_status == 1 && comm.edited.merchant_approve_status == 1 ) {
								console.log("Condition 1");
								merchant_approve_status = 1;
								Commission.updateOne(
									{
										_id: commission_id,
									},
									{
										$set: {
											"current.fixed": comm.edited.fixed,
											"current.percentage": comm.edited.percentage,
											"current.infra_fixed": comm.edited.infra_fixed,
											"current.infra_percentage": comm.edited.infra_percentage,
											"current.infra_approve_status": 1,
											"current.merchant_approve_status": 1,
											status: 1,
											rule_edit_status: 0,
											infra_share_edit_status: 0
										},
										$unset: { edited: {} },
									},
									( err ) => {
										if (err) {
											console.log(err);
											res.status(200).json({
												status: 0,
												error: "Internal Server Error",
											});
										}
									}
								);
							} else if ( comm.infra_share_edit_status == 1 && comm.rule_edit_status == 0 ) {
								console.log("Condition 2");
								Commission.updateOne(
									{
										_id: commission_id,
									},
									{
										$set: {
											"current.infra_fixed": comm.edited.infra_fixed,
											"current.infra_percentage": comm.edited.infra_percentage,
											infra_share_edit_status: 0,
										},
										$unset: {
											edited: {}
										}
									},
									( err ) => {
										if (err) {
											console.log(err);
											res.status(200).json({
												status: 0,
												error: "Internal Server Error",
											});
										}
									}
								);
							}  else if ( comm.infra_share_edit_status == 0 && comm.rule_edit_status == 1  && comm.edited.merchant_approve_status == 1) {
								console.log("Condition 3");
								Commission.updateOne(
									{
										_id: commission_id,
									},
									{
										$set: {
											"current.fixed": comm.edited.fixed,
											"current.percentage": comm.edited.percentage,
											rule_edit_status: 0,
										},
										$unset: {
											edited: {}
										}
									},
									( err ) => {
										if (err) {
											console.log(err);
											res.status(200).json({
												status: 0,
												error: "Internal Server Error",
											});
										}
									}
								);
							} else if ( comm.infra_share_edit_status == 1 ) {
								console.log("Condition 4");
								Commission.updateOne(
									{
										_id: commission_id,
									},
									{
										$set: {
											"edited.infra_approve_status": 1,
										},
									},
									( err ) => {
										if (err) {
											console.log(err);
											res.status(200).json({
												status: 0,
												error: "Internal Server Error",
											});
										}
									}
								);
							} else if ( comm.current.merchant_approve_status == 1 ) {
								console.log("Condition 5");
								merchant_approve_status = 1;
								Commission.updateOne(
									{
										_id: commission_id,
									},
									{
										$set: {
											"current.infra_approve_status": 1,
											status: 1,
										},
									},
									( err ) => {
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
							else {
								console.log("Condition 6");
								Commission.updateOne(
									{
										_id: commission_id,
									},
									{
										$set: {
											"current.infra_approve_status": 1,
										},
									},
									( err ) => {
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
								merchant_approve_status: merchant_approve_status
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
							{ 'current.infra_approve_status': 0 },
							{ 'edited.infra_approve_status': 0 },
						]
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
							if ( comm.infra_share_edit_status == 1 ) {
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
									( err ) => {
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
										commission_id,
									},
									{
										$set: {
											"current.infra_approve_status": 2,
										},
									},
									( err ) => {
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
								merchant_approve_status: merchant_approve_status
							});
						}
					}
				);
			}
		}
	);
});

module.exports = router;
