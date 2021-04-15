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

//services
const {
	createWallet,
	getStatement,
	getBalance,
} = require("../../services/Blockchain.js");
const { errorMessage, catchError } = require("../utils/errorHandler");

const Bank = require("../../models/Bank");
const OTP = require("../../models/OTP");
const Partner = require("../../models/partner/Partner");
const PartnerBranch = require("../../models/partner/Branch");
const PartnerCashier = require("../../models/partner/Cashier");
const Document = require("../../models/Document");

router.post("/bank/blockPartner", jwtTokenAuth, function (req, res) {
	var { partner_id } = req.body;
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
				Partner.findOneAndUpdate(
					{ _id: partner_id },
					{
						$set: {
							status: -1,
						},
					},
					(err, partner) => {
						let result = errorMessage(err, partner, "Partner not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							PartnerBranch.updateMany(
								{partner_id: partner_id},
								{
									$set: {
										status: -1,
									},
								},
								(err, branches) => {
									let result = errorMessage(err, branches, "Branchs not found");
									if (result.status == 0) {
										res.status(200).json(result);
									} else {
										PartnerCashier.updateMany(
											{partner_id: partner_id},
											{
												$set: {
													status: -1,
												},
											},
											(err, cashiers) => {
												let result = errorMessage(err, cashiers, "Cashiers not found");
												if (result.status == 0) {
													res.status(200).json(result);
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
		}
	);
});

router.post("/bank/unblockPartner", jwtTokenAuth, function (req, res) {
	var { partner_id } = req.body;
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
				Partner.findOneAndUpdate(
					{ _id: partner_id },
					{
						$set: {
							status: 1,
						},
					},
					(err, merchant) => {
						let result = errorMessage(err, merchant, "Partner not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							PartnerBranch.updateMany(
								{partner_id: partner_id},
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
										PartnerCashier.updateMany(
											{partner_id: partner_id},
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
		}
	);
});

router.post("/bank/listPartners", jwtTokenAuth, function (req, res) {
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
				Partner.find({ bank_id: bank._id }, function (err, partner) {
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
							partners: partner,
						});
					}
				});
			}
		}
	);
});

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
					function (err, partner) {
						let result = errorMessage(err, partner, "Partner not found");
						if (result.status == 0) {
							res.status(200).json(result);
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

router.post("/bank/editPartner", jwtTokenAuth, function (req, res) {
	const {
		partner_id,
		name,
		bcode,
		address,
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
			let result = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				OTP.findOne(
					{
						_id: otp_id,
						otp: otp,
					},
					function (err, otpd) {
						let result = errorMessage(err, otpd, err);
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							if (otpd.otp === otp) {
								if (
									name === "" ||
									address === "" ||
									state === "" ||
									mobile === "" ||
									email === ""
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
										logo: logo,
										contract: contract,
									},
									{ new: true },
									(err, partner) => {
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
										} else if (!partner) {
											res.status(200).json({
												status: 0,
												message: "partner not found",
											});
										} else {
											Document.updateOne(
												{ partner_id: partner_id },
												{ contract: contract },
												(err) => {}
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
		}
	);
});

router.post("/bank/addPartner", jwtTokenAuth, function (req, res) {
	let data = new Partner();
	const {
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
			let result = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				OTP.findOne(
					{
						_id: otp_id,
						otp: otp,
					},
					function (err, otpd) {
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
							if (!otpd) {
								res.status(200).json({
									status: 0,
									message: "OTP Missmatch",
								});
							} else {
								if (otpd.otp === otp) {
									if (
										name === "" ||
										address === "" ||
										state === "" ||
										mobile === "" ||
										email === ""
									) {
										return res.status(200).json({
											status: 0,
											message: "Please provide valid inputs",
										});
									}

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
									data.bank_id = bank._id;
									data.logo = logo;
									data.contract = contract;
									data.password = makeid(10);

									data.save((err, partner) => {
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
											let data2 = new Document();
											data2.partner_id = partner._id;
											data2.contract = contract;
											data2.save((err) => {});

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
			let result = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {	
				PartnerCashier.countDocuments(
					{
						partner_id: partner_id,
					},
					(err, count) => {
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
										cashPaid: {
											$sum: "$cash_paid",
										}
									},
								},
							],
							async (err, aggregate) => {
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
									async (err, invoices) => {
										let amountpaid = 0;
										let billpaid = 0;
										let cin = 0;
										let fg = 0;
										let cg = 0;
										let ob = 0;
										let cr = 0;
										let cp = 0;
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
											cashPaid: cp,
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
		}
	);
});


module.exports = router;
