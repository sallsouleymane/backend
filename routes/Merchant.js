const express = require("express");
const router = express.Router();

const config = require("../config.json");
const jwtTokenAuth = require("./JWTTokenAuth");

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const makeid = require("./utils/idGenerator");
const makeotp = require("./utils/makeotp");
const { errorMessage, catchError } = require("./utils/errorHandler");
const blockchain = require("../services/Blockchain");

//models
const Bank = require("../models/Bank");
const Merchant = require("../models/merchant/Merchant");
const MerchantBranch = require("../models/merchant/MerchantBranch");
const MerchantStaff = require("../models/merchant/Staff");
const MerchantPosition = require("../models/merchant/Position");
const Zone = require("../models/merchant/Zone");
const Subzone = require("../models/merchant/Subzone");
const InvoiceGroup = require("../models/merchant/InvoiceGroup");
const Invoice = require("../models/merchant/Invoice");
const Offering = require("../models/merchant/Offering");
const Tax = require("../models/merchant/Tax");
const MerchantSettings = require("../models/merchant/MerchantSettings");
const Customer = require("../models/merchant/Customer");
const { errors } = require("formidable");

/**
 * @swagger
 * /merchant/getDashStats:
 *  post:
 *    description: Use to get merchant's dashboard stats
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/getDashStats", jwtTokenAuth, function (req, res) {
	const { merchant_id } = req.body;
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, merchant) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!merchant || merchant == null || merchant == undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err1, admin) {
						if (err1) {
							console.log(err1);
							var message1 = err;
							if (err.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
								var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}
			Invoice.aggregate(
					[
						{
							$match: {
								merchant_id: String(merchant_id),
								created_at: {
									$gte: new Date(
										start
									),
									$lte: new Date(
										end
									),
								},
								paid:1,
							},
						},
						{
							$group: {
								_id: "$paid_by",
								amount_paid: { $sum: "$amount" },
								bills_paid: { $sum: 1 },
							},
						},
					],async (err3, post6) => {
						let result3 = errorMessage(
							err3,
							post6,
							"Error."
						);
						if (result3.status == 0) {
							res.status(200).json(result3);
						} else {
							Invoice.aggregate(
								[
									{
										$match: {
											merchant_id: String(merchant_id),
											created_at: {
												$gte: new Date(
													start
												),
												$lte: new Date(
													end
												),
											},
										},
									},
									{
										$group: {
											_id: "$is_created",
											amount_generated: { $sum: "$amount" },
											bills_generated: { $sum: 1 },
										},
									},
								],async (err4, post7) => {
									let result4 = errorMessage(
										err4,
										post7,
										"Error."
									);
									if (result4.status == 0) {
										res.status(200).json(result4);
									} else {
										Invoice.aggregate(
											[
												{
													$match: {
														merchant_id: String(merchant_id),
														paid: 0,
													},
												},
												{
													$group: {
														_id: null,
														amount_pending: { $sum: "$amount" },
														bills_pending: { $sum: 1 },
													},
												},
											],async (err5, post8) => {
												let result5 = errorMessage(
													err5,
													post8,
													"Error."
												);
												if (result5.status == 0) {
													res.status(200).json(result5);
												} else {
													let ap = 0;
													let bp = 0;
													if (
														post8 != undefined &&
														post8 != null &&
														post8.length > 0
													) {
														ap = post8[0].amount_pending;
														bp = post8[0].bills_pending;
													}
													res.status(200).json({
														status: 1,
														post6:post6,
														post7:post7,
														amount_pending: ap,
														bills_pending: bp,
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
	);
});

/**
 * @swagger
 * /merchant/getSettings:
 *  post:
 *    description: Use to get merchant's settings
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/getSettings", jwtTokenAuth, function (req, res) {
	const { merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!merchant || merchant == null || merchant == undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err1, admin) {
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
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
								var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}

				MerchantSettings.findOne(
					{ merchant_id: merchant_id },
					(err3, setting) => {
						if (err3) {
							console.log(err3);
							var message3 = err3;
							if (err3.message) {
								message3 = err3.message;
							}
							res.status(200).json({
								status: 0,
								message: message3,
							});
						} else if (!setting) {
							res.status(200).json({
								status: 0,
								message: "Setting Not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								setting: setting,
							});
						}
					}
				);

		}
	);
});

/**
 * @swagger
 * /merchant/getzoneList:
 *  post:
 *    description: Use to get merchant's zone list
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/getzoneList", jwtTokenAuth, (req, res) => {
	const { merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!merchant || merchant == null || merchant == undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err1, admin) {
						if (err1) {
							console.log(err1);
							var message1 = err;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
								var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}
		
			Zone.find({ merchant_id: merchant_id }, async (err8, zones) => {
				if (err3) {
					console.log(err3);
					var message3 = err3;
					if (err3.message) {
						message3 = err3.message;
					}
					res.status(200).json({
						status: 0,
						message: message3,
					});
				} else {
					res.status(200).json({
						status: 1,
						list: zones,
					});
				}
			});
			
		}
	);
});

/**
 * @swagger
 * /merchant/getsubzoneList:
 *  post:
 *    description: Use to get merchant's subzone list
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/getsubzoneList", jwtTokenAuth, (req, res) => {
	const { merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!merchant || merchant == null || merchant == undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err1, admin) {
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
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
								var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
								if (result2.status == 0) {
									res.status(200).json(result);
								}
							});
						}	
					}
				);
			}
			
			Subzone.find({ merchant_id: merchant_id }, async (err7, subzones) => {
				if (err3) {
					console.log(err3);
					var message3 = err3;
					if (err3.message) {
						message3 = err3.message;
					}
					res.status(200).json({
						status: 0,
						message: message3,
					});
				} else {
					res.status(200).json({
						status: 1,
						list: subzones,
					});
				}
			});
			
		}
	);
});

/**
 * @swagger
 * /merchant/getbranchList:
 *  post:
 *    description: Use to get merchant's branch list
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/getbranchList", jwtTokenAuth, (req, res) => {
	const { merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!merchant || merchant == null || merchant == undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err1, admin) {
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
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
								var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}
			MerchantBranch.find({ merchant_id: merchant_id }, async (err3, branches) => {
				if (err3) {
					console.log(err3);
					var message3 = err3;
					if (err3.message) {
						message3 = err3.message;
					}
					res.status(200).json({
						status: 0,
						message: message3,
					});
				} else {
					res.status(200).json({
						status: 1,
						list: branches,
					});
				}
			});
			
		}
	);
});

/**
 * @swagger
 * /merchant/getZoneStats:
 *  post:
 *    description: Use to get merchant's zone's stats
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/getZoneStats",jwtTokenAuth,function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { zone_id } = req.body;
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!merchant || merchant == null || merchant == undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err1, admin) {
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
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
								var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}
				Invoice.aggregate(
					[
						{
							$match: {
								zone_id: zone_id,
								created_at: {
									$gte: new Date(
										start
									),
									$lte: new Date(
										end
									),
								},
								paid: 1,
							},
						},
						{
							$group: {
								_id: null,
								amount_paid: { $sum: "$amount" },
								bills_paid: { $sum: 1 },
							},
						},
					],async (err3, post6) => {
						let result3 = errorMessage(
							err3,
							post6,
							"Error."
						);
						if (result3.status == 0) {
							res.status(200).json(result3);
						} else {
							Invoice.aggregate(
								[
									{
										$match: {
											zone_id: zone_id,
											created_at: {
												$gte: new Date(
													start
												),
												$lte: new Date(
													end
												),
											},
										},
									},
									{
										$group: {
											_id: null,
											amount_generated: { $sum: "$amount" },
											bills_generated: { $sum: 1 },
										},
									},
								],async (err4, post7) => {
									let result4 = errorMessage(
										err4,
										post7,
										"Error."
									);
									if (result4.status == 0) {
										res.status(200).json(result4);
									} else {
										Invoice.aggregate(
											[
												{
													$match: {
														zone_id: zone_id,
														paid: 0,
													},
												},
												{
													$group: {
														_id: null,
														amount_pending: { $sum: "$amount" },
														bills_pending: { $sum: 1 },
													},
												},
											],async (err5, post8) => {
												let result5 = errorMessage(
													err5,
													post8,
													"Error."
												);
												if (result5.status == 0) {
													res.status(200).json(result5);
												} else {
													let apen = 0;
													let bpen = 0;
													let ag = 0;
													let bg = 0;
													let ap = 0;
													let bp = 0;
													if (
														post6 != undefined &&
														post6 != null &&
														post6.length > 0
													) {
														ap = post6[0].amount_paid;
														bp = post6[0].bills_paid;
													}
													if (
														post7 != undefined &&
														post7 != null &&
														post7.length > 0
													) {
														ag = post7[0].amount_generated;
														bg = post7[0].bills_generated;
													}
													if (
														post8 != undefined &&
														post8 != null &&
														post8.length > 0
													) {
														apen = post8[0].amount_pending;
														bpen = post8[0].bills_pending;
													}
													res.status(200).json({
														status: 1,
														amount_generated: ag,
														bill_generated: bg,
														amount_paid: ap,
														bill_paid: bp,
														amount_pending: apen,
														bill_pending: bpen,
														post7:post7,
														post6:post6,
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
	);
});

/**
 * @swagger
 * /merchant/getWalletBalance:
 *  post:
 *    description: Use to get merchant's wallet balance
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.get("/merchant/getWalletBalance", jwtTokenAuth, (req, res) => {
	const username = req.sign_creds.username;
	Merchant.findOne(
		{
			username,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!merchant || merchant == null || merchant == undefined){
				MerchantStaff.findOne(
					{
						username: username,
						role: "admin",
					},
					function (err1, admin) {
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
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
								var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								} else {
									Bank.findOne({ _id: adminmerchant.bank_id }, (err3, bank) => {
										let result3 = errorMessage(err3, bank, "Bank not found");
										if (result3.status == 0) {
											res.status(200).json(result3);
										} else {
											const wallet_id = adminmerchant.wallet_ids.operational;
											blockchain
												.getBalance(wallet_id)
												.then(function (result) {
													res.status(200).json({
														status: 1,
														balance: result,
													});
												})
												.catch((error) => {
													res.status(200).json(catchError(error));
												});
										}
									});
								}
							});
						}	
					}
				);
			} else {
				Bank.findOne({ _id: merchant.bank_id }, (err4, bank) => {
					let result4 = errorMessage(err4, bank, "Bank not found");
					if (result4.status == 0) {
						res.status(200).json(result4);
					} else {
						const wallet_id = merchant.wallet_ids.operational;
						blockchain
							.getBalance(wallet_id)
							.then(function (result) {
								res.status(200).json({
									status: 1,
									balance: result,
								});
							})
							.catch((error) => {
								res.status(200).json(catchError(error));
							});
					}
				});
			}
		}
	);
});

/**
 * @swagger
 * /merchant/getMerchantSubzoneListDashStats:
 *  post:
 *    description: Use to get merchant's subzone's stats
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/getMerchantSubzoneListDashStats", jwtTokenAuth, function (req, res) {
	const { zone_id } = req.body;
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, merchant) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!merchant || merchant == null || merchant == undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err1, admin) {
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
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
								var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}
	
				Invoice.aggregate(
					[
						{
							$match: {
								zone_id: zone_id,
								created_at: {
									$gte: new Date(
										start
									),
									$lte: new Date(
										end
									),
								},
								paid:1,
							},
						},
						{
							$group: {
								_id: "$paid_by",
								amount_paid: { $sum: "$amount" },
								bills_paid: { $sum: 1 },
							},
						},
					],async (err3, post6) => {
						let result3 = errorMessage(
							err3,
							post6,
							"Error."
						);
						if (result3.status == 0) {
							res.status(200).json(result3);
						} else {
							Invoice.aggregate(
								[
									{
										$match: {
											zone_id: zone_id,
											created_at: {
												$gte: new Date(
													start
												),
												$lte: new Date(
													end
												),
											},
										},
									},
									{
										$group: {
											_id: "$is_created",
											amount_generated: { $sum: "$amount" },
											bills_generated: { $sum: 1 },
										},
									},
								],async (err4, post7) => {
									let result4 = errorMessage(
										err4,
										post7,
										"Error."
									);
									if (result4.status == 0) {
										res.status(200).json(result4);
									} else {
										Invoice.aggregate(
											[
												{
													$match: {
														zone_id: zone_id,
														paid: 0,
													},
												},
												{
													$group: {
														_id: null,
														amount_pending: { $sum: "$amount" },
														bills_pending: { $sum: 1 },
													},
												},
											],async (err5, post8) => {
												let result5 = errorMessage(
													err5,
													post8,
													"Error."
												);
												if (result5.status == 0) {
													res.status(200).json(result5);
												} else {
													let ap = 0;
													let bp = 0;
													if (
														post8 != undefined &&
														post8 != null &&
														post8.length > 0
													) {
														ap = post8[0].amount_pending;
														bp = post8[0].bills_pending;
													}
													res.status(200).json({
														status: 1,
														post6:post6,
														post7:post7,
														amount_pending: ap,
														bills_pending: bp,
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
	);
});

/**
 * @swagger
 * /merchant/getMerchantBranchListDashStats:
 *  post:
 *    description: Use to get merchant's branch's stats
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/getMerchantBranchListDashStats", jwtTokenAuth, function (req, res) {
	const { subzone_id } = req.body;
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, merchant) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!merchant || merchant == null || merchant == undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err1, admin) {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
								var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}
				Invoice.aggregate(
					[
						{
							$match: {
								subzone_id: subzone_id,
								created_at: {
									$gte: new Date(
										start
									),
									$lte: new Date(
										end
									),
								},
								paid:1,
							},
						},
						{
							$group: {
								_id: "$paid_by",
								amount_paid: { $sum: "$amount" },
								bills_paid: { $sum: 1 },
							},
						},
					],async (err3, post6) => {
						let result3 = errorMessage(
							err3,
							post6,
							"Error."
						);
						if (result3.status == 0) {
							res.status(200).json(result3);
						} else {
							Invoice.aggregate(
								[
									{
										$match: {
											subzone_id: subzone_id,
											created_at: {
												$gte: new Date(
													start
												),
												$lte: new Date(
													end
												),
											},
										},
									},
									{
										$group: {
											_id: "$is_created",
											amount_generated: { $sum: "$amount" },
											bills_generated: { $sum: 1 },
										},
									},
								],async (err4, post7) => {
									let result4 = errorMessage(
										err4,
										post7,
										"Error."
									);
									if (result4.status == 0) {
										res.status(200).json(result4);
									} else {
										Invoice.aggregate(
											[
												{
													$match: {
														subzone_id: subzone_id,
														paid: 0,
													},
												},
												{
													$group: {
														_id: null,
														amount_pending: { $sum: "$amount" },
														bills_pending: { $sum: 1 },
													},
												},
											],async (err5, post8) => {
												let result5 = errorMessage(
													err5,
													post8,
													"Error."
												);
												if (result5.status == 0) {
													res.status(200).json(result5);
												} else {
													let ap = 0;
													let bp = 0;
													if (
														post8 != undefined &&
														post8 != null &&
														post8.length > 0
													) {
														ap = post8[0].amount_pending;
														bp = post8[0].bills_pending;
													}
													res.status(200).json({
														status: 1,
														post6:post6,
														post7:post7,
														amount_pending: ap,
														bills_pending: bp,
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
	);
});

/**
 * @swagger
 * /merchant/listSubzonesByZoneId:
 *  post:
 *    description: Use to get subzones by zone id
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post(
	"/merchant/listSubzonesByZoneId",
	jwtTokenAuth,
	function (req, res) {
		const { zone_id } = req.body;
		const jwtusername = req.sign_creds.username;
		Merchant.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err, merchant) {
				if (err) {
					var message = err;
					if (err.message) {
						message = err.message;
					}
					res.status(200).json({
						status: 0,
						message: message,
					});
				}else if (!merchant || merchant == null || merchant == undefined){
					MerchantStaff.findOne(
						{
							username: jwtusername,
							role: "admin",
						},
						function (err1, admin) {
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
							}else if (!admin || admin==null || admin == undefined){
								res.status(200).json({
									status: 0,
									message: "User not found",
								});
							} else {
								Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
									var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
									if (result2.status == 0) {
										res.status(200).json(result2);
									}
								});
							}	
						}
					);
				}
					Subzone.find(
						{ zone_id: zone_id },
						function (err3, subzone) {
							if (err3) {
								console.log(err3);
								var message3 = err3;
								if (err3.message) {
									message3 = err3.message;
								}
								res.status(200).json({
									status: 0,
									message: message3,
								});
							} else {
								res.status(200).json({
									status: 1,
									subzones: subzone,
								});
							}
						}
					);
			}
		);
	}
);

/**
 * @swagger
 * /merchant/getSubZoneStats:
 *  post:
 *    description: Use to get subzone's stats
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/getSubZoneStats",jwtTokenAuth,function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { subzone_id } = req.body;
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!merchant || merchant == null || merchant == undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err1, admin) {
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
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
								var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}
			

				Invoice.aggregate(
					[
						{
							$match: {
								subzone_id: subzone_id,
								created_at: {
									$gte: new Date(
										start
									),
									$lte: new Date(
										end
									),
								},
								paid: 1,
							},
						},
						{
							$group: {
								_id: null,
								amount_paid: { $sum: "$amount" },
								bills_paid: { $sum: 1 },
							},
						},
					],async (err3, post6) => {
						let result3 = errorMessage(
							err3,
							post6,
							"Error."
						);
						if (result3.status == 0) {
							res.status(200).json(result3);
						} else {
							Invoice.aggregate(
								[
									{
										$match: {
											subzone_id: subzone_id,
											created_at: {
												$gte: new Date(
													start
												),
												$lte: new Date(
													end
												),
											},
										},
									},
									{
										$group: {
											_id: null,
											amount_generated: { $sum: "$amount" },
											bills_generated: { $sum: 1 },
										},
									},
								],async (err4, post7) => {
									let result4 = errorMessage(
										err4,
										post7,
										"Error."
									);
									if (result4.status == 0) {
										res.status(200).json(result4);
									} else {
										let ag = 0;
										let bg = 0;
										let ap = 0;
										let bp = 0;
										if (
											post6 != undefined &&
											post6 != null &&
											post6.length > 0
										) {
											ap = post6[0].amount_paid;
											bp = post6[0].bills_paid;
										}
										if (
											post7 != undefined &&
											post7 != null &&
											post7.length > 0
										) {
											ag = post7[0].amount_generated;
											bg = post7[0].bills_generated;
										}
										res.status(200).json({
											status: 1,
											amount_generated: ag,
											bill_generated: bg,
											amount_paid: ap,
											bill_paid: bp,
											post7:post7,
											post6:post6,
										});
									}
								}
							);
						}
					}		
				);
			
		}
	);
});

/**
 * @swagger
 * /merchant/getBranchStats:
 *  post:
 *    description: Use to get branch's stats
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/getBranchStats",jwtTokenAuth,function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { branch_id } = req.body;
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!merchant || merchant == null || merchant == undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err1, admin) {
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
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
								var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}
			

				Invoice.aggregate(
					[
						{
							$match: {
								branch_id: branch_id,
								created_at: {
									$gte: new Date(
										start
									),
									$lte: new Date(
										end
									),
								},
								paid: 1,
							},
						},
						{
							$group: {
								_id: null,
								amount_paid: { $sum: "$amount" },
								bills_paid: { $sum: 1 },
							},
						},
					],async (err3, post6) => {
						let result3 = errorMessage(
							err3,
							post6,
							"Error."
						);
						if (result3.status == 0) {
							res.status(200).json(result3);
						} else {
							Invoice.aggregate(
								[
									{
										$match: {
											branch_id: branch_id,
											created_at: {
												$gte: new Date(
													start
												),
												$lte: new Date(
													end
												),
											},
										},
									},
									{
										$group: {
											_id: null,
											amount_generated: { $sum: "$amount" },
											bills_generated: { $sum: 1 },
										},
									},
								],async (err4, post7) => {
									let result4 = errorMessage(
										err4,
										post7,
										"Error."
									);
									if (result4.status == 0) {
										res.status(200).json(result4);
									} else {
										let ag = 0;
										let bg = 0;
										let ap = 0;
										let bp = 0;
										if (
											post6 != undefined &&
											post6 != null &&
											post6.length > 0
										) {
											ap = post6[0].amount_paid;
											bp = post6[0].bills_paid;
										}
										if (
											post7 != undefined &&
											post7 != null &&
											post7.length > 0
										) {
											ag = post7[0].amount_generated;
											bg = post7[0].bills_generated;
										}
										res.status(200).json({
											status: 1,
											amount_generated: ag,
											bill_generated: bg,
											amount_paid: ap,
											bill_paid: bp,
											post7:post7,
											post6:post6,
										});
									}
								}
							);
						}
					}		
				);
			
		}
	);
});

router.post(
	"/merchant/listBranchesBySubzoneId",
	jwtTokenAuth,
	function (req, res) {
		const { subzone_id } = req.body;
		const jwtusername = req.sign_creds.username;
		Merchant.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err, merchant) {
				if (err) {
					var message = err;
					if (err.message) {
						message = err.message;
					}
					res.status(200).json({
						status: 0,
						message: message,
					});
				}else if (!merchant || merchant == null || merchant == undefined){
					MerchantStaff.findOne(
						{
							username: jwtusername,
							role: "admin",
						},
						function (err1, admin) {
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
							}else if (!admin || admin==null || admin == undefined){
								res.status(200).json({
									status: 0,
									message: "User not found",
								});
							} else {
								Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
									var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
									if (result2.status == 0) {
										res.status(200).json(result2);
									}
								});
							}	
						}
					);
				}
					MerchantBranch.find(
						{  subzone_id: subzone_id },
						function (err3, branch1) {
							if (err3) {
								console.log(err3);
								var message3= err3;
								if (err3.message) {
									message3 = err3.message;
								}
								res.status(200).json({
									status: 0,
									message: message3,
								});
							} else {
								res.status(200).json({
									status: 1,
									branches: branch1,
								});
							}
						}
					);
				
			}
		);
	}
);

router.post("/merchant/:type/getStatsBydate",jwtTokenAuth,function (req, res) {
	const jwtusername = req.sign_creds.username;
	const type = req.params.type;
	const { id, date } = req.body;
	var today = new Date(date);
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!merchant || merchant == null || merchant == undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err1, admin) {
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
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
								var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}

				Invoice.aggregate(
					[
						{
							$match: {
								[`${type}_id`] : id,
								created_at: {
									$gte: new Date(
										start
									),
									$lte: new Date(
										end
									),
								},
								paid:1,
							},
						},
						{
							$group: {
								_id: "$paid_by",
								amount_paid: { $sum: "$amount" },
								penalty: { $sum: "$penalty"},
								bills_paid: { $sum: 1 },
							},
						},
					],async (err3, post6) => {
						let result3 = errorMessage(
							err3,
							post6,
							"Error."
						);
						if (result3.status == 0) {
							res.status(200).json(result3);
						} else {
							Invoice.aggregate(
								[
									{
										$match: {
											[`${type}_id`] : id,
											created_at: {
												$gte: new Date(
													start
												),
												$lte: new Date(
													end
												),
											},
										},
									},
									{
										$group: {
											_id: null,
											amount_generated: { $sum: "$amount" },
											bills_generated: { $sum: 1 },
										},
									},
								],async (err4, post7) => {
									let result4 = errorMessage(
										err4,
										post7,
										"Error."
									);
									if (result4.status == 0) {
										res.status(200).json(result4);
									} else {
										let ag = 0;
										let bg = 0;
										let InvoicePaidByMC = 0;
										let InvoicePaidByBC = 0;
										let InvoicePaidByPC = 0;
										let InvoicePaidByUS = 0;
										let AmountPaidByMC = 0;
										let AmountPaidByBC = 0;
										let AmountPaidByPC = 0;
										let AmountPaidByUS = 0;
										let InvoicePaid = 0;
										let AmountPaid = 0;
										if (
											post7 != undefined &&
											post7 != null &&
											post7.length > 0
										) {
											ag = post7[0].amount_generated;
											bg = post7[0].bills_generated;
										}
										if (
											post6 != undefined &&
											post6 != null &&
											post6.length > 0
										) {
											const PaidByMC = await post6.filter((val) => {
												return val._id=='MC'
											});
											const PaidByBC = await post6.filter((val) => {
												return val._id=='BC'
											});
											const PaidByPC = await post6.filter((val)=>{
												return val._id=='PC'
											});
											const PaidByUS = await post6.filter((val)=>{
												return val._id=='US'
											});
											if(PaidByMC.length > 0){
												InvoicePaidByMC = PaidByMC[0].bills_paid;
												AmountPaidByMC = PaidByMC[0].amount_paid + PaidByMC[0].penalty;
											}
											if(PaidByBC.length > 0){
												InvoicePaidByBC = PaidByBC[0].bills_paid;
												AmountPaidByBC = PaidByBC[0].amount_paid + PaidByBC[0].penalty;
											}
											if(PaidByPC.length > 0){
												InvoicePaidByPC = PaidByPC[0].bills_paid;
												AmountPaidByPC = PaidByPC[0].amount_paid + PaidByPC[0].penalty;
											}
											if(PaidByUS.length > 0){
												InvoicePaidByUS = PaidByUS[0].bills_paid;
												AmountPaidByUS = PaidByUS[0].amount_paid + PaidByUS[0].penalty;
											}

											InvoicePaid = await post6.reduce((a, b) => {
												return a + b.bills_paid;
											}, 0);
											
											AmountPaid = await post6.reduce((a, b) => {
												return a + b.amount_paid;
											}, 0);
										}
										res.status(200).json({
											status: 1,
											amount_generated: ag,
											bill_generated: bg,
											amount_paid: AmountPaid,
											bill_paid: InvoicePaid,
											bill_paid_by_MC : InvoicePaidByMC,
											amount_paid_by_MC: AmountPaidByMC,
											bill_paid_by_PC : InvoicePaidByPC,
											amount_paid_by_PC: AmountPaidByPC,
											bill_paid_by_BC : InvoicePaidByBC,
											amount_paid_by_BC: AmountPaidByBC,
											bill_paid_by_US : InvoicePaidByUS,
											amount_paid_by_US: AmountPaidByUS,
											post7:post7,
											post6:post6,
										});
									}
								}
							);
						}
					}		
				);
			
		}
	);
});

router.post("/merchant/:type/getStatsByPeriod",jwtTokenAuth,function (req, res) {
	const jwtusername = req.sign_creds.username;
	const type = req.params.type;
	const { id, period_name } = req.body;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!merchant || merchant == null || merchant == undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err1, admin) {
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
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
								var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}
			
				Invoice.aggregate(
					[
						{
							$match: {
								[`${type}_id`] : id,
								"bill_period.period_name": period_name,
								paid: 1,
							},
						},
						{
							$group: {
								_id: "$paid_by", 
								amount_paid: { $sum: "$amount" },
								bills_paid: { $sum: 1 },
								penalty: { $sum: "$penalty"},
							},
						},
					],async (err3, post6) => {
						let result3 = errorMessage(
							err3,
							post6,
							"Error."
						);
						if (result3.status == 0) {
							res.status(200).json(result3);
						} else {
							Invoice.aggregate(
								[
									{
										$match: {
											[`${type}_id`] : id,
											"bill_period.period_name": period_name,
										},
									},
									{
										$group: {
											_id: null,
											amount_generated: { $sum: "$amount" },
											bills_generated: { $sum: 1 },
										},
									},
								],async (err4, post7) => {
									let result4 = errorMessage(
										err4,
										post7,
										"Error."
									);
									if (result4.status == 0) {
										res.status(200).json(result4);
									} else {
										let ag = 0;
										let bg = 0;
										let InvoicePaidByMC = 0;
										let InvoicePaidByBC = 0;
										let InvoicePaidByPC = 0;
										let InvoicePaidByUS = 0;
										let AmountPaidByMC = 0;
										let AmountPaidByBC = 0;
										let AmountPaidByPC = 0;
										let AmountPaidByUS = 0;
										let InvoicePaid = 0;
										let AmountPaid = 0;
										if (
											post7 != undefined &&
											post7 != null &&
											post7.length > 0
										) {
											ag = post7[0].amount_generated;
											bg = post7[0].bills_generated;
										}
										if (
											post6 != undefined &&
											post6 != null &&
											post6.length > 0
										) {
											const PaidByMC = await post6.filter((val) => {
												return val._id=='MC'
											});
											const PaidByBC = await post6.filter((val) => {
												return val._id=='BC'
											});
											const PaidByPC = await post6.filter((val)=>{
												return val._id=='PC'
											});
											const PaidByUS = await post6.filter((val)=>{
												return val._id=='US'
											});
											if(PaidByMC.length > 0){
												InvoicePaidByMC = PaidByMC[0].bills_paid;
												AmountPaidByMC = PaidByMC[0].amount_paid + PaidByMC[0].penalty;
											}
											if(PaidByBC.length > 0){
												InvoicePaidByBC = PaidByBC[0].bills_paid;
												AmountPaidByBC = PaidByBC[0].amount_paid + PaidByBC[0].penalty;
											}
											if(PaidByPC.length > 0){
												InvoicePaidByPC = PaidByPC[0].bills_paid;
												AmountPaidByPC = PaidByPC[0].amount_paid + PaidByPC[0].penalty;
											}
											if(PaidByUS.length > 0){
												InvoicePaidByUS = PaidByUS[0].bills_paid;
												AmountPaidByUS = PaidByUS[0].amount_paid + PaidByUS[0].penalty;
											}

											InvoicePaid = await post6.reduce((a, b) => {
												return a + b.bills_paid;
											}, 0);
											
											AmountPaid = await post6.reduce((a, b) => {
												return a + b.amount_paid;
											}, 0);
										}
										res.status(200).json({
											status: 1,
											amount_generated: ag,
											bill_generated: bg,
											amount_paid: AmountPaid,
											bill_paid: InvoicePaid,
											bill_paid_by_MC : InvoicePaidByMC,
											amount_paid_by_MC: AmountPaidByMC,
											bill_paid_by_PC : InvoicePaidByPC,
											amount_paid_by_PC: AmountPaidByPC,
											bill_paid_by_BC : InvoicePaidByBC,
											amount_paid_by_BC: AmountPaidByBC,
											bill_paid_by_US : InvoicePaidByUS,
											amount_paid_by_US: AmountPaidByUS,
											post7:post7,
											post6:post6,
										});
									}
								}
							);
						}
					}		
				);
			
		}
	);
});

/**
 * @swagger
 * /merchant/listOfferings:
 *  post:
 *    description: Use to get offering list
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/listOfferings", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { merchant_id } = req.body;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!merchant || merchant == null || merchant == undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err1, admin) {
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
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
								var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}
		
				Offering.find({ merchant_id: merchant_id }, (err3, offerings) => {
					if (err3) {
						console.log(err3);
						var message3 = err3;
						if (err3.message) {
							message3 = err3.message;
						}
						res.status(200).json({
							status: 0,
							message: message3,
						});
					} else {
						res.status(200).json({
							status: 1,
							offerings: offerings,
						});
					}
				});
			
		}
	);
});

/**
 * @swagger
 * /merchant/listTaxes:
 *  post:
 *    description: Use to get tax list
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/listTaxes", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { merchant_id } = req.body;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!merchant || merchant == null || merchant == undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err1, admin) {
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
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
								var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}
				Tax.find({ merchant_id: merchant_id }, (err3, taxes) => {
					if (err3) {
						console.log(err3);
						var message3 = err3;
						if (err3.message) {
							message3 = err3.message;
						}
						res.status(200).json({
							status: 0,
							message: message3,
						});
					} else {
						res.status(200).json({
							status: 1,
							taxes: taxes,
						});
					}
				});
		}
	);
});

/**
 * @swagger
 * /merchant/listInvoiceGroups:
 *  post:
 *    description: Use to get list of invoice groups 
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/listInvoiceGroups", jwtTokenAuth, (req, res) => {
	const { merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!merchant || merchant == null || merchant == undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err1, admin) {
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
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
								var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}
				InvoiceGroup.find({ merchant_id: merchant_id }, (err3, groups) => {
					if (err3) {
						console.log(err3);
						var message3 = err3;
						if (err3.message) {
							message3 = err3.message;
						}
						res.status(200).json({
							status: 0,
							message: message3,
						});
					} else {
						res.status(200).json({
							status: 1,
							message: "Invoice Groups list",
							groups: groups,
						});
					}
				});
			
		}
	);
});

/**
 * @swagger
 * /merchant/createInvoiceGroup:
 *  post:
 *    description: Use to create invoice group
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/createInvoiceGroup", jwtTokenAuth, (req, res) => {
	let data = new InvoiceGroup();
	const { code, name, description } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			let result = errorMessage(err, merchant, "Merchant is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				data.code = code;
				data.name = name;
				data.description = description;
				data.merchant_id = merchant._id;
				data.save((err1, group) => {
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
						return res.status(200).json({
							status: 1,
							message: "Invoice Category Created",
							group: group,
						});
					}
				});
			}
		}
	);
});

/**
 * @swagger
 * /merchant/listCustomers:
 *  post:
 *    description: Use to get list of customers 
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/listCustomers", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { merchant_id } = req.body;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!merchant || merchant == null || merchant == undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err1, admin) {
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
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
								var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}
				Customer.find({ merchant_id: merchant_id }, (err3, customers) => {
					if (err) {
						console.log(err3);
						var message3 = err3;
						if (err3.message) {
							message3 = err3.message;
						}
						res.status(200).json({
							status: 0,
							message: message3,
						});
					} else {
						res.status(200).json({
							status: 1,
							customers: customers,
						});
					}
				});
		}
	);
});


/**
 * @swagger
 * /merchant/listStaff:
 *  post:
 *    description: Use to get list of merchant staffs 
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/listStaff", jwtTokenAuth, (req, res) => {
	const jwtusername = req.sign_creds.username;
	const { merchant_id } = req.body;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!merchant || merchant == null || merchant == undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err1, admin) {
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
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
								var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}
				MerchantStaff.find(
					{ merchant_id: merchant_id },
					(err3, staffs) => {
						if (err3) {
							console.log(err3);
							var message3= err3;
							if (err3.message) {
								message3 = err3.message;
							}
							res.status(200).json({
								status: 0,
								message: message3,
							});
						} else {
							res.status(200).json({
								status: 1,
								staffs: staffs,
							});
						}
					}
				);
			
		}
	);
});


/**
 * @swagger
 * /merchant/listStaff:
 *  post:
 *    description: Use to get merchant's transaction history
 *    responses:
 *      '200':
 *        description: A successful response
 */
 
router.post("/merchant/getTransHistory", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!merchant || merchant == null || merchant == undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err1, admin) {
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
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
								var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}else{
									Bank.findOne(
										{
											_id: adminmerchant.bank_id,
										},
										function (err3) {
											if (err3) {
												console.log(err3);
												var message3 = err3;
												if (err3.message) {
													message3 = err3.message;
												}
												res.status(200).json({
													status: 0,
													message: message3,
												});
											} else {
												const wallet = adminmerchant.wallet_ids.operational;
												blockchain
													.getStatement(wallet)
													.then(function (history) {
														res.status(200).json({
															status: 1,
															history: history,
														});
													})
													.catch((error) => {
														res.status(200).json(catchError(error));
													});
											}
										}
									);
								}
							});
						}	
					}
				);
			} else {
				Bank.findOne(
					{
						_id: merchant.bank_id,
					},
					function (err4) {
						if (err4) {
							console.log(err4);
							var message4 = err4;
							if (err4.message) {
								message4 = err4.message;
							}
							res.status(200).json({
								status: 0,
								message: message4,
							});
						} else {
							const wallet = merchant.wallet_ids.operational;
							blockchain
								.getStatement(wallet)
								.then(function (history) {
									res.status(200).json({
										status: 1,
										history: history,
									});
								})
								.catch((error) => {
									res.status(200).json(catchError(errors));
								});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/uploadCustomers", jwtTokenAuth, (req, res) => {
	const { customers } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{ username: jwtusername, status: 1 },
		async function (err, merchant) {
			let result = errorMessage(
				err,
				merchant,
				"You are either not authorised or not logged in."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				let failed = [];
				for (let customer of customers) {
					try {
						var customerFound = await Customer.findOne({
							merchant_id: merchant._id,
							customer_code: customer.customer_code,
						});
						if (customerFound) {
							throw new Error(
								"Customer with the same customer code already exist"
							);
						} else {
							var customerDetails = {
								customer_code: customer.customer_code,
								merchant_id: merchant._id,
								name: customer.name,
								last_name: customer.last_name,
								mobile: customer.mobile,
								email: customer.email,
								address: customer.address,
								city: customer.city,
								state: customer.state,
								country: customer.country,
								id_type: customer.id_type,
								id_name: customer.id_name,
								valid_till: customer.valid_till,
								id_number: customer.id_number,
								dob: customer.dob,
								gender: customer.gender,
								docs_hash: customer.docs_hash,
							};
							await Customer.create(customerDetails);
						}
					} catch (error) {
						console.log(error);
						var message1 = error;
						if (error && error.message) {
							message1 = error.message;
						}
						customer.failure_reason = message1;
						failed.push(customer);
					}
				}
				res.status(200).json({
					status: 1,
					message: "Customers uploaded",
					failed: failed,
				});
			}
		}
	);
});

router.post("/merchant/zoneSetting", jwtTokenAuth, (req, res) => {
	const { zone_name, subzone_name } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
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
				MerchantSettings.countDocuments(
					{ merchant_id: merchant._id },
					(err1, count) => {
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
						} else if (count == 1) {
							MerchantSettings.findOneAndUpdate(
								{ merchant_id: merchant._id },
								{ zone_name: zone_name, subzone_name: subzone_name },
								{ new: true },
								function (err2, setting) {
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
									} else if (setting == null) {
										console.log(err3);
										res.status(200).json({
											status: 0,
											message: "Setting not found",
											err: err3,
										});
									} else {
										res.status(200).json({
											status: 1,
											message: "Zone Settings Edited",
										});
									}
								}
							);
						} else {
							const data = new MerchantSettings();
							data.merchant_id = merchant._id;
							data.zone_name = zone_name;
							data.subzone_name = subzone_name;
							data.save((err4) => {
								if (err4) {
									console.log(err4);
									var message4 = err4;
									if (err4.message) {
										message4 = err4.message;
									}
									res.status(200).json({
										status: 0,
										message: message4,
									});
								} else {
									res.status(200).json({
										status: 1,
										message: "Zone Settings Created",
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

router.post("/merchant/editPenaltyRule", jwtTokenAuth, (req, res) => {
	const penalty_rule = {
		type: req.body.type,
		percentage: req.body.percentage,
		fixed_amount: req.body.fixed_amount,
	};
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
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
				MerchantSettings.countDocuments(
					{ merchant_id: merchant._id },
					(err1, count) => {
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
						} else if (count == 1) {
							MerchantSettings.findOneAndUpdate(
								{ merchant_id: merchant._id },
								{ penalty_rule: penalty_rule },
								{ new: true },
								function (err2, setting) {
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
									} else if (setting == null) {
										console.log(err2);
										res.status(200).json({
											status: 0,
											message: "Setting not found",
											err: err2,
										});
									} else {
										res.status(200).json({
											status: 1,
											message: "Penalty Rule Edited",
										});
									}
								}
							);
						} else {
							const data = new MerchantSettings();
							data.merchant_id = merchant._id;
							data.penalty_rule = penalty_rule;
							data.save((err3) => {
								if (err3) {
									console.log(err3);
									var message3 = err3;
									if (err3.message) {
										message3 = err3.message;
									}
									res.status(200).json({
										status: 0,
										message: message3,
									});
								} else {
									res.status(200).json({
										status: 1,
										message: "Penalty Rule Edited",
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


/**
 * @swagger
 * /merchant/addBillPeriod:
 *  post:
 *    description: Use to create bill period
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/addBillPeriod", jwtTokenAuth, (req, res) => {
	const billperiod = {
		start_date: req.body.start_date,
		end_date: req.body.end_date,
		period_name: req.body.period_name,
	};
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
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
				MerchantSettings.countDocuments(
					{ merchant_id: merchant._id },
					(err1, count) => {
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
						} else if (count == 1) {
							MerchantSettings.updateOne(
								{ merchant_id: merchant._id },
								{ $push: { bill_period: billperiod } },
								function (err2, setting) {
									if (err2) {
										console.log(err2);
										var message2 = err;
										if (err2.message) {
											message2 = err2.message;
										}
										res.status(200).json({
											status: 0,
											message: message2,
										});
									} else if (setting == null) {
										console.log(err2);
										res.status(200).json({
											status: 0,
											message: "Setting not found",
											err: err2,
										});
									} else {
										res.status(200).json({
											status: 1,
											message: "Bill Period Added",
										});
									}
								}
							);
						} else {
							const data = new MerchantSettings();
							data.merchant_id = merchant._id;
							data.bill_period = [billperiod];
							data.save((err3) => {
								if (err3) {
									console.log(err3);
									var message3 = err3;
									if (err3.message) {
										message3= err3.message;
									}
									res.status(200).json({
										status: 0,
										message: message3,
									});
								} else {
									res.status(200).json({
										status: 1,
										message: "Bill Periad Added",
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

/**
 * @swagger
 * /merchant/setDefaultBillPeriod:
 *  post:
 *    description: Use to set default bill period
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/setDefaultBillPeriod", jwtTokenAuth, (req, res) => {
	const period = {
		start_date: req.body.start_date,
		end_date: req.body.end_date,
		period_name: req.body.period_name,
	};
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
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
				MerchantSettings.findOneAndUpdate(
					{ merchant_id: merchant._id },
					{ default_bill_period: period },
					{ new: true },
					(err1, setting) => {
						let result1 = errorMessage(err1, setting, "Setting not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								status: 1,
								message: "Default bill period updated",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/setDefaultBillterm", jwtTokenAuth, (req, res) => {
	const term = {
		days: req.body.days,
		name: req.body.name,
	};
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
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
				MerchantSettings.findOneAndUpdate(
					{ merchant_id: merchant._id },
					{ default_bill_term: term },
					{ new: true },
					(err1, setting) => {
						let result1 = errorMessage(err1, setting, "Setting not found");
						if (result1.status == 0) {
							res1.status(200).json(result1);
						} else {
							res1.status(200).json({
								status: 1,
								message: "Default bill term updated",
							});
						}
					}
				);
			}
		}
	);
});

/**
 * @swagger
 * /merchant/addBillTerm:
 *  post:
 *    description: Use to add bill term
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/addBillTerm", jwtTokenAuth, (req, res) => {
	const billterm = {
		days: req.body.days,
		name: req.body.name,
	};
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
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
				MerchantSettings.countDocuments(
					{ merchant_id: merchant._id },
					(err1, count) => {
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
						} else if (count == 1) {
							MerchantSettings.updateOne(
								{ merchant_id: merchant._id },
								{ $push: { bill_term: billterm } },
								function (err2, setting) {
									if (err2) {
										console.log(err2);
										var message2 = err;
										if (err2.message) {
											message2 = err2.message;
										}
										res.status(200).json({
											status: 0,
											message: message2,
										});
									} else if (setting == null) {
										console.log(err2);
										res.status(200).json({
											status: 0,
											message: "Setting not found",
											err: err2,
										});
									} else {
										res.status(200).json({
											status: 1,
											message: "Bill Term Added",
										});
									}
								}
							);
						} else {
							const data = new MerchantSettings();
							data.merchant_id = merchant._id;
							data.bill_term = [billterm];
							data.save((err3) => {
								if (err3) {
									console.log(err3);
									var message3 = err3;
									if (err3.message) {
										message3 = err3.message;
									}
									res.status(200).json({
										status: 0,
										message: message3,
									});
								} else {
									res.status(200).json({
										status: 1,
										message: "Bill Term Added",
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

/**
 * @swagger
 * /merchant/deleteTax:
 *  post:
 *    description: Use to delete tax
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/deleteTax", jwtTokenAuth, function (req, res) {
	const { tax_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			let result = errorMessage(err, merchant, "Merchant is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Tax.deleteOne({ _id: tax_id }, (err1) => {
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
							message: "Tax deleted",
						});
					}
				});
			}
		}
	);
});

/**
 * @swagger
 * /merchant/editTax:
 *  post:
 *    description: Use to edit tax
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/editTax", jwtTokenAuth, function (req, res) {
	const { tax_id, code, name, value } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			let result = errorMessage(err, merchant, "Merchant is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Tax.findOneAndUpdate(
					{ _id: tax_id },
					{ code, name, value },
					{ new: true },
					(err1, tax) => {
						let result1 = errorMessage(err1, tax, "Tax not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								status: 1,
								message: "Tax edited successfully",
								tax: tax,
							});
						}
					}
				);
			}
		}
	);
});

/**
 * @swagger
 * /merchant/createTax:
 *  post:
 *    description: Use to create tax
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/createTax", jwtTokenAuth, function (req, res) {
	const { code, name, value } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			let result = errorMessage(err, merchant, "Merchant is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Tax.findOne(
					{
						code,
						merchant_id: merchant._id,
					},
					(err1, tax) => {
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
						} else if (tax) {
							res.status(200).json({
								status: 0,
								message: "Tax with this code already exist",
							});
						} else {
							const tax1 = new Tax();
							tax1.merchant_id = merchant._id;
							tax1.code = code;
							tax1.name = name;
							tax1.value = value;
							tax1.save((err2) => {
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
									res.status(200).json({
										status: 1,
										message: "Tax Created",
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

router.post("/merchant/deleteOffering", jwtTokenAuth, function (req, res) {
	const { offering_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			let result = errorMessage(err, merchant, "Merchant is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Offering.deleteOne({ _id: offering_id }, (err1) => {
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
							message: "Offering deleted",
						});
					}
				});
			}
		}
	);
});

/**
 * @swagger
 * /merchant/editOffering:
 *  post:
 *    description: Use to edit offering
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/editOffering", jwtTokenAuth, (req, res) => {
	const {
		offering_id,
		code,
		name,
		description,
		denomination,
		unit_of_measure,
		unit_price,
		type,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
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
				Offering.findOneAndUpdate(
					{ _id: offering_id, merchant_id: merchant._id },
					{
						code,
						name,
						description,
						denomination,
						unit_of_measure,
						unit_price,
						type,
					},
					{ new: true },
					(err1, offering) => {
						let result1 = errorMessage(err1, offering, "Offering not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								status: 1,
								message: "Offering edited successfully",
								offering: offering,
							});
						}
					}
				);
			}
		}
	);
});

/**
 * @swagger
 * /merchant/uploadOfferings:
 *  post:
 *    description: Use to upload offerings
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/uploadOfferings", jwtTokenAuth, function (req, res) {
	const { offerings } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, merchant) {
			let result = errorMessage(err, merchant, "Merchant is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				let failed = [];
				for (let offering of offerings) {
					try {
						var {
							code,
							name,
							description,
							denomination,
							unit_of_measure,
							unit_price,
							type,
						} = offering;
						var offeringFound = await Offering.findOne({
							code,
							merchant_id: merchant._id,
						});
						if (offeringFound) {
							throw new Error("Offering with this code already exist");
						} else {
							var offeringObj = new Offering();
							offeringObj.merchant_id = merchant._id;
							offeringObj.code = code;
							offeringObj.name = name;
							offeringObj.description = description;
							offeringObj.denomination = denomination;
							offeringObj.unit_of_measure = unit_of_measure;
							offeringObj.unit_price = unit_price;
							offeringObj.type = type;
							await offeringObj.save();
						}
					} catch (error) {
						console.log(error);
						var message = error.toString();
						if (error.message) {
							message = error.message;
						}
						offering.failure_reason = message;
						failed.push(offering);
					}
				}
				res.status(200).json({
					status: 1,
					message: "Offerings uploaded",
					failed: failed,
				});
			}
		}
	);
});

router.get("/merchant/todaysStatus", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			let result = errorMessage(err, merchant, "Merchant is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const today = new Date(); // "2020-06-09T18:30:00.772Z"
				Merchant.findOneAndUpdate(
					{
						_id: merchant._id,
						last_paid_at: {
							$lte: new Date(today.setHours(00, 00, 00)),
						},
					},
					{ amount_collected: 0 },
					{ new: true },
					(err1, merchant2) => {
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
						} else if (merchant2 != null) {
							merchant = merchant2;
						}
						res.status(200).json({
							status: 1,
							message: "Today's Status",
							todays_payment: merchant.amount_collected,
							last_paid_at: merchant.last_paid_at,
							due: merchant.amount_due,
							bills_paid: merchant.bills_paid,
							bills_raised: merchant.bills_raised,
						});
					}
				);
			}
		}
	);
});

router.post("/merchant/editDetails", jwtTokenAuth, function (req, res) {
	var { username, name, logo, description, document_hash, email } = req.body;
	const jwtusername = req.sign_creds.username;
	console.log(jwtusername);
	Merchant.findOneAndUpdate(
		{
			username: jwtusername,
			status: 1,
		},
		{
			username: username,
			name: name,
			logo: logo,
			description: description,
			document_hash: document_hash,
			email: email,
		},
		{ new: true },
		function (err, merchant) {
			let result = errorMessage(
				err,
				merchant,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				res.status(200).json({
					status: 1,
					message: "Merchant edited successfully",
					merchant: merchant,
				});
			}
		}
	);
});

/**
 * @swagger
 * /merchant/editZone:
 *  post:
 *    description: Use to edit merchant zone
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/editZone", jwtTokenAuth, (req, res) => {
	const { zone_id, code, name, type, description } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
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
				Zone.findOneAndUpdate(
					{ _id: zone_id },
					{ code: code, name: name, description: description, type: type },
					(err1, zone) => {
						let result1 = errorMessage(err1, zone, "Zone not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								status: 1,
								message: "Zone edited successfully",
							});
						}
					}
				);
			}
		}
	);
});

/**
 * @swagger
 * /merchant/createZone:
 *  post:
 *    description: Use to create merchant zone
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/createZone", jwtTokenAuth, (req, res) => {
	let data = new Zone();
	const { code, name, description, type } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
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
				data.code = code;
				data.name = name;
				data.description = description;
				data.merchant_id = merchant._id;
				data.type = type;
				data.branch_count = 0;
				data.subzone_count = 0;
				data.save((err1, zone) => {
					if (err1) {
						console.log(err1);
						var message1 = err;
						if (err1.message) {
							message1 = err1.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else {
						return res
							.status(200)
							.json({ status: 1, message: "Zone Created", zones: zone });
					}
				});
			}
		}
	);
});

/**
 * @swagger
 * /merchant/createSubzone:
 *  post:
 *    description: Use to create merchant subzone
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/createSubzone", jwtTokenAuth, (req, res) => {
	let data = new Subzone();
	const { code, name, description, type, zone_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
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
				data.code = code;
				data.name = name;
				data.description = description;
				data.merchant_id = merchant._id;
				data.type = type;
				data.zone_id = zone_id;
				data.branch_count = 0;
					data.save((err1, subzone) => {
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
							Zone.updateOne(
								{ _id: zone_id },
								{ $inc: { subzone_count: 1 } },
								function (err2, zone) {
									let result2 = errorMessage(
										err2,
										zone,
										"Zone not found"
									);
									if (result2.status == 0) {
										res.status(200).json(result2);
									} else {
										return res.status(200).json({
											status: 1,
											message: "Subzone Created",
											subzone: subzone,
										});
										
									}

								}
							);
							
						}
					});
			}
		}
	);
});


/**
 * @swagger
 * /merchant/editSubzone:
 *  post:
 *    description: Use to edit merchant subzone
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/editSubzone", jwtTokenAuth, (req, res) => {
	const { subzone_id, code, name, type, description } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
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
				Subzone.findOneAndUpdate(
					{ _id: subzone_id },
					{ code: code, name: name, description: description, type: type },
					(err1, subzone) => {
						let result1 = errorMessage(err1, subzone, "Subzone not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								status: 1,
								message: "subzone edited successfully",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/addPosition", jwtTokenAuth, (req, res) => {
	let data = new MerchantPosition();
	const { name, branch_id, working_from, working_to, type } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
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
				MerchantBranch.findOne({ _id: branch_id }, function (err1, branch) {
					let result1 = errorMessage(err1, branch, "Invalid branch");
					if (result1.status == 0) {
						res.status(200).json(result1);
					} else {
						data.name = name;
						data.working_from = working_from;
						data.working_to = working_to;
						data.merchant_id = merchant._id;
						data.branch_id = branch_id;
						data.bank_id = merchant.bank_id;
						data.type = type;
						data.save((err2, position) => {
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
								MerchantBranch.updateOne(
									{ _id: branch_id },
									{ $inc: { total_positions: 1 } },
									function (err3, branch3) {
										let result3 = errorMessage(err3, branch3, "Branch not found");
										if (result3.status == 0) {
											res.status(200).json(result3);
										} else {
											return res.status(200).json({
												status: 1,
												data: position,
											});	
										}
									}
								);
							}
						});
					}
				});
			}
		}
	);
});

router.post("/merchant/editPosition", jwtTokenAuth, (req, res) => {
	const { position_id, name, working_from, working_to } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			let result = errorMessage(err, merchant, "Merchant is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantPosition.findOneAndUpdate(
					{ _id: position_id, merchant_id: merchant._id },
					{
						name: name,
						working_from: working_from,
						working_to: working_to,
					},
					(err1, position) => {
						let result1 = errorMessage(err1, position, "Position not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								status: 1,
								message: "Edited merchant position successfully",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/listPosition", jwtTokenAuth, (req, res) => {
	const { branch_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			let result = errorMessage(err, merchant, "Merchant is not vaid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantPosition.find(
					{ merchant_id: merchant._id, branch_id: branch_id },
					(err1, positions) => {
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
								positions: positions,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/addStaff", jwtTokenAuth, (req, res) => {
	let data = new MerchantStaff();
	const jwtusername = req.sign_creds.username;
	const {
		role,
		code,
		name,
		email,
		ccode,
		mobile,
		read_only,
		username,
		password,
		branch_id,
		logo,
	} = req.body;
	Merchant.findOne(
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
				data.role = role;
				data.code = code;
				data.name = name;
				data.read_only = read_only;
				data.email = email;
				data.mobile = mobile;
				data.username = username;
				data.password = password;
				data.branch_id = branch_id;
				data.merchant_id = user._id;
				data.ccode = ccode;
				data.logo = logo;

				data.save((err1) => {
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
						let content =
							"<p>Your have been added as a Merchant Staff in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
							config.mainIP +
							"/merchant/cashier/" +
							name +
							"'>http://" +
							config.mainIP +
							"/merchant/cashier/" +
							name +
							"</a></p><p><p>Your username: " +
							username +
							"</p><p>Your password: " +
							password +
							"</p>";
						sendMail(content, "Merchant Staff Account Created", email);
						let content2 =
							"Your have been added as Merchant Staff in E-Wallet application Login URL: http://" +
							config.mainIP +
							"/merchant/cashier/" +
							name +
							" Your username: " +
							username +
							" Your password: " +
							password;
						sendSMS(content2, mobile);
						return res.status(200).json({
							status: 1,
							message: "Merchant staff added successfully",
						});
					}
				});
			}
		}
	);
});

/**
 * @swagger
 * /merchant/editStaff:
 *  post:
 *    description: Use to edit merchant staff
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/editStaff", jwtTokenAuth, (req, res) => {
	const {
		role,
		name,
		email,
		ccode,
		code,
		read_only,
		mobile,
		username,
		branch_id,
		logo,
		staff_id,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
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
				MerchantStaff.findOneAndUpdate(
					{
						_id: staff_id,
						merchant_id: merchant._id,
					},
					{
						name: name,
						role: role,
						read_only : read_only,
						email: email,
						code: code,
						ccode: ccode,
						mobile: mobile,
						username: username,
						branch_id: branch_id,
						logo: logo,
					},
					(err1, staff) => {
						let result1 = errorMessage(err1, staff, "Staff not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								status: 1,
								message: "Staff updated successfully",
							});
						}
					}
				);
			}
		}
	);
});

/**
 * @swagger
 * /merchant/blockStaff:
 *  post:
 *    description: Use to block merchant staff
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/blockStaff", jwtTokenAuth, (req, res) => {
	const { staff_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
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
				MerchantStaff.findOneAndUpdate(
					{ _id: staff_id, merchant_id: merchant._id },
					{
						$set: {
							status: 2,
						},
					},
					(err1, staff) => {
						let result1 = errorMessage(err1, staff, "Staff not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								status: 1,
								data: "blocked staff",
							});
						}
					}
				);
			}
		}
	);
});

/**
 * @swagger
 * /merchant/unblockStaff:
 *  post:
 *    description: Use to unblock merchant staff
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/unblockStaff", jwtTokenAuth, (req, res) => {
	const { staff_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
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
				MerchantStaff.findOneAndUpdate(
					{ _id: staff_id, merchant_id: merchant._id, status: 2 },
					{
						status: 1,
					},
					(err1, staff) => {
						let result1 = errorMessage(err1, staff, "Staff not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								status: 1,
								data: "unblocked staff",
							});
						}
					}
				);
			}
		}
	);
});

/**
 * @swagger
 * /merchant/blockBranch:
 *  post:
 *    description: Use to block merchant branch
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/blockBranch", jwtTokenAuth, (req, res) => {
	const { branch_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			let result = errorMessage(err, merchant, "Merchant is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantBranch.findOneAndUpdate(
					{ _id: branch_id, merchant_id: merchant._id },
					{
						status: 2,
					},
					(err1, branch) => {
						let result1 = errorMessage(err1, branch, "Branch not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								status: 1,
								data: "blocked branch",
							});
						}
					}
				);
			}
		}
	);
});

/**
 * @swagger
 * /merchant/createBranch:
 *  post:
 *    description: Use to create merchant branch
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/unblockBranch", jwtTokenAuth, (req, res) => {
	const { branch_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
			let result = errorMessage(err, merchant, "Merchant is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantBranch.findOneAndUpdate(
					{ _id: branch_id, merchant_id: merchant._id, status: 2 },
					{
						status: 1,
					},
					(err1, branch) => {
						let result1 = errorMessage(
							err1,
							branch,
							"Branch not found/ not blocked"
						);
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								status: 1,
								data: "Unblocked branch",
							});
						}
					}
				);
			}
		}
	);
});

/**
 * @swagger
 * /merchant/createBranch:
 *  post:
 *    description: Use to create merchant branch
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/createBranch", jwtTokenAuth, (req, res) => {
	let data = new MerchantBranch();
	const {
		name,
		code,
		zone_id,
		subzone_id,
		read_only,
		username,
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
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		"-password",
		function (err, merchant) {
			let result = errorMessage(
				err,
				merchant,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				data.name = name;
				data.code = code;
				data.subzone_id = subzone_id;
				data.zone_id = zone_id;
				data.username = username;
				data.address1 = address1;
				data.state = state;
				data.country = country;
				data.read_only = read_only;
				data.zip = zip;
				data.bank_id = merchant.bank_id;
				data.ccode = ccode;
				data.mobile = mobile;
				data.email = email;
				data.merchant_id = merchant._id;
				data.password = makeid(10);
				data.working_from = working_from;
				data.working_to = working_to;
				data.status = 0;

				Subzone.countDocuments({ _id: subzone_id }, (err1, count) => {
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
					} else if (count == 1) {
						data.save((err2, branch) => {
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
								Subzone.updateOne(
									{ _id: subzone_id },
									{ $inc: { branch_count: 1 } },
									function (err3, subzone) {
										let result3 = errorMessage(
											err3,
											subzone,
											"Subzone not found"
										);
										if (result3.status == 0) {
											res.status(200).json(result3);
										} else {
											Zone.updateOne(
												{ _id: zone_id },
												{ $inc: { branch_count: 1 } },
												function (err4, zone) {
													let result4 = errorMessage(
														err4,
														zone,
														"Zone not found"
													);
													if (result4.status == 0) {
														res.status(200).json(result4);
													} else {
														let content =
														"<p>You are added as a branch for merchant " +
														merchant.name +
														" in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
														config.mainIP +
														"/merchant/branch/" +
														name +
														"'>http://" +
														config.mainIP +
														"/merchant/branch/" +
														name +
														"</a></p><p><p>Your username: " +
														username +
														"</p><p>Your password: " +
														data.password +
														"</p>";
													sendMail(content, "Merchant Branch Created", email);
														let content2 =
														"You are added as a branch for merchant " +
														merchant.name +
														" in E-Wallet application Login URL: http://" +
														config.mainIP +
														"/merchant/branch/" +
														name +
														" Your username: " +
														username +
														" Your password: " +
														data.password;
														sendSMS(content2, mobile);
														res.status(200).json({
															status: 1,
															message: "Branch Created",
															branch: branch,
															zone:zone,
														});

													}

												}
											);
											
										}
									}
								);
							}
						});
					} else {
						res.status(200).json({
							status: 0,
							message: "Zone do not exist.",
						});
					}
				});
			}
		}
	);
});

/**
 * @swagger
 * /merchant/editBranch:
 *  post:
 *    description: Use to edit merchant branch
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/merchant/editBranch", jwtTokenAuth, (req, res) => {
	const {
		branch_id,
		name,
		username,
		read_only,
		bcode,
		address1,
		state,
		zip,
		country,
		ccode,
		email,
		working_from,
		working_to,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
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
				MerchantBranch.findOneAndUpdate(
					{ _id: branch_id },
					{
						name: name,
						username: username,
						address1: address1,
						state: state,
						zip: zip,
						read_only: read_only,
						ccode: ccode,
						bcode: bcode,
						country: country,
						email: email,
						working_from: working_from,
						working_to: working_to,
					},
					{ new: true },
					(err1, branch) => {
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
								data: branch,
							});
						}
					}
				);
			}
		}
	);
});

/**
 * @swagger
 * /merchant/listBranches":
 *  post:
 *    description: Use to get all merchant branches
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.get("/merchant/listBranches", jwtTokenAuth, function (req, res) {
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
				MerchantBranch.find(
					{ merchant_id: merchant._id },
					"-password",
					function (err1, branch) {
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
								branches: branch,
							});
						}
					}
				);
			}
		}
	);
});

module.exports = router;
