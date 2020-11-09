const express = require("express");
const router = express.Router();
const config = require("../../config.json");

//utils
const makeid = require("../utils/idGenerator");
const sendSMS = require("../utils/sendSMS");
const sendMail = require("../utils/sendMail");

//services
const { createWallet } = require("../../services/Blockchain.js");

const Bank = require("../../models/Bank");
const Merchant = require("../../models/merchant/Merchant");
const getWalletIds = require("../utils/getWalletIds");

router.post("/bank/listMerchants", function (req, res) {
	var { token } = req.body;
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

router.post("/bank/createMerchant", function (req, res) {
	var {
		token,
		code,
		name,
		logo,
		description,
		document_hash,
		email,
		mobile,
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

router.post("/bank/editMerchant", function (req, res) {
	var {
		token,
		merchant_id,
		name,
		logo,
		description,
		document_hash,
		email,
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
				Merchant.findOneAndUpdate(
					{ _id: merchant_id, creator: 0, bank_id: bank._id },
					{
						name: name,
						logo: logo,
						description: description,
						document_hash: document_hash,
						email: email,
					},
					(err, merchant) => {
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
								message: "Merchant not found.",
							});
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
