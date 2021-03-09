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
const Merchant = require("../../models/merchant/Merchant");
const MerchantBranch = require("../../models/merchant/MerchantBranch");
const MerchantPosition = require("../../models/merchant/Position");
const getWalletIds = require("../utils/getWalletIds");
const InvoiceGroup = require("../../models/merchant/InvoiceGroup");

router.post("/bank/changeMerchantAcces", jwtTokenAuth, function (req, res) {
	const { merchant_id, is_private } = req.body;
	const jwtusername = req.sign_creds.username;
	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			let errMsg = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (errMsg.status == 0) {
				res.status(200).json(errMsg);
			} else {
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
			let result = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
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
			let result = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
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
		}
	);
});

router.post("/bank/listMerchants", jwtTokenAuth, function (req, res) {
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
				Merchant.find({ bank_id: bank._id }, "-password", (err, merchants) => {
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
		}
	);
});

router.post("/bank/createMerchant", jwtTokenAuth, function (req, res) {
	var {
		code,
		name,
		logo,
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
			let result = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				if (!code) {
					res.status(200).json({
						status: 0,
						message: "Code is a required field",
					});
				} else {
					const wallet_ids = getWalletIds("merchant", code, bank.bcode);
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
								data.bank_id = bank._id;
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
												_id: bank._id,
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
													group.code = 'default';
													group.description = 'default';
													group.save((err) => {
														if (err) {
															console.log(err);
															res.status(200).json({
																status: 0,
																message:
																	"Error creating Invoice Group Category",
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
			let result = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Merchant.findOneAndUpdate(
					{ _id: merchant_id, creator: 0, bank_id: bank._id },
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
		}
	);
});
module.exports = router;
