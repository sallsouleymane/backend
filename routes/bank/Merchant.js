const express = require("express");
const router = express.Router();
const config = require("../../config.json");
const jwtTokenAuth = require("../JWTTokenAuth");

//utils
const makeid = require("../utils/idGenerator");
const sendSMS = require("../utils/sendSMS");
const sendMail = require("../utils/sendMail");
const { errorMessage, catchError } = require("../utils/errorHandler");

//services
const { createWallet } = require("../../services/Blockchain.js");

const Bank = require("../../models/Bank");
const BankUser = require("../../models/BankUser");
const Merchant = require("../../models/merchant/Merchant");
const MerchantBranch = require("../../models/merchant/MerchantBranch");
const Zone = require("../../models/merchant/Zone");
const Subzone = require("../../models/merchant/Subzone");
const MerchantPosition = require("../../models/merchant/Position");
const getWalletIds = require("../utils/getWalletIds");
const InvoiceGroup = require("../../models/merchant/InvoiceGroup");
const Invoice = require("../../models/merchant/Invoice");
const MerchantSettings = require("../../models/merchant/MerchantSettings");

router.post("/bank/changeMerchantAcces", jwtTokenAuth, function (req, res) {
	const { merchant_id, is_private } = req.body;
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!bank || bank === null || bank === undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err, adminbank) => {
								var result = errorMessage(err, adminbank, "Bank is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
								}
							});
						}	
					}
				);
			}
				Merchant.findOneAndUpdate(
					{ _id: merchant_id },
					{ is_private: is_private },
					function (err, merchant) {
						let errMsg = errorMessage(
							err,
							merchant,
							"Token changed or user not valid. Try to login again or contact system administrator."
						);
						if (errMsg.status == 0) {
							res.status(200).json(errMsg);
						} else {
							res.status(200).json({
								status: 1,
								message: "Changed Access successfully",
							});
						}
					}
				);
			
		}
	);
});

router.post("/bank/blockMerchant", jwtTokenAuth, function (req, res) {
	var { merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!bank || bank === null || bank === undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err, adminbank) => {
								var result = errorMessage(err, adminbank, "Bank is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
								}
							});
						}	
					}
				);
			}
				Merchant.findOneAndUpdate(
					{ _id: merchant_id },
					{
						$set: {
							status: 0,
						},
					},
					(err, merchant) => {
						let result = errorMessage(err, merchant, "Merchant not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							MerchantBranch.updateMany(
								{merchant_id: merchant_id},
								{
									$set: {
										status: 0,
									},
								},
								(err, branches) => {
									let result = errorMessage(err, branches, "Branchs not found");
									if (result.status == 0) {
										res.status(200).json(result);
									} else {
										MerchantPosition.updateMany(
											{merchant_id: merchant_id},
											{
												$set: {
													status: 0,
												},
											},
											(err, cashiers) => {
												let result = errorMessage(err, cashiers, "Cashiers not found");
												if (result.status == 0) {
													res.status(200).json(result);
												} else {
													res.status(200).json({
														status: 1,
														message: "blocked Merchant",
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

router.post("/bank/unblockMerchant", jwtTokenAuth, function (req, res) {
	var { merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!bank || bank === null || bank === undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err, adminbank) => {
								var result = errorMessage(err, adminbank, "Bank is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
								}
							});
						}	
					}
				);
			}
				Merchant.findOneAndUpdate(
					{ _id: merchant_id },
					{
						$set: {
							status: 1,
						},
					},
					(err, merchant) => {
						let result = errorMessage(err, merchant, "Merchant not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							MerchantBranch.updateMany(
								{merchant_id: merchant_id},
								{
									$set: {
										status: 1,
									},
								},
								(err, branches) => {
									let result = errorMessage(err, branches, "Branchs not found");
									if (result.status == 0) {
										res.status(200).json(result);
									} else {
										MerchantPosition.updateMany(
											{merchant_id: merchant_id},
											{
												$set: {
													status: 1,
												},
											},
											(err, cashiers) => {
												let result = errorMessage(err, cashiers, "Cashiers not found");
												if (result.status == 0) {
													res.status(200).json(result);
												} else {
													res.status(200).json({
														status: 1,
														message: "unblocked Merchant",
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

router.post("/bank/listMerchants", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { bank_id } = req.body;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!bank || bank === null || bank === undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err, adminbank) => {
								var result = errorMessage(err, adminbank, "Bank is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
								}
							});
						}	
					}
				);
			}

				Merchant.find({ bank_id: bank_id }, "-password", (err, merchants) => {
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
							message: "Merchant List",
							list: merchants,
						});
					}
				});
			
		}
	);
});

router.post("/bank/createMerchant", jwtTokenAuth, function (req, res) {
	var {
		bank_id,
		code,
		name,
		logo,
		bank_code,
		description,
		document_hash,
		email,
		mobile,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!bank || bank === null || bank === undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err, adminbank) => {
								var result = errorMessage(err, adminbank, "Bank is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
								}
							});
						}	
					}
				);
			}
				if (!code) {
					res.status(200).json({
						status: 0,
						message: "Code is a required field",
					});
				} else {
					const wallet_ids = getWalletIds("merchant", code, bank_code);
					createWallet([wallet_ids.operational])
						.then((result) => {
							if (result != "" && !result.includes("wallet already exists")) {
								console.log(result);
								res.status(200).json({
									status: 0,
									message: result,
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
								data.bank_id = bank_id;
								data.status = 0;
								data.creator = 0;
								data.wallet_ids.operational = wallet_ids.operational;

								data.save((err, merchant) => {
									if (err) {
										console.log(err);
										res.status(200).json({
											status: 0,
											message:
												"Either merchant code / email / mobile already exist",
										});
									} else {
										Bank.updateOne(
											{
												_id: bank_id,
											},
											{
												$inc: { total_partners: 1 },
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
													const group = new InvoiceGroup();
													group.merchant_id = merchant._id;
													group.name = 'Default';
													group.code = `${merchant.name}default`;
													group.description = 'default';
													group.save((err) => {
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

router.post("/bank/editMerchant", jwtTokenAuth, function (req, res) {
	var { merchant_id, name, logo, description, document_hash, email, mobile } = req.body;
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!bank || bank === null || bank === undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err, adminbank) => {
								var result = errorMessage(err, adminbank, "Bank is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
								}
							});
						}	
					}
				);
			}
				Merchant.findOneAndUpdate(
					{ _id: merchant_id, creator: 0 },
					{
						name: name,
						logo: logo,
						description: description,
						document_hash: document_hash,
						email: email,
						mobile: mobile,
					},
					(err, merchant) => {
						let result = errorMessage(err, merchant, "Merchant not found.");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							res.status(200).json({
								status: 1,
								message: "Merchant edited successfully",
							});
						}
					}
				);
			
		}
	);
});

router.post("/bank/getMerchantDashStats", jwtTokenAuth, function (req, res) {
	const { merchant_id } = req.body;
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!bank || bank === null || bank === undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err, adminbank) => {
								var result = errorMessage(err, adminbank, "Bank is blocked");
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
								penalty: {$sum: "$penalty"},
								fee: {$sum: "$fee"},
								commission: {$sum: "$commission"},
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
													let FeeGeneratedByBC = 0;
													let CommissionGeneratedByBC = 0;
													let FeeGeneratedByPC = 0;
													let CommissionGeneratedByPC = 0;
													let FeeGeneratedByMC = 0;
													let CommissionGeneratedByMC = 0;
													let FeeGeneratedByUS = 0;
													let CommissionGeneratedByUS = 0;
													let InvoicePaid = 0;
													let AmountPaid = 0;
													let ap = 0;
													let bp = 0;
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
															FeeGeneratedByMC = PaidByMC[0].fee;
															CommissionGeneratedByMC = PaidByMC[0].commission;
														}
														if(PaidByBC.length > 0){
															InvoicePaidByBC = PaidByBC[0].bills_paid;
															AmountPaidByBC = PaidByBC[0].amount_paid + PaidByBC[0].penalty;
															FeeGeneratedByBC = PaidByBC[0].fee;
															CommissionGeneratedByBC = PaidByBC[0].commission;
														}
														if(PaidByPC.length > 0){
															InvoicePaidByPC = PaidByPC[0].bills_paid;
															AmountPaidByPC = PaidByPC[0].amount_paid + PaidByPC[0].penalty;
															FeeGeneratedByPC = PaidByPC[0].fee;
															CommissionGeneratedByPC = PaidByPC[0].commission;
														}
														if(PaidByUS.length > 0){
															InvoicePaidByUS = PaidByUS[0].bills_paid;
															AmountPaidByUS = PaidByUS[0].amount_paid + PaidByUS[0].penalty;
															FeeGeneratedByUS = PaidByUS[0].fee;
															CommissionGeneratedByUS = PaidByUS[0].commission;
														}
			
														InvoicePaid = await post6.reduce((a, b) => {
															return a + b.bills_paid;
														}, 0);
														
														AmountPaid = await post6.reduce((a, b) => {
															return a + b.amount_paid;
														}, 0);
													}
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
														bills_created:bg,
														amount_created:ag,
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
														fee_generated_by_BC: FeeGeneratedByBC,
														commission_generated_by_BC: CommissionGeneratedByBC,
														fee_generated_by_PC: FeeGeneratedByPC,
														commission_generated_by_PC: CommissionGeneratedByPC,
														fee_generated_by_MC: FeeGeneratedByMC,
														commission_generated_by_MC: CommissionGeneratedByMC,
														fee_generated_by_US: FeeGeneratedByUS,
														commission_generated_by_US: CommissionGeneratedByUS,
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

router.post("/getBankDashStatsForMerchants", jwtTokenAuth, function (req, res) {
	const { bank_id } = req.body;
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!bank || bank === null || bank === undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err, adminbank) => {
								var result = errorMessage(err, adminbank, "Bank is blocked");
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
								bank_id: bank_id,
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
								penalty: {$sum: "$penalty"},
								fee: {$sum: "$fee"},
								commission: {$sum: "$commission"},
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
											bank_id: bank_id,
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
														bank_id: bank_id,
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
													let FeeGeneratedByBC = 0;
													let CommissionGeneratedByBC = 0;
													let FeeGeneratedByPC = 0;
													let CommissionGeneratedByPC = 0;
													let FeeGeneratedByMC = 0;
													let CommissionGeneratedByMC = 0;
													let FeeGeneratedByUS = 0;
													let CommissionGeneratedByUS = 0;
													let InvoicePaid = 0;
													let AmountPaid = 0;
													let ap = 0;
													let bp = 0;
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
															FeeGeneratedByMC = PaidByMC[0].fee;
															CommissionGeneratedByMC = PaidByMC[0].commission;
														}
														if(PaidByBC.length > 0){
															InvoicePaidByBC = PaidByBC[0].bills_paid;
															AmountPaidByBC = PaidByBC[0].amount_paid + PaidByBC[0].penalty;
															FeeGeneratedByBC = PaidByBC[0].fee;
															CommissionGeneratedByBC = PaidByBC[0].commission;
														}
														if(PaidByPC.length > 0){
															InvoicePaidByPC = PaidByPC[0].bills_paid;
															AmountPaidByPC = PaidByPC[0].amount_paid + PaidByPC[0].penalty;
															FeeGeneratedByPC = PaidByPC[0].fee;
															CommissionGeneratedByPC = PaidByPC[0].commission;
														}
														if(PaidByUS.length > 0){
															InvoicePaidByUS = PaidByUS[0].bills_paid;
															AmountPaidByUS = PaidByUS[0].amount_paid + PaidByUS[0].penalty;
															FeeGeneratedByUS = PaidByUS[0].fee;
															CommissionGeneratedByUS = PaidByUS[0].commission;
														}
			
														InvoicePaid = await post6.reduce((a, b) => {
															return a + b.bills_paid;
														}, 0);
														
														AmountPaid = await post6.reduce((a, b) => {
															return a + b.amount_paid;
														}, 0);
													}
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
														bills_created:bg,
														amount_created:ag,
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
														fee_generated_by_BC: FeeGeneratedByBC,
														commission_generated_by_BC: CommissionGeneratedByBC,
														fee_generated_by_PC: FeeGeneratedByPC,
														commission_generated_by_PC: CommissionGeneratedByPC,
														fee_generated_by_MC: FeeGeneratedByMC,
														commission_generated_by_MC: CommissionGeneratedByMC,
														fee_generated_by_US: FeeGeneratedByUS,
														commission_generated_by_US: CommissionGeneratedByUS,
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

router.post("/bank/:type/getMerchantStatsBydate",jwtTokenAuth,function (req, res) {
	const jwtusername = req.sign_creds.username;
	const type = req.params.type;
	const { id, date } = req.body;
	var today = new Date(date);
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!bank || bank === null || bank === undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err, adminbank) => {
								var result = errorMessage(err, adminbank, "Bank is blocked");
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
								fee: {$sum: "$fee"},
								commission: {$sum: "$commission"},
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
										let FeeGeneratedByBC = 0;
										let CommissionGeneratedByBC = 0;
										let FeeGeneratedByPC = 0;
										let CommissionGeneratedByPC = 0;
										let FeeGeneratedByMC = 0;
										let CommissionGeneratedByMC = 0;
										let FeeGeneratedByUS = 0;
										let CommissionGeneratedByUS = 0;
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
												FeeGeneratedByMC = PaidByMC[0].fee;
												CommissionGeneratedByMC = PaidByMC[0].commission;
											}
											if(PaidByBC.length > 0){
												InvoicePaidByBC = PaidByBC[0].bills_paid;
												AmountPaidByBC = PaidByBC[0].amount_paid + PaidByBC[0].penalty;
												FeeGeneratedByBC = PaidByBC[0].fee;
												CommissionGeneratedByBC = PaidByBC[0].commission;
											}
											if(PaidByPC.length > 0){
												InvoicePaidByPC = PaidByPC[0].bills_paid;
												AmountPaidByPC = PaidByPC[0].amount_paid + PaidByPC[0].penalty;
												FeeGeneratedByPC = PaidByPC[0].fee;
												CommissionGeneratedByPC = PaidByPC[0].commission;
											}
											if(PaidByUS.length > 0){
												InvoicePaidByUS = PaidByUS[0].bills_paid;
												AmountPaidByUS = PaidByUS[0].amount_paid + PaidByUS[0].penalty;
												FeeGeneratedByUS = PaidByUS[0].fee;
												CommissionGeneratedByUS = PaidByUS[0].commission;
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
											fee_generated_by_BC: FeeGeneratedByBC,
											commission_generated_by_BC: CommissionGeneratedByBC,
											fee_generated_by_PC: FeeGeneratedByPC,
											commission_generated_by_PC: CommissionGeneratedByPC,
											fee_generated_by_MC: FeeGeneratedByMC,
											commission_generated_by_MC: CommissionGeneratedByMC,
											fee_generated_by_US: FeeGeneratedByUS,
											commission_generated_by_US: CommissionGeneratedByUS,
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

router.post("/bank/getMerchantzoneList", jwtTokenAuth, (req, res) => {
	const { merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!bank || bank === null || bank === undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err, adminbank) => {
								var result = errorMessage(err, adminbank, "Bank is blocked");
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

router.post("/bank/getMerchantsubzoneList", jwtTokenAuth, (req, res) => {
	const { merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!bank || bank === null || bank === undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err, adminbank) => {
								var result = errorMessage(err, adminbank, "Bank is blocked");
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

router.post("/bank/getMerchantbranchList", jwtTokenAuth, (req, res) => {
	const { merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!bank || bank === null || bank === undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err, adminbank) => {
								var result = errorMessage(err, adminbank, "Bank is blocked");
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

router.post("/bank/getBankMerchantStatsBydate",jwtTokenAuth,function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { merchant_id, date } = req.body;
	var today = new Date(date);
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!bank || bank === null || bank === undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err, adminbank) => {
								var result = errorMessage(err, adminbank, "Bank is blocked");
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
								merchant_id: merchant_id,
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
								fee: {$sum: "$fee"},
								commission: {$sum: "$commission"},
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
											merchant_id : merchant_id,
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
										let FeeGeneratedByBC = 0;
										let CommissionGeneratedByBC = 0;
										let FeeGeneratedByPC = 0;
										let CommissionGeneratedByPC = 0;
										let FeeGeneratedByMC = 0;
										let CommissionGeneratedByMC = 0;
										let FeeGeneratedByUS = 0;
										let CommissionGeneratedByUS = 0;
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
												FeeGeneratedByMC = PaidByMC[0].fee;
												CommissionGeneratedByMC = PaidByMC[0].commission;
											}
											if(PaidByBC.length > 0){
												InvoicePaidByBC = PaidByBC[0].bills_paid;
												AmountPaidByBC = PaidByBC[0].amount_paid + PaidByBC[0].penalty;
												FeeGeneratedByBC = PaidByBC[0].fee;
												CommissionGeneratedByBC = PaidByBC[0].commission;
											}
											if(PaidByPC.length > 0){
												InvoicePaidByPC = PaidByPC[0].bills_paid;
												AmountPaidByPC = PaidByPC[0].amount_paid + PaidByPC[0].penalty;
												FeeGeneratedByPC = PaidByPC[0].fee;
												CommissionGeneratedByPC = PaidByPC[0].commission;
											}
											if(PaidByUS.length > 0){
												InvoicePaidByUS = PaidByUS[0].bills_paid;
												AmountPaidByUS = PaidByUS[0].amount_paid + PaidByUS[0].penalty;
												FeeGeneratedByUS = PaidByUS[0].fee;
												CommissionGeneratedByUS = PaidByUS[0].commission;
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
											fee_generated_by_BC: FeeGeneratedByBC,
											commission_generated_by_BC: CommissionGeneratedByBC,
											fee_generated_by_PC: FeeGeneratedByPC,
											commission_generated_by_PC: CommissionGeneratedByPC,
											fee_generated_by_MC: FeeGeneratedByMC,
											commission_generated_by_MC: CommissionGeneratedByMC,
											fee_generated_by_US: FeeGeneratedByUS,
											commission_generated_by_US: CommissionGeneratedByUS,
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

router.post("/bank/:type/getMerchantStatsByPeriod",jwtTokenAuth,function (req, res) {
	const jwtusername = req.sign_creds.username;
	const type = req.params.type;
	const { id, period_name } = req.body;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!bank || bank === null || bank === undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err, adminbank) => {
								var result = errorMessage(err, adminbank, "Bank is blocked");
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
								_id: "$paid_by", 
								amount_paid: { $sum: "$amount" },
								bills_paid: { $sum: 1 },
								fee: {$sum: "$fee"},
								commission: {$sum: "$commission"},
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
										let FeeGeneratedByBC = 0;
										let CommissionGeneratedByBC = 0;
										let FeeGeneratedByPC = 0;
										let CommissionGeneratedByPC = 0;
										let FeeGeneratedByMC = 0;
										let CommissionGeneratedByMC = 0;
										let FeeGeneratedByUS = 0;
										let CommissionGeneratedByUS = 0;
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
												FeeGeneratedByMC = PaidByMC[0].fee;
												CommissionGeneratedByMC = PaidByMC[0].commission;
											}
											if(PaidByBC.length > 0){
												InvoicePaidByBC = PaidByBC[0].bills_paid;
												AmountPaidByBC = PaidByBC[0].amount_paid + PaidByBC[0].penalty;
												FeeGeneratedByBC = PaidByBC[0].fee;
												CommissionGeneratedByBC = PaidByBC[0].commission;
											}
											if(PaidByPC.length > 0){
												InvoicePaidByPC = PaidByPC[0].bills_paid;
												AmountPaidByPC = PaidByPC[0].amount_paid + PaidByPC[0].penalty;
												FeeGeneratedByPC = PaidByPC[0].fee;
												CommissionGeneratedByPC = PaidByPC[0].commission;
											}
											if(PaidByUS.length > 0){
												InvoicePaidByUS = PaidByUS[0].bills_paid;
												AmountPaidByUS = PaidByUS[0].amount_paid + PaidByUS[0].penalty;
												FeeGeneratedByUS = PaidByUS[0].fee;
												CommissionGeneratedByUS = PaidByUS[0].commission;
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
											fee_generated_by_BC: FeeGeneratedByBC,
											commission_generated_by_BC: CommissionGeneratedByBC,
											fee_generated_by_PC: FeeGeneratedByPC,
											commission_generated_by_PC: CommissionGeneratedByPC,
											fee_generated_by_MC: FeeGeneratedByMC,
											commission_generated_by_MC: CommissionGeneratedByMC,
											fee_generated_by_US: FeeGeneratedByUS,
											commission_generated_by_US: CommissionGeneratedByUS,
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

router.post("/bank/listMerchantSubzonesByZoneId",jwtTokenAuth,function (req, res) {
		const { zone_id } = req.body;
		const jwtusername = req.sign_creds.username;
		Bank.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err, bank) {
				if (err) {
					var message = err;
					if (err.message) {
						message = err.message;
					}
					res.status(200).json({
						status: 0,
						message: message,
					});
				}else if (!bank || bank === null || bank === undefined){
					BankUser.findOne(
						{
							username: jwtusername,
							role: {$in: ['bankAdmin', 'infraAdmin']},
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
								Bank.findOne({ _id: admin.bank_id }, (err, adminbank) => {
									var result = errorMessage(err, adminbank, "Bank is blocked");
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

router.post(
	"/bank/listMerchantBranchesBySubzoneId",
	jwtTokenAuth,
	function (req, res) {
		const { subzone_id } = req.body;
		const jwtusername = req.sign_creds.username;
		Bank.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err, bank) {
				if (err) {
					var message = err;
					if (err.message) {
						message = err.message;
					}
					res.status(200).json({
						status: 0,
						message: message,
					});
				}else if (!bank || bank === null || bank === undefined){
					BankUser.findOne(
						{
							username: jwtusername,
							role: {$in: ['bankAdmin', 'infraAdmin']},
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
								Bank.findOne({ _id: admin.bank_id }, (err, adminbank) => {
									var result = errorMessage(err, adminbank, "Bank is blocked");
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

module.exports = router;
