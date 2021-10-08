const express = require("express");
const router = express.Router();
const config = require("../../config.json");
const jwtTokenAuth = require("../JWTTokenAuth");

//utils
const makeid = require("../utils/idGenerator");
const sendSMS = require("../utils/sendSMS");
const sendMail = require("../utils/sendMail");
const getTypeClass = require("../utils/getTypeClass");
const makeotp = require("../utils/makeotp");
const keyclock = require("../utils/keyClock");
const keyclock_constant = require("../../keyclockConstants");

//services
const {
	createWallet,
	getStatement,
	getBalance,
} = require("../../services/Blockchain.js");
const { errorMessage, catchError } = require("../utils/errorHandler");

const Bank = require("../../models/Bank");
const BankUser = require("../../models/BankUser");
const OTP = require("../../models/OTP");
const Partner = require("../../models/partner/Partner");
const PartnerBranch = require("../../models/partner/Branch");
const PartnerCashier = require("../../models/partner/Cashier");
const Document = require("../../models/Document");
const Invoice = require("../../models/merchant/Invoice");
const DailyReport = require("../../models/cashier/DailyReport");


/**
 * @swagger
 * /bank/blockPartner:
 *  post:
 *    description: Use to block partner by bank
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/bank/blockPartner", jwtTokenAuth, function (req, res) {
	var { partner_id } = req.body;
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
			}else if (!bank || bank == null || bank == undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err2, adminbank) => {
								var result2 = errorMessage(err2, adminbank, "Bank is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}
				Partner.findOneAndUpdate(
					{ _id: partner_id },
					{
						$set: {
							status: -1,
						},
					},
					(err3, partner) => {
						let result3 = errorMessage(err3, partner, "Partner not found");
						if (result3.status == 0) {
							res.status(200).json(result3);
						} else {
							PartnerBranch.updateMany(
								{partner_id: partner_id},
								{
									$set: {
										status: -1,
									},
								},
								(err4, branches) => {
									let result4 = errorMessage(err4, branches, "Branchs not found");
									if (result4.status == 0) {
										res.status(200).json(result4);
									} else {
										PartnerCashier.updateMany(
											{partner_id: partner_id},
											{
												$set: {
													status: -1,
												},
											},
											(err5, cashiers) => {
												let result5 = errorMessage(err5, cashiers, "Cashiers not found");
												if (result5.status == 0) {
													res.status(200).json(result5);
												} else {
													res.status(200).json({
														status: 1,
														message: "blocked Partner",
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
 * /bank/unblockPartner:
 *  post:
 *    description: Use to unblock partner by bank
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/bank/unblockPartner", jwtTokenAuth, function (req, res) {
	var { partner_id } = req.body;
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
			}else if (!bank || bank == null || bank == undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err2, adminbank) => {
								var result2 = errorMessage(err2, adminbank, "Bank is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}
				Partner.findOneAndUpdate(
					{ _id: partner_id },
					{
						$set: {
							status: 1,
						},
					},
					(err3, merchant) => {
						let result3 = errorMessage(err3, merchant, "Partner not found");
						if (result3.status == 0) {
							res.status(200).json(result3);
						} else {
							PartnerBranch.updateMany(
								{partner_id: partner_id},
								{
									$set: {
										status: 1,
									},
								},
								(err4, branches) => {
									let result4 = errorMessage(err4, branches, "Branchs not found");
									if (result4.status == 0) {
										res.status(200).json(result4);
									} else {
										PartnerCashier.updateMany(
											{partner_id: partner_id},
											{
												$set: {
													status: 1,
												},
											},
											(err5, cashiers) => {
												let result5 = errorMessage(err5, cashiers, "Cashiers not found");
												if (result5.status == 0) {
													res.status(200).json(result5);
												} else {
													res.status(200).json({
														status: 1,
														message: "Unblocked Partner",
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
 * /bank/listPartners:
 *  post:
 *    description: Use to list all partners by bank
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/bank/listPartners", jwtTokenAuth, function (req, res) {
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
			}else if (!bank || bank == null || bank == undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err2, adminbank) => {
								var result2 = errorMessage(err2, adminbank, "Bank is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}	
				Partner.find({ bank_id: bank_id }, function (err3, partner) {
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
							partners: partner,
						});
					}
				});
			
		}
	);
});

/**
 * @swagger
 * /bank/getPartner:
 *  post:
 *    description: Use to get a partner by bank
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/bank/getPartner", jwtTokenAuth, function (req, res) {
	const { partner_id } = req.body;
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
				Partner.findOne(
					{
						_id: partner_id,
					},
					function (err1, partner) {
						let result1 = errorMessage(err1, partner, "Partner not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								status: 1,
								partners: partner,
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
 * /bank/editPartner:
 *  post:
 *    description: Use to eit a partner by bank
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/bank/editPartner", jwtTokenAuth, function (req, res) {
	const {
		partner_id,
		name,
		bcode,
		address,
		verify_user_access,
		state,
		zip,
		country,
		ccode,
		mobile,
		email,
		logo,
		contract,
		otp_id,
		otp,
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
			}else if (!bank || bank == null || bank == undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err2, adminbank) => {
								var result2 = errorMessage(err2, adminbank, "Bank is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}
				OTP.findOne(
					{
						_id: otp_id,
						otp: otp,
					},
					function (err3, otpd) {
						let result3 = errorMessage(err3, otpd, err3);
						if (result3.status == 0) {
							res.status(200).json(result3);
						} else {
							if (otpd.otp == otp) {
								if (
									name == "" ||
									address == "" ||
									state == "" ||
									mobile == "" ||
									email == ""
								) {
									return res.status(200).json({
										status: 0,
										message: "Please provide valid inputs",
									});
								}
								Partner.findByIdAndUpdate(
									partner_id,
									{
										name: name,
										address: address,
										state: state,
										zip: zip,
										ccode: ccode,
										bcode: bcode,
										country: country,
										mobile: mobile,
										email: email,
										verify_user_access: verify_user_access,
										logo: logo,
										contract: contract,
									},
									{ new: true },
									(err4, partner) => {
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
										} else if (!partner) {
											res.status(200).json({
												status: 0,
												message: "partner not found",
											});
										} else {
											Document.updateOne(
												{ partner_id: partner_id },
												{ contract: contract },
												(err45) => {}
											);
											return res
												.status(200)
												.json({ status: 1, partner: partner });
										}
									}
								);
							} else {
								res.status(200).json({
									status: 0,
									message: "OTP Missmatch",
								});
							}
						}
					}
				);
			
		}
	);
});

/**
 * @swagger
 * /bank/addPartner:
 *  post:
 *    description: Use to create a partner by bank
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/bank/addPartner", jwtTokenAuth, function (req, res) {
	const {
		bank_id,
		name,
		code,
		address,
		state,
		zip,
		country,
		ccode,
		mobile,
		email,
		logo,
		contract,
		verify_user_access,
		otp_id,
		otp,
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
			}else if (!bank || bank == null || bank == undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err2, adminbank) => {
								var result2 = errorMessage(err2, adminbank, "Bank is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								} else {
									OTP.findOne(
										{
											_id: otp_id,
											otp: otp,
										},
										function (err3, otpd) {
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
												if (!otpd) {
													res.status(200).json({
														status: 0,
														message: "OTP Missmatch",
													});
												} else {
													if (otpd.otp == otp) {
														if (
															name == "" ||
															address == "" ||
															state == "" ||
															mobile == "" ||
															email == ""
														) {
															return res.status(200).json({
																status: 0,
																message: "Please provide valid inputs",
															});
														}
														let data = new Partner();
														data.name = name;
														data.code = code;
														data.address = address;
														data.state = state;
														data.country = country;
														data.zip = zip;
														data.ccode = ccode;
														data.mobile = mobile;
														data.username = mobile;
														data.email = email;
														data.verify_user_access = verify_user_access;
														data.bank_id = bank_id;
														data.logo = logo;
														data.contract = contract;
														data.password = makeid(10);
					
														data.save((err4, partner) => {
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
																let data2 = new Document();
																data2.partner_id = partner._id;
																data2.contract = contract;
																data2.save((err5) => {});
					
																let content =
																	"<p>Your partner is added in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
																	config.mainIP +
																	"/partner'>http://" +
																	config.mainIP +
																	"/partner</a></p><p><p>Your username: " +
																	data.username +
																	"</p><p>Your password: " +
																	data.password +
																	"</p>";
																sendMail(content, "Partner Account Created", email);
																let content2 =
																	"Your partner is added in E-Wallet application Login URL: http://" +
																	config.mainIP +
																	"/partner Your username: " +
																	data.username +
																	" Your password: " +
																	data.password;
																sendSMS(content2, mobile);
					
																return res.status(200).json({ status: 1, partner: data });
															}
														});
													} else {
														res.status(200).json({
															status: 0,
															message: "OTP Missmatch",
														});
													}
												}
											}
										}
									);
								}
							});
						}	
					}
				);
			} else {
				OTP.findOne(
					{
						_id: otp_id,
						otp: otp,
					},
					function (err6, otpd) {
						if (err6) {
							console.log(err6);
							var message6 = err6;
							if (err6.message) {
								message6 = err6.message;
							}
							res.status(200).json({
								status: 0,
								message: message6,
							});
						} else {
							if (!otpd) {
								res.status(200).json({
									status: 0,
									message: "OTP Missmatch",
								});
							} else {
								if (otpd.otp == otp) {
									if (
										name == "" ||
										address == "" ||
										state == "" ||
										mobile == "" ||
										email == ""
									) {
										return res.status(200).json({
											status: 0,
											message: "Please provide valid inputs",
										});
									}
									let data = new Partner();
									data.name = name;
									data.code = code;
									data.address = address;
									data.state = state;
									data.country = country;
									data.zip = zip;
									data.ccode = ccode;
									data.mobile = mobile;
									data.username = mobile;
									data.email = email;
									data.verify_user_access = verify_user_access;
									data.bank_id = bank_id;
									data.logo = logo;
									data.contract = contract;
									data.password = makeid(10);

									data.save((err7, partner) => {
										if (err7) {
											console.log(err7);
											var message7 = err7;
											if (err7.message) {
												message7 = err7.message;
											}
											res.status(200).json({
												status: 0,
												message: message7,
											});
										} else {
											let data2 = new Document();
											data2.partner_id = partner._id;
											data2.contract = contract;
											data2.save((err8) => {});

											let content =
												"<p>Your partner is added in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
												config.mainIP +
												"/partner'>http://" +
												config.mainIP +
												"/partner</a></p><p><p>Your username: " +
												data.username +
												"</p><p>Your password: " +
												data.password +
												"</p>";
											sendMail(content, "Partner Account Created", email);
											let content2 =
												"Your partner is added in E-Wallet application Login URL: http://" +
												config.mainIP +
												"/partner Your username: " +
												data.username +
												" Your password: " +
												data.password;
											sendSMS(content2, mobile);

											return res.status(200).json({ status: 1, partner: data });
										}
									});
								} else {
									res.status(200).json({
										status: 0,
										message: "OTP Missmatch",
									});
								}
							}
						}
					}
				);
			}
		}
	);
});

router.post("/bank/getPartnerDashStats", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { partner_id } = req.body;
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
			}else if (!bank || bank == null || bank == undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err2, adminbank) => {
								var result2 = errorMessage(err2, adminbank, "Bank is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}	
				PartnerCashier.countDocuments(
					{
						partner_id: partner_id,
					},
					(err3, count) => {
						if (count == null || !count) {
							count = 0;
						}
						PartnerCashier.aggregate(
							[
								{ $match : {partner_id: partner_id}},
								{
									$group: {
										_id: null,
										total: {
											$sum: "$cash_in_hand",
										},
										totalFee: {
											$sum: "$fee_generated",
										},
										totalCommission: {
											$sum: "$commission_generated",
										},
										openingBalance: {
											$sum: "$opening_balance",
										},
										closingBalance: {
											$sum: "$closing_balance",
										},
										cashReceived: {
											$sum: "$cash_received",
										},
										cashReceivedFee: {
											$sum: "$cash_received_fee",
										},
										cashReceivedComm: {
											$sum: "$cash_received_commission",
										},
										cashPaid: {
											$sum: "$cash_paid",
										},
										cashPaidFee: {
											$sum: "$cash_paid_fee",
										},
										cashPaidComm: {
											$sum: "$cash_paid_commission",
										}
									},
								},
							],
							async (err4, aggregate) => {
								Invoice.aggregate(
									[{ 
										$match : {
											payer_partner_id: partner_id,
											paid:1,
										}
									},
										{
											$group: {
												_id: null,
												totalAmountPaid: {
													$sum: "$amount",
												},
												bills_paid: { $sum: 1 },
											},
										},
									],
									async (err5, invoices) => {
										let amountpaid = 0;
										let billpaid = 0;
										let cin = 0;
										let fg = 0;
										let cg = 0;
										let ob = 0;
										let cr = 0;
										let crf = 0;
										let crc = 0;
										let cp = 0;
										let cpf = 0;
										let cpc = 0;
										let cb = 0;
										if (
											aggregate != undefined &&
											aggregate != null &&
											aggregate.length > 0
										) {
											cin = aggregate[0].total;
											fg = aggregate[0].totalFee;
											cg = aggregate[0].totalCommission;
											ob = aggregate[0].openingBalance;
											cr = aggregate[0].cashReceived;
											cp = aggregate[0].cashPaid;
											cb = aggregate[0].closingBalance;
											crf = aggregate[0].cashReceivedFee;
											crc = aggregate[0].cashReceivedComm;
											cpf = aggregate[0].cashPaidFee;
											cpc = aggregate[0].cashPaidComm;
										}
										if (
											invoices != undefined &&
											invoices != null &&
											invoices.length > 0
										) {
											amountpaid = invoices[0].totalAmountPaid;
											billpaid = invoices[0].bills_paid;
										}
										res.status(200).json({
											status: 1,
											invoicePaid: billpaid,
											amountPaid: amountpaid,
											totalCashier: count,
											cashInHand: cin,
											feeGenerated : fg,
										 	cashReceived: cr,
											cashReceivedFee: crf,
											cashReceivedComm: crc,
											cashPaid: cp,
											cashPaidFee: cpf,
											cashPaidComm: cpc,
											commissionGenerated: cg,
											openingBalance: ob,
											closingBalance: cb,
										});
									}
								);
							}
						);
					}
				);
			
		}
	);
});


router.post("/getBankDashStatsForPartners", function (req, res) {
	const { bank_id, token } = req.body;
	var username = keyclock.getUsername(token);
	if(!keyclock.checkRoles(token, keyclock_constant.roles.BANK_ADMIN_ROLE)) {
		res.status(200).json({
			status: 0,
			message: "Unauthorized to login",
		});
	}else{
		Bank.findOne(
			{
				username: username,
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
				}else if (!bank || bank == null || bank == undefined){
					BankUser.findOne(
						{
							username: username,
							role: {$in: ['bankAdmin', 'infraAdmin']},
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
								Bank.findOne({ _id: admin.bank_id }, (err2, adminbank) => {
									var result2 = errorMessage(err2, adminbank, "Bank is blocked");
									if (result2.status == 0) {
										res.status(200).json(result2);
									}
								});
							}	
						}
					);
				}	
					PartnerCashier.countDocuments(
						{
							bank_id: bank_id,
						},
						(err3, count) => {
							if (count == null || !count) {
								count = 0;
							}
							PartnerCashier.aggregate(
								[
									{ $match : {bank_id: bank_id}},
									{
										$group: {
											_id: null,
											total: {
												$sum: "$cash_in_hand",
											},
											totalFee: {
												$sum: "$fee_generated",
											},
											totalCommission: {
												$sum: "$commission_generated",
											},
											openingBalance: {
												$sum: "$opening_balance",
											},
											closingBalance: {
												$sum: "$closing_balance",
											},
											cashReceived: {
												$sum: "$cash_received",
											},
											cashReceivedFee: {
												$sum: "$cash_received_fee",
											},
											cashReceivedComm: {
												$sum: "$cash_received_commission",
											},
											cashPaid: {
												$sum: "$cash_paid",
											},
											cashPaidFee: {
												$sum: "$cash_paid_fee",
											},
											cashPaidComm: {
												$sum: "$cash_paid_commission",
											}
										},
									},
								],
								async (err4, aggregate) => {
									Invoice.aggregate(
										[{ 
											$match : {
												payer_bank_id: bank_id,
												paid:1,
											}
										},
											{
												$group: {
													_id: null,
													totalAmountPaid: {
														$sum: "$amount",
													},
													bills_paid: { $sum: 1 },
												},
											},
										],
										async (err5, invoices) => {
											let amountpaid = 0;
											let billpaid = 0;
											let cin = 0;
											let fg = 0;
											let cg = 0;
											let ob = 0;
											let cr = 0;
											let crf = 0;
											let crc = 0;
											let cp = 0;
											let cpf = 0;
											let cpc = 0;
											let cb = 0;
											if (
												aggregate != undefined &&
												aggregate != null &&
												aggregate.length > 0
											) {
												cin = aggregate[0].total;
												fg = aggregate[0].totalFee;
												cg = aggregate[0].totalCommission;
												ob = aggregate[0].openingBalance;
												cr = aggregate[0].cashReceived;
												cp = aggregate[0].cashPaid;
												cb = aggregate[0].closingBalance;
												crf = aggregate[0].cashReceivedFee;
												crc = aggregate[0].cashReceivedComm;
												cpf = aggregate[0].cashPaidFee;
												cpc = aggregate[0].cashPaidComm;
											}
											if (
												invoices != undefined &&
												invoices != null &&
												invoices.length > 0
											) {
												amountpaid = invoices[0].totalAmountPaid;
												billpaid = invoices[0].bills_paid;
											}
											var totalPartners = await Partner.countDocuments({bank_id: bank_id});
											res.status(200).json({
												status: 1,
												invoicePaid: billpaid,
												amountPaid: amountpaid,
												totalCashier: count,
												cashInHand: cin,
												feeGenerated : fg,
												cashReceived: cr,
												cashPaid: cp,
												cashReceivedFee: crf,
												cashReceivedComm: crc,
												cashPaidFee: cpf,
												cashPaidComm: cpc,
												commissionGenerated: cg,
												openingBalance: ob,
												closingBalance: cb,
												totalPartners:totalPartners,
											});
										}
									);
								}
							);
						}
					);
				
			}
		);
	}
});

/**
 * @swagger
 * /bank/listPartnerBranches:
 *  post:
 *    description: Use to list all partner's branches by bank
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/bank/listPartnerBranches", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const {partner_id} = req.body;
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
			}else if (!bank || bank == null || bank == undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err2, adminbank) => {
								var result2 = errorMessage(err2, adminbank, "Bank is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}		
				PartnerBranch.find(
					{ partner_id: partner_id },
					function (err3, branches) {
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
								branches: branches,
							});
						}
					}
				);
			
		}
		
	);
});

/**
 * @swagger
 * /bank/getPartnerBranchDailyReport:
 *  post:
 *    description: Use to get partner's branch's daily report by date 
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/bank/getPartnerBranchDailyReport", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { branch_id, start, end} = req.body;
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
			}else if (!bank || bank == null || bank == undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err2, adminbank) => {
								var result2 = errorMessage(err2, adminbank, "Bank is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}		
				DailyReport.aggregate(
					[{ 
						$match : {
							branch_id: branch_id,
							created_at: {
								$gte: new Date(
									start
								),
								$lte: new Date(
									end
								),
							},
						}
					},
						{
							$group: {
								_id: null,
								opening_balance: {
									$sum: "$opening_balance",
								},
								cash_in_hand: {
									$sum: "$cash_in_hand",
								},
								fee_generated: {
									$sum: "$fee_generated",
								},
								comm_generated: {
									$sum: "$comm_generated",
								},
								closing_balance: {
									$sum: "$closing_balance",
								},
								discripancy: {
									$sum: "$descripency",
								},
								cash_received: {
									$sum: "$cash_received",
								},
								cash_received_fee: {
									$sum: "$cash_received_fee",
								},
								cash_received_commission: {
									$sum: "$cash_received_commission",
								},
								cash_paid: {
									$sum: "$cash_paid",
								},
								cash_paid_fee: {
									$sum: "$cash_paid_fee",
								},
								cash_paid_commission: {
									$sum: "$cash_paid_commission",
								},
								
							},
						},
					],
					async(err3, reports) => {
						if (err3) {
							res.status(200).json(catchError(err3));
						} else {
							Invoice.aggregate(
								[{ 
									$match : {
										payer_branch_id: branch_id,
										date_paid: {
											$gte: new Date(
												start
											),
											$lte: new Date(
												end
											),
										},
										paid:1,
									}
								},
									{
										$group: {
											_id: null,
											totalAmountPaid: {
												$sum: "$amount",
											},
											bills_paid: { $sum: 1 },
										},
									},
								],
								async (err4, invoices) => {
									if (err4) {
										res.status(200).json(catchError(err4));
									} else {
										let amountpaid = 0;
										let billpaid = 0;
										if (
											invoices != undefined &&
											invoices != null &&
											invoices.length > 0
										) {
											amountpaid = invoices[0].totalAmountPaid;
											billpaid = invoices[0].bills_paid;
										}
											
											res.status(200).json({
												status: 1,
												reports: reports,
												invoicePaid: billpaid,
												amountPaid: amountpaid,
											});
									}
								}
							)
						}
					}
				);
			
		}
	);
});

/**
 * @swagger
 * /bank/getPartnerDailyReport:
 *  post:
 *    description: Use to get partner's daily report by date 
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/bank/getPartnerDailyReport", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { partner_id, start, end} = req.body;
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
			}else if (!bank || bank == null || bank == undefined){
				BankUser.findOne(
					{
						username: jwtusername,
						role: {$in: ['bankAdmin', 'infraAdmin']},
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
							Bank.findOne({ _id: admin.bank_id }, (err2, adminbank) => {
								var result2 = errorMessage(err2, adminbank, "Bank is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								}
							});
						}	
					}
				);
			}
				DailyReport.aggregate(
					[{ 
						$match : {
							partner_id: partner_id,
							created_at: {
								$gte: new Date(
									start
								),
								$lte: new Date(
									end
								),
							},
						}
					},
						{
							$group: {
								_id: null,
								opening_balance: {
									$sum: "$opening_balance",
								},
								cash_in_hand: {
									$sum: "$cash_in_hand",
								},
								fee_generated: {
									$sum: "$fee_generated",
								},
								comm_generated: {
									$sum: "$comm_generated",
								},
								closing_balance: {
									$sum: "$closing_balance",
								},
								discripancy: {
									$sum: "$descripency",
								},
								cash_received: {
									$sum: "$cash_received",
								},
								cash_received_fee: {
									$sum: "$cash_received_fee",
								},
								cash_received_commission: {
									$sum: "$cash_received_commission",
								},
								cash_paid: {
									$sum: "$cash_paid",
								},
								cash_paid_fee: {
									$sum: "$cash_paid_fee",
								},
								cash_paid_commission: {
									$sum: "$cash_paid_commission",
								},
								
							},
						},
					],
					async(err3, reports) => {
						if (err3) {
							res.status(200).json(catchError(err3));
						} else {
							Invoice.aggregate(
								[{ 
									$match : {
										payer_partner_id: partner_id,
										date_paid: {
											$gte: new Date(
												start
											),
											$lte: new Date(
												end
											),
										},
										paid:1,
									}
								},
									{
										$group: {
											_id: null,
											totalAmountPaid: {
												$sum: "$amount",
											},
											bills_paid: { $sum: 1 },
										},
									},
								],
								async (err4, invoices) => {
									if (err4) {
										res.status(200).json(catchError(err4));
									} else {
										let amountpaid = 0;
										let billpaid = 0;
										if (
											invoices != undefined &&
											invoices != null &&
											invoices.length > 0
										) {
											amountpaid = invoices[0].totalAmountPaid;
											billpaid = invoices[0].bills_paid;
										}
											
											res.status(200).json({
												status: 1,
												reports: reports,
												invoicePaid: billpaid,
												amountPaid: amountpaid,
											});
									}
								}
							)
						}
					}
				);
			
		}
	);
});


module.exports = router;
