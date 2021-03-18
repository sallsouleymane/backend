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
			}else if (!merchant || merchant === null || merchant === undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err, admin) {
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
						}else if (!admin || admin===null || admin === undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err, adminmerchant) => {
								var result = errorMessage(err, adminmerchant, "Merchant is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
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
								date_paid: {
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
								_id: "$paid_by",
								amount_paid: { $sum: "$amount" },
								bills_paid: { $sum: 1 },
							},
						},
					],async (err, post6) => {
						let result = errorMessage(
							err,
							post6,
							"Error."
						);
						if (result.status == 0) {
							res.status(200).json(result);
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
								],async (err, post7) => {
									let result = errorMessage(
										err,
										post7,
										"Error."
									);
									if (result.status == 0) {
										res.status(200).json(result);
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
											],async (err, post8) => {
												let result = errorMessage(
													err,
													post8,
													"Error."
												);
												if (result.status == 0) {
													res.status(200).json(result);
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
			}else if (!merchant || merchant === null || merchant === undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err, admin) {
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
						}else if (!admin || admin===null || admin === undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err, adminmerchant) => {
								var result = errorMessage(err, adminmerchant, "Merchant is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
								}
							});
						}	
					}
				);
			}

				MerchantSettings.findOne(
					{ merchant_id: merchant_id },
					(err, setting) => {
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
			}else if (!merchant || merchant === null || merchant === undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err, admin) {
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
						}else if (!admin || admin===null || admin === undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err, adminmerchant) => {
								var result = errorMessage(err, adminmerchant, "Merchant is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
								}
							});
						}	
					}
				);
			}
		
			Zone.find({ merchant_id: merchant_id }, async (err, zones) => {
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
						list: zones,
					});
				}
			});
			
		}
	);
});

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
			}else if (!merchant || merchant === null || merchant === undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err, admin) {
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
						}else if (!admin || admin===null || admin === undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err, adminmerchant) => {
								var result = errorMessage(err, adminmerchant, "Merchant is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
								}
							});
						}	
					}
				);
			}
			
			Subzone.find({ merchant_id: merchant_id }, async (err, subzones) => {
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
						list: subzones,
					});
				}
			});
			
		}
	);
});

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
			}else if (!merchant || merchant === null || merchant === undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err, admin) {
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
						}else if (!admin || admin===null || admin === undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err, adminmerchant) => {
								var result = errorMessage(err, adminmerchant, "Merchant is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
								}
							});
						}	
					}
				);
			}
			MerchantBranch.find({ merchant_id: merchant_id }, async (err, branches) => {
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
						list: branches,
					});
				}
			});
			
		}
	);
});

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
			}else if (!merchant || merchant === null || merchant === undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err, admin) {
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
						}else if (!admin || admin===null || admin === undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err, adminmerchant) => {
								var result = errorMessage(err, adminmerchant, "Merchant is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
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
								date_paid: {
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
								amount_paid: { $sum: "$amount" },
								bills_paid: { $sum: 1 },
							},
						},
					],async (err, post6) => {
						let result = errorMessage(
							err,
							post6,
							"Error."
						);
						if (result.status == 0) {
							res.status(200).json(result);
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
								],async (err, post7) => {
									let result = errorMessage(
										err,
										post7,
										"Error."
									);
									if (result.status == 0) {
										res.status(200).json(result);
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
											],async (err, post8) => {
												let result = errorMessage(
													err,
													post8,
													"Error."
												);
												if (result.status == 0) {
													res.status(200).json(result);
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
			}else if (!merchant || merchant === null || merchant === undefined){
				MerchantStaff.findOne(
					{
						username: username,
						role: "admin",
					},
					function (err, admin) {
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
						}else if (!admin || admin===null || admin === undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err, adminmerchant) => {
								var result = errorMessage(err, adminmerchant, "Merchant is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
								} else {
									Bank.findOne({ _id: adminmerchant.bank_id }, (err, bank) => {
										let result = errorMessage(err, bank, "Bank not found");
										if (result.status == 0) {
											res.status(200).json(result);
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
												.catch((err) => {
													res.status(200).json(catchError(err));
												});
										}
									});
								}
							});
						}	
					}
				);
			} else {
				Bank.findOne({ _id: merchant.bank_id }, (err, bank) => {
					let result = errorMessage(err, bank, "Bank not found");
					if (result.status == 0) {
						res.status(200).json(result);
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
							.catch((err) => {
								res.status(200).json(catchError(err));
							});
					}
				});
			}
		}
	);
});

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
			}else if (!merchant || merchant === null || merchant === undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err, admin) {
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
						}else if (!admin || admin===null || admin === undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err, adminmerchant) => {
								var result = errorMessage(err, adminmerchant, "Merchant is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
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
								date_paid: {
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
								_id: "$paid_by",
								amount_paid: { $sum: "$amount" },
								bills_paid: { $sum: 1 },
							},
						},
					],async (err, post6) => {
						let result = errorMessage(
							err,
							post6,
							"Error."
						);
						if (result.status == 0) {
							res.status(200).json(result);
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
								],async (err, post7) => {
									let result = errorMessage(
										err,
										post7,
										"Error."
									);
									if (result.status == 0) {
										res.status(200).json(result);
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
											],async (err, post8) => {
												let result = errorMessage(
													err,
													post8,
													"Error."
												);
												if (result.status == 0) {
													res.status(200).json(result);
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
			}else if (!merchant || merchant === null || merchant === undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err, admin) {
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
						}else if (!admin || admin===null || admin === undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err, adminmerchant) => {
								var result = errorMessage(err, adminmerchant, "Merchant is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
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
								date_paid: {
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
								_id: "$paid_by",
								amount_paid: { $sum: "$amount" },
								bills_paid: { $sum: 1 },
							},
						},
					],async (err, post6) => {
						let result = errorMessage(
							err,
							post6,
							"Error."
						);
						if (result.status == 0) {
							res.status(200).json(result);
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
								],async (err, post7) => {
									let result = errorMessage(
										err,
										post7,
										"Error."
									);
									if (result.status == 0) {
										res.status(200).json(result);
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
											],async (err, post8) => {
												let result = errorMessage(
													err,
													post8,
													"Error."
												);
												if (result.status == 0) {
													res.status(200).json(result);
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
				}else if (!merchant || merchant === null || merchant === undefined){
					MerchantStaff.findOne(
						{
							username: jwtusername,
							role: "admin",
						},
						function (err, admin) {
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
							}else if (!admin || admin===null || admin === undefined){
								res.status(200).json({
									status: 0,
									message: "User not found",
								});
							} else {
								Merchant.findOne({ _id: admin.merchant_id }, (err, adminmerchant) => {
									var result = errorMessage(err, adminmerchant, "Merchant is blocked");
									if (result.status == 0) {
										res.status(200).json(result);
									}
								});
							}	
						}
					);
				}
					Subzone.find(
						{ zone_id: zone_id },
						function (err, subzone) {
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
									subzones: subzone,
								});
							}
						}
					);
			}
		);
	}
);

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
			}else if (!merchant || merchant === null || merchant === undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err, admin) {
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
						}else if (!admin || admin===null || admin === undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err, adminmerchant) => {
								var result = errorMessage(err, adminmerchant, "Merchant is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
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
								date_paid: {
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
								amount_paid: { $sum: "$amount" },
								bills_paid: { $sum: 1 },
							},
						},
					],async (err, post6) => {
						let result = errorMessage(
							err,
							post6,
							"Error."
						);
						if (result.status == 0) {
							res.status(200).json(result);
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
								],async (err, post7) => {
									let result = errorMessage(
										err,
										post7,
										"Error."
									);
									if (result.status == 0) {
										res.status(200).json(result);
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
				}else if (!merchant || merchant === null || merchant === undefined){
					MerchantStaff.findOne(
						{
							username: jwtusername,
							role: "admin",
						},
						function (err, admin) {
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
							}else if (!admin || admin===null || admin === undefined){
								res.status(200).json({
									status: 0,
									message: "User not found",
								});
							} else {
								Merchant.findOne({ _id: admin.merchant_id }, (err, adminmerchant) => {
									var result = errorMessage(err, adminmerchant, "Merchant is blocked");
									if (result.status == 0) {
										res.status(200).json(result);
									}
								});
							}	
						}
					);
				}
					MerchantBranch.find(
						{  subzone_id: subzone_id },
						function (err, branch) {
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
			}else if (!merchant || merchant === null || merchant === undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err, admin) {
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
						}else if (!admin || admin===null || admin === undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err, adminmerchant) => {
								var result = errorMessage(err, adminmerchant, "Merchant is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
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
					],async (err, post6) => {
						let result = errorMessage(
							err,
							post6,
							"Error."
						);
						if (result.status == 0) {
							res.status(200).json(result);
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
								],async (err, post7) => {
									let result = errorMessage(
										err,
										post7,
										"Error."
									);
									if (result.status == 0) {
										res.status(200).json(result);
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
												return val._id==='MC'
											});
											const PaidByBC = await post6.filter((val) => {
												return val._id==='BC'
											});
											const PaidByPC = await post6.filter((val)=>{
												return val._id==='PC'
											});
											const PaidByUS = await post6.filter((val)=>{
												return val._id==='US'
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
			}else if (!merchant || merchant === null || merchant === undefined){
				MerchantStaff.findOne(
					{
						username: jwtusername,
						role: "admin",
					},
					function (err, admin) {
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
						}else if (!admin || admin===null || admin === undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err, adminmerchant) => {
								var result = errorMessage(err, adminmerchant, "Merchant is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
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
								_id: null,
								amount_paid: { $sum: "$amount" },
								bills_paid: { $sum: 1 },
								penalty: { $sum: "$penalty"},
							},
						},
					],async (err, post6) => {
						let result = errorMessage(
							err,
							post6,
							"Error."
						);
						if (result.status == 0) {
							res.status(200).json(result);
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
								],async (err, post7) => {
									let result = errorMessage(
										err,
										post7,
										"Error."
									);
									if (result.status == 0) {
										res.status(200).json(result);
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
												return val._id==='MC'
											});
											const PaidByBC = await post6.filter((val) => {
												return val._id==='BC'
											});
											const PaidByPC = await post6.filter((val)=>{
												return val._id==='PC'
											});
											const PaidByUS = await post6.filter((val)=>{
												return val._id==='US'
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

router.get("/merchant/listInvoiceGroups", jwtTokenAuth, (req, res) => {
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
				InvoiceGroup.find({ merchant_id: merchant._id }, (err, groups) => {
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
							message: "Invoice Groups list",
							groups: groups,
						});
					}
				});
			}
		}
	);
});

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
				data.save((err, group) => {
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

router.post("/merchant/listCustomers", jwtTokenAuth, function (req, res) {
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
				Customer.find({ merchant_id: merchant._id }, (err, customers) => {
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
							customers: customers,
						});
					}
				});
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
				for (customer of customers) {
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
					} catch (err) {
						console.log(err);
						var message = err;
						if (err && err.message) {
							message = err.message;
						}
						customer.failure_reason = message;
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
					(err, count) => {
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
						} else if (count == 1) {
							MerchantSettings.findOneAndUpdate(
								{ merchant_id: merchant._id },
								{ zone_name: zone_name, subzone_name: subzone_name },
								{ new: true },
								function (err, setting) {
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
									} else if (setting == null) {
										console.log(err);
										res.status(200).json({
											status: 0,
											message: "Setting not found",
											err: err,
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
					(err, count) => {
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
						} else if (count == 1) {
							MerchantSettings.findOneAndUpdate(
								{ merchant_id: merchant._id },
								{ penalty_rule: penalty_rule },
								{ new: true },
								function (err, setting) {
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
									} else if (setting == null) {
										console.log(err);
										res.status(200).json({
											status: 0,
											message: "Setting not found",
											err: err,
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
					(err, count) => {
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
						} else if (count == 1) {
							MerchantSettings.updateOne(
								{ merchant_id: merchant._id },
								{ $push: { bill_period: billperiod } },
								function (err, setting) {
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
									} else if (setting == null) {
										console.log(err);
										res.status(200).json({
											status: 0,
											message: "Setting not found",
											err: err,
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
					(err, setting) => {
						let result = errorMessage(err, setting, "Setting not found");
						if (result.status == 0) {
							res.status(200).json(result);
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
					(err, setting) => {
						let result = errorMessage(err, setting, "Setting not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							res.status(200).json({
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
					(err, count) => {
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
						} else if (count == 1) {
							MerchantSettings.updateOne(
								{ merchant_id: merchant._id },
								{ $push: { bill_term: billterm } },
								function (err, setting) {
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
									} else if (setting == null) {
										console.log(err);
										res.status(200).json({
											status: 0,
											message: "Setting not found",
											err: err,
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

router.post("/merchant/listTaxes", jwtTokenAuth, function (req, res) {
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
				Tax.find({ merchant_id: merchant._id }, (err, taxes) => {
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
							taxes: taxes,
						});
					}
				});
			}
		}
	);
});

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
				Tax.deleteOne({ _id: tax_id }, (err) => {
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
							message: "Tax deleted",
						});
					}
				});
			}
		}
	);
});

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
					(err, tax) => {
						let result = errorMessage(err, tax, "Tax not found");
						if (result.status == 0) {
							res.status(200).json(result);
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
					(err, tax) => {
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
						} else if (tax) {
							res.status(200).json({
								status: 0,
								message: "Tax with this code already exist",
							});
						} else {
							const tax = new Tax();
							tax.merchant_id = merchant._id;
							tax.code = code;
							tax.name = name;
							tax.value = value;
							tax.save((err) => {
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
				Offering.deleteOne({ _id: offering_id }, (err) => {
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
							message: "Offering deleted",
						});
					}
				});
			}
		}
	);
});

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
					(err, offering) => {
						let result = errorMessage(err, offering, "Offering not found");
						if (result.status == 0) {
							res.status(200).json(result);
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

router.post("/merchant/listOfferings", jwtTokenAuth, function (req, res) {
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
				Offering.find({ merchant_id: merchant._id }, (err, offerings) => {
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
							offerings: offerings,
						});
					}
				});
			}
		}
	);
});

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
				for (offering of offerings) {
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
					} catch (err) {
						console.log(err);
						var message = err.toString();
						if (err.message) {
							message = err.message;
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
					(err, merchant2) => {
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

router.get("/merchant/getTransHistory", jwtTokenAuth, function (req, res) {
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
				Bank.findOne(
					{
						_id: merchant.bank_id,
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
							const wallet = merchant.wallet_ids.operational;
							blockchain
								.getStatement(wallet)
								.then(function (history) {
									res.status(200).json({
										status: 1,
										history: history,
									});
								})
								.catch((err) => {
									res.status(200).json(catchError(err));
								});
						}
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
					(err, zone) => {
						let result = errorMessage(err, zone, "Zone not found");
						if (result.status == 0) {
							res.status(200).json(result);
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
				data.branch_count = 0,
				data.subzone_count = 0,
				data.save((err, zone) => {
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
						return res
							.status(200)
							.json({ status: 1, message: "Zone Created", zones: zone });
					}
				});
			}
		}
	);
});

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
				(data.zone_id = zone_id),
					(data.branch_count = 0),
					data.save((err, subzone) => {
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
							Zone.updateOne(
								{ _id: zone_id },
								{ $inc: { subzone_count: 1 } },
								function (err, zone) {
									let result = errorMessage(
										err,
										zone,
										"Zone not found"
									);
									if (result.status == 0) {
										res.status(200).json(result);
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
					(err, subzone) => {
						let result = errorMessage(err, subzone, "Subzone not found");
						if (result.status == 0) {
							res.status(200).json(result);
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
				MerchantBranch.findOne({ _id: branch_id }, function (err, branch) {
					let result = errorMessage(err, branch, "Invalid branch");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						data.name = name;
						data.working_from = working_from;
						data.working_to = working_to;
						data.merchant_id = merchant._id;
						data.branch_id = branch_id;
						data.type = type;
						data.save((err, position) => {
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
								MerchantBranch.updateOne(
									{ _id: branch_id },
									{ $inc: { total_positions: 1 } },
									function (err, branch) {
										let result = errorMessage(err, branch, "Branch not found");
										if (result.status == 0) {
											res.status(200).json(result);
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
					(err, position) => {
						let result = errorMessage(err, position, "Position not found");
						if (result.status == 0) {
							res.status(200).json(result);
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
					(err, positions) => {
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
				data.email = email;
				data.mobile = mobile;
				data.username = username;
				data.password = password;
				data.branch_id = branch_id;
				data.merchant_id = user._id;
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

router.post("/merchant/editStaff", jwtTokenAuth, (req, res) => {
	const {
		role,
		name,
		email,
		ccode,
		code,
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
						email: email,
						code: code,
						ccode: ccode,
						mobile: mobile,
						username: username,
						branch_id: branch_id,
						logo: logo,
					},
					(err, staff) => {
						let result = errorMessage(err, staff, "Staff not found");
						if (result.status == 0) {
							res.status(200).json(result);
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

router.get("/merchant/listStaff", jwtTokenAuth, (req, res) => {
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
				MerchantStaff.find(
					{ merchant_id: merchant._id },
					"-password",
					(err, staffs) => {
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
								staffs: staffs,
							});
						}
					}
				);
			}
		}
	);
});

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
					(err, staff) => {
						let result = errorMessage(err, staff, "Staff not found");
						if (result.status == 0) {
							res.status(200).json(result);
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
					(err, staff) => {
						let result = errorMessage(err, staff, "Staff not found");
						if (result.status == 0) {
							res.status(200).json(result);
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
					(err, branch) => {
						let result = errorMessage(err, branch, "Branch not found");
						if (result.status == 0) {
							res.status(200).json(result);
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
					(err, branch) => {
						let result = errorMessage(
							err,
							branch,
							"Branch not found/ not blocked"
						);
						if (result.status == 0) {
							res.status(200).json(result);
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

router.post("/merchant/createBranch", jwtTokenAuth, (req, res) => {
	let data = new MerchantBranch();
	const {
		name,
		code,
		zone_id,
		subzone_id,
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
				data.zip = zip;
				data.ccode = ccode;
				data.mobile = mobile;
				data.email = email;
				data.merchant_id = merchant._id;
				data.password = makeid(10);
				data.working_from = working_from;
				data.working_to = working_to;
				data.status = 0;

				Subzone.countDocuments({ _id: subzone_id }, (err, count) => {
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
					} else if (count == 1) {
						data.save((err, branch) => {
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
								Subzone.updateOne(
									{ _id: subzone_id },
									{ $inc: { branch_count: 1 } },
									function (err, subzone) {
										let result = errorMessage(
											err,
											subzone,
											"Subzone not found"
										);
										if (result.status == 0) {
											res.status(200).json(result);
										} else {
											Zone.updateOne(
												{ _id: zone_id },
												{ $inc: { branch_count: 1 } },
												function (err, zone) {
													let result = errorMessage(
														err,
														zone,
														"Zone not found"
													);
													if (result.status == 0) {
														res.status(200).json(result);
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

router.post("/merchant/editBranch", jwtTokenAuth, (req, res) => {
	const {
		branch_id,
		name,
		username,
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
					{ _id: branch_id, merchant_id: merchant._id },
					{
						name: name,
						username: username,
						address1: address1,
						state: state,
						zip: zip,
						ccode: ccode,
						bcode: bcode,
						country: country,
						email: email,
						working_from: working_from,
						working_to: working_to,
					},
					{ new: true },
					(err, branch) => {
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
								data: branch,
							});
						}
					}
				);
			}
		}
	);
});

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
					function (err, branch) {
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
					}
				);
			}
		}
	);
});

module.exports = router;
