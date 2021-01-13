const express = require("express");
const router = express.Router();
const config = require("../config.json");
const jwtTokenAuth = require("./JWTTokenAuth");

//utils
const makeid = require("./utils/idGenerator");
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const makeotp = require("./utils/makeotp");
const getWalletIds = require("./utils/getWalletIds");
const { errorMessage, catchError } = require("./utils/errorHandler");

//services
const {
	getStatement,
	createWallet,
	transferThis,
	getBalance,
	initiateTransfer,
} = require("../services/Blockchain.js");

const Infra = require("../models/Infra");
const Fee = require("../models/Fee");
const Bank = require("../models/Bank");
const OTP = require("../models/OTP");
const Profile = require("../models/Profile");
const Document = require("../models/Document");
const Merchant = require("../models/merchant/Merchant");
const Country = require("../models/Country");
const User = require("../models/User");
const Cashier = require("../models/Cashier");
const Branch = require("../models/Branch");
const MerchantBranch = require("../models/merchant/MerchantBranch");
const Partner = require("../models/partner/Partner");

const mainFee = config.mainFee;

router.post("/infra/transferMasterToOp", jwtTokenAuth, function (req, res) {
	const { bank_id, amount } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.findOne(
					{
						_id: bank_id,
						status: 1,
					},
					function (err, bank) {
						let result = errorMessage(err, bank, "Bank not found.");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							const masterWallet = bank.wallet_ids.infra_master;
							const opWallet = bank.wallet_ids.infra_operational;
							const trans = {
								from: masterWallet,
								to: opWallet,
								amount: Number(amount),
								note: "Master to operational",
								email1: infra.email,
								mobile1: infra.mobile,
								from_name: infra.name,
								to_name: infra.name,
								master_code: "",
								child_code: "",
							};
							initiateTransfer(trans)
								.then((result) => {
									res.status(200).json(result);
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
			}
		}
	);
});

router.post("/infra/deleteCountry", jwtTokenAuth, function (req, res) {
	const { ccode } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Country.update(
					{},
					{ country_list: { $pull: { ccode: ccode } } },
					function (err, country) {
						let result = errorMessage(
							err,
							country,
							"Token changed or user not valid. Try to login again or contact system administrator."
						);
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							res.status(200).json({
								status: 1,
								message: "Country Deleted",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/infra/bank/listMerchants", jwtTokenAuth, function (req, res) {
	var { bank_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
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
		}
	);
});

router.post("/infra/createMerchant", jwtTokenAuth, function (req, res) {
	var {
		code,
		name,
		logo,
		description,
		document_hash,
		email,
		mobile,
		bank_id,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.findOne({ _id: bank_id }, (err, bank) => {
					var result = errorMessage(err, bank, "Bank not found");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						if (!code) {
							res.status(200).json({
								status: 0,
								message: "Code is a required field",
							});
						} else {
							const wallet_ids = getWalletIds(
								"infraMerchant",
								code,
								bank.bcode
							);
							createWallet([wallet_ids.operational])
								.then((result) => {
									if (
										result != "" &&
										!result.includes("wallet already exists")
									) {
										console.log(result);
										res.status(200).json({
											status: 0,
											message:
												"Blockchain service was unavailable. Please try again.",
											result: result,
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
										data.infra_id = infra._id;
										data.status = 0;
										data.creator = 1;
										data.wallet_ids.operational = wallet_ids.operational;

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
												sendMail(content, "Infra Merchant Created", email);
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
				});
			}
		}
	);
});

router.post("/infra/editMerchant", jwtTokenAuth, function (req, res) {
	var { merchant_id, name, logo, description, document_hash, email, mobile } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Merchant.findOneAndUpdate(
					{ _id: merchant_id, creator: 1, infra_id: infra._id },
					{
						name: name,
						logo: logo,
						description: description,
						document_hash: document_hash,
						mobile: mobile,
						email: email,
					},
					(err, merchant) => {
						var result = errorMessage(err, merchant, "Merchant not found.");
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

router.post("/getDashStats", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				try {
					var totalBanks = await Bank.countDocuments({});
					var totalmerchants = await Merchant.countDocuments({});
					var totalusers = await User.countDocuments({});
					var totalbranches = await Branch.countDocuments({});
					var totalmerchantbranches = await MerchantBranch.countDocuments({});
					var totalcashiers = await Cashier.countDocuments({});
					var totalpartners = await Partner.countDocuments({});

					res.status(200).json({
						status: 1,
						totalBanks: totalBanks,
						totalMerchants: totalmerchants,
						totalusers: totalusers,
						totalcashiers: totalcashiers,
						totalmerchantbranches: totalmerchantbranches,
						totalpartners: totalpartners,
						totalbranches: totalbranches,
					});
				} catch (err) {
					console.log(err);
					res.status(200).json({ status: 0, message: err.message });
				}
			}
		}
	);
});

router.post("/infraSetupUpdate", jwtTokenAuth, function (req, res) {
	const { username, password } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOneAndUpdate(
		{
			username: jwtusername,
			status: 1,
		},
		{
			$set: {
				username: username,
				password: password,
			},
		},
		function (err, infra) {
			var result = errorMessage(err, infra, "Incorrect username or password");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				res.status(200).json({
					success: "Updated successfully",
				});
			}
		}
	);
});

router.post("/getBanks", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
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
				Bank.find({}, function (err, bank) {
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
							banks: bank,
						});
					}
				});
			}
		}
	);
});

router.post("/setupUpdate", function (req, res) {
	let data = new Infra();
	const { username, password, email, mobile, ccode } = req.body;

	data.name = "Infra Admin";
	data.username = username;

	data.password = password;
	data.mobile = mobile;
	data.email = email;
	data.ccode = ccode;
	data.isAdmin = true;

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
				"<p>Your Infra account is activated in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
				config.mainIP +
				"'>http://" +
				config.mainIP +
				"</a></p><p><p>Your username: " +
				data.username +
				"</p><p>Your password: " +
				data.password +
				"</p>";
			sendMail(content, "Infra Account Activated", data.email);
			let content2 =
				"Your Infra account is activated in E-Wallet application. Login URL: http://" +
				config.mainIP +
				" Your username: " +
				data.username +
				" Your password: " +
				data.password;
			sendSMS(content2, mobile);
			res.status(200).json({
				success: true,
			});
		}
	});
});

router.get("/checkInfra", function (req, res) {
	Infra.countDocuments({}, function (err, c) {
		let result = errorMessage(
			err,
			c,
			"Token changed or user not valid. Try to login again or contact system administrator."
		);
		if (result.status == 0) {
			res.status(200).json(result);
		} else {
			res.status(200).json({
				status: 1,
				infras: c,
			});
		}
	});
});

router.post("/addBank", jwtTokenAuth, function (req, res) {
	let data = new Bank();
	const {
		name,
		bcode,
		address1,
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

	if (
		name === "" ||
		address1 === "" ||
		state === "" ||
		mobile === "" ||
		email === ""
	) {
		res.status(200).json({
			status: 0,
			message: "Please provide valid inputs",
		});
		return;
	}
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			var result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.findOne(
					{
						$or: [{ bcode: bcode }, { mobile: mobile }, { email: email }],
					},
					(err, bank) => {
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
						} else if (bank != null) {
							res.status(200).json({
								status: 0,
								message:
									"Bank with either same code/mobile/email already exist.",
							});
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
									} else if (!otpd) {
										res.status(200).json({
											status: 0,
											message: "OTP Missmatch",
										});
									} else {
										data.name = name;
										data.bcode = bcode;
										data.address1 = address1;
										data.state = state;
										data.country = country;
										data.zip = zip;
										data.ccode = ccode;
										data.mobile = mobile;
										data.username = mobile;
										data.email = email;
										data.user_id = user._id;
										data.logo = logo;
										data.contract = contract;
										data.password = makeid(10);

										data.save((err, d) => {
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
												data2.bank_id = d._id;
												data2.contract = contract;
												data2.save((err) => {});

												let content =
													"<p>Your bank is added in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
													config.mainIP +
													"/bank'>http://" +
													config.mainIP +
													"/bank</a></p><p><p>Your username: " +
													data.username +
													"</p><p>Your password: " +
													data.password +
													"</p>";
												sendMail(content, "Bank Account Created", email);
												let content2 =
													"Your bank is added in E-Wallet application Login URL: http://" +
													config.mainIP +
													"/bank Your username: " +
													data.username +
													" Your password: " +
													data.password;
												sendSMS(content2, mobile);

												res.status(200).json({
													status: 1,
													message: "Added Bank successfully",
												});
											}
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
});

router.post("/editBank", jwtTokenAuth, function (req, res) {
	let data = new Bank();
	const {
		bank_id,
		name,
		bcode,
		address1,
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
	Infra.findOne(
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
									address1 === "" ||
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
								data.address1 = address1;
								data.state = state;
								data.country = country;
								data.bcode = bcode;
								data.zip = zip;
								data.ccode = ccode;
								data.mobile = mobile;
								data.username = mobile;
								data.email = email;
								data.user_id = user._id;
								data.logo = logo;
								data.contract = contract;
								data.password = makeid(10);
								Bank.findByIdAndUpdate(
									bank_id,
									{
										name: name,
										address1: address1,
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
											let data2 = new Document();
											data2.bank_id = bank_id;
											data2.contract = contract;
											data2.save((err) => {});
											return res.status(200).json(data);
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

router.post("/getInfraHistory", jwtTokenAuth, function (req, res) {
	const { from, bank_id } = req.body;

	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, f) {
			let result = errorMessage(
				err,
				f,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.findOne(
					{
						_id: bank_id,
					},
					function (err, b) {
						let result = errorMessage(err, b, "Bank not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							wallet_type = "infra_" + from;
							const wallet = b.wallet_ids[wallet_type];

							getStatement(wallet)
								.then(function (result) {
									res.status(200).json({
										status: 1,
										history: result,
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

router.get("/infra/getMyWalletBalance", jwtTokenAuth, function (req, res) {
	const { from, bank } = req.query;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (e, b) {
			if (e) {
				console.log(e);
				var message = e;
				if (e.message) {
					message = e.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (b == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Bank.findOne(
					{
						_id: bank,
					},
					function (err, ba) {
						let result = errorMessage(err, ba, "Not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							const wallet_type = "infra_" + from;
							const wallet_id = ba.wallet_ids[wallet_type];

							getBalance(wallet_id)
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
					}
				);
			}
		}
	);
});

router.get("/getInfraOperationalBalance", function (req, res) {
	res.status(200).json({
		status: 0,
		message: "This API is Removed",
		Replace:
			"/infra/getWalletBalance - {from, bank} where from can be 'master' or 'operational'",
	});
});
router.get("/getInfraMasterBalance", function (req, res) {
	res.status(200).json({
		status: 0,
		message: "This API is Removed",
		Replace:
			"/infra/getWalletBalance - {from, bank} where from can be 'master' or 'operational'",
	});
});

router.post("/getPermission", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(err, user, "Incorrect username or password");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				if (user.profile_id && user.profile_id != "") {
					Profile.findOne(
						{
							_id: user.profile_id,
						},
						function (err, profile) {
							var p = JSON.parse(profile.permissions);
							res.status(200).json({
								permissions: p,
								name: user.name,
								isAdmin: user.isAdmin,
								initial_setup: user.initial_setup,
							});
						}
					);
				} else {
					if (user.isAdmin) {
						res.status(200).json({
							permissions: "all",
							name: user.name,
							isAdmin: user.isAdmin,
							initial_setup: user.initial_setup,
						});
					} else {
						res.status(200).json({
							permissions: "",
							name: user.name,
							isAdmin: user.isAdmin,
							initial_setup: user.initial_setup,
						});
					}
				}
			}
		}
	);
});

router.post("/addProfile", jwtTokenAuth, function (req, res) {
	let data = new Profile();
	const {
		pro_name,
		pro_description,
		create_bank,
		edit_bank,
		create_fee,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
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
				const user_id = user._id;

				data.name = pro_name;
				data.description = pro_description;
				var c = {
					create_bank,
					edit_bank,
					create_fee,
				};
				data.permissions = JSON.stringify(c);
				data.user_id = user_id;

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
						return res.status(200).json({
							success: "True",
						});
					}
				});
			}
		}
	);
});

router.post("/editProfile", jwtTokenAuth, function (req, res) {
	let data = new Profile();
	const {
		pro_name,
		pro_description,
		create_bank,
		edit_bank,
		create_fee,
		profile_id,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
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
				var _id = profile_id;
				var c = {
					create_bank,
					edit_bank,
					create_fee,
				};
				let c2 = JSON.stringify(c);
				Profile.findOneAndUpdate(
					{
						_id: _id,
					},
					{
						name: pro_name,
						description: pro_description,
						permissions: c2,
					},
					(err, d) => {
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
								success: true,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/addInfraUser", jwtTokenAuth, function (req, res) {
	let data = new Infra();
	const {
		name,
		email,
		mobile,
		username,
		password,
		profile_id,
		logo,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
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
				data.name = name;
				data.email = email;
				data.mobile = mobile;
				data.username = username;
				data.password = password;
				data.profile_id = profile_id;
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
							"<p>Your have been added as Infra in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
							config.mainIP +
							"/'>http://" +
							config.mainIP +
							"/</a></p><p><p>Your username: " +
							username +
							"</p><p>Your password: " +
							password +
							"</p>";
						sendMail(content, "Infra Account Created", email);
						let content2 =
							"Your have been added as Infra in E-Wallet application Login URL: http://" +
							config.mainIP +
							" Your username: " +
							username +
							" Your password: " +
							password;
						sendSMS(content2, mobile);
						return res.status(200).json({
							success: "True",
						});
					}
				});
			}
		}
	);
});

router.post("/editInfraUser", jwtTokenAuth, function (req, res) {
	const {
		name,
		email,
		mobile,
		username,
		password,
		profile_id,
		logo,
		user_id,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
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
				var _id = user_id;
				Infra.findOneAndUpdate(
					{
						_id: _id,
					},
					{
						name: name,
						email: email,
						mobile: mobile,
						username: username,
						password: password,
						profile_id: profile_id,
						logo: logo,
					},
					(err, d) => {
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
								success: true,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/getBank", jwtTokenAuth, function (req, res) {
	const { bank_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
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
				Bank.findOne(
					{
						_id: bank_id,
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
						} else {
							res.status(200).json({
								banks: bank,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/getRules", jwtTokenAuth, function (req, res) {
	const { bank_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
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
				Fee.find(
					{
						bank_id,
						status: { $in: [1, 2] },
					},
					function (err, rules) {
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
								rules: rules,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bankStatus", jwtTokenAuth, function (req, res) {
	const { status, bank_id } = req.body;

	const jwtusername = req.sign_creds.username;
	Infra.findOne(
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
				Bank.findByIdAndUpdate(
					bank_id,
					{
						status: status,
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
							res.status(200).json({
								status: 1,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/getRoles", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
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
				const user_id = user._id;
				Profile.find(
					{
						user_id,
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
						} else {
							res.status(200).json({
								roles: bank,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/getInfraUsers", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
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
				Infra.find({}, function (err, bank) {
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
							users: bank,
						});
					}
				});
			}
		}
	);
});

router.post("/getProfile", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
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
				res.status(200).json({
					users: user,
				});
			}
		}
	);
});

router.post("/editInfraProfile", jwtTokenAuth, function (req, res) {
	const { name, username, email, mobile, password, ccode } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
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
				let upd = {};
				if (password == "" || password == undefined || password == null) {
					upd = {
						name: name,
						email: email,
						mobile: mobile,
						username: username,
						ccode: ccode,
					};
				} else {
					upd = {
						name: name,
						email: email,
						mobile: mobile,
						password: password,
						username: username,
						ccode: ccode,
					};
				}

				Infra.findByIdAndUpdate(user._id, upd, (err) => {
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
							success: true,
						});
					}
				});
			}
		}
	);
});

router.post("/generateOTP", jwtTokenAuth, function (req, res) {
	let data = new OTP();
	const { username, page, name, email, mobile, bcode } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
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
				data.user_id = user._id;
				data.otp = makeotp(6);
				data.page = page;
				if (page == "editBank") {
					Bank.findOne(
						{
							username,
						},
						function (err, bank) {
							data.mobile = bank.mobile;
							data.save((err, ot) => {
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
									let content = "Your OTP to edit Bank is " + data.otp;
									sendSMS(content, bank.mobile);
									sendMail(content, "OTP", bank.email);

									res.status(200).json({
										id: ot._id,
									});
								}
							});
						}
					);
				} else {
					Bank.find(
						{
							$or: [
								{ name: name },
								{ email: email },
								{ mobile: mobile },
								{ bcode: bcode },
							],
						},
						function (err, banks) {
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
							} else if (banks.length == 0) {
								data.mobile = user.mobile;
								data.save((err, ot) => {
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
										let content = "Your OTP to add Bank is " + data.otp;
										sendSMS(content, user.mobile);
										sendMail(content, "OTP", user.email);

										res.status(200).json({
											status: 1,
											id: ot._id,
										});
									}
								});
							} else {
								if (banks[0].name == name) {
									res.status(200).json({
										status: 0,
										message: "Bank already exist with the same name.",
									});
								} else if (banks[0].bcode == bcode) {
									res.status(200).json({
										status: 0,
										message: "Bank already exist with the same code.",
									});
								} else if (banks[0].mobile == mobile) {
									res.status(200).json({
										status: 0,
										message: "Bank already exist with the same mobile.",
									});
								} else if (banks[0].email == email) {
									res.status(200).json({
										status: 0,
										message: "Bank already exist with the same email.",
									});
								} else {
									res.status(200).json({
										status: 0,
										message: "Can not add bank.",
									});
								}
							}
						}
					);
				}
			}
		}
	);
});

router.post("/transferMoney", jwtTokenAuth, function (req, res) {
	const { from, to, note, amount, auth } = req.body;

	if (auth == "infra") {
		const jwtusername = req.sign_creds.username;
		Infra.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err, f) {
				let result = errorMessage(
					err,
					f,
					"Token changed or user not valid. Try to login again or contact system administrator."
				);
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					const infra_email = f.email;
					const infra_mobile = f.mobile;

					var c = to.split("@");
					const bank = c[1];
					Bank.findOne(
						{
							name: bank,
						},
						function (err, b) {
							//var oamount = amount - fee;
							var oamount = amount;

							let data = {};
							data.amount = oamount.toString();
							data.from = from;
							data.to = to;
							data.note = note;
							data.email1 = infra_email;
							data.email2 = infra_email;
							data.mobile1 = infra_mobile;
							data.mobile2 = infra_mobile;
							data.from_name = f.name;
							data.to_name = f.name;
							data.user_id = "";

							transferThis(data)
								.then(function (result) {})
								.catch((err) => {
									console.log(err);
									res.status(200).json({
										status: 0,
										message: err.message,
									});
									return;
								});
							res.status(200).json({
								status: 1,
								message: "Money transferred successfully!",
							});
						}
					);
				}
			}
		);
	} else {
		res.status(200).json({
			status: null,
		});
	}
});

router.post("/checkFee", jwtTokenAuth, function (req, res) {
	const { amount, auth } = req.body;

	if (auth == "infra") {
		const jwtusername = req.sign_creds.username;
		Infra.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err, f) {
				let result = errorMessage(
					err,
					f,
					"Token changed or user not valid. Try to login again or contact system administrator."
				);
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					var temp = (amount * mainFee) / 100;
					var fee = temp;
					res.status(200).json({
						status: 1,
						fee: fee,
					});
				}
			}
		);
	} else {
		res.status(200).json({
			status: 1,
			fee: 0,
		});
	}
});

router.post("/approveFee", jwtTokenAuth, function (req, res) {
	const { id } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			}
			Fee.findOneAndUpdate(
				{
					_id: id,
					status: 2,
				},
				{
					$set: { status: 1 },
				},
				function (err, fee) {
					let result = errorMessage(err, fee, "Infra share not updated");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						res.status(200).json({
							status: 1,
							message: "Updated successfully",
						});
					}
				}
			);
		}
	);
});

module.exports = router;
