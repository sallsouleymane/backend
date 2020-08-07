const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const secret = "jwt_secret_key_for_ewallet_of_32bit_string";

//utils
const makeid = require("./utils/idGenerator");

const Infra = require("../models/Infra");
const User = require("../models/User");
const Merchant = require("../models/merchant/Merchant");
const MerchantBranch = require("../models/merchant/MerchantBranch");
const MerchantStaff = require("../models/merchant/MerchantStaff");
const MerchantCashier = require("../models/merchant/MerchantCashier");
const Bank = require("../models/Bank");
const Profile = require("../models/Profile");
const Branch = require("../models/Branch");
const BankUser = require("../models/BankUser");
const Cashier = require("../models/Cashier");

function jwtsign(sign_creds) {
	var token = jwt.sign(
		{
			sign_creds: sign_creds,
		},
		secret
		// {
		// 	expiresIn: "365d"
		// }
	);
	return token;
}

router.post("/merchantBranch/login", (req, res) => {
	const { username, password } = req.body;
	MerchantBranch.findOne(
		{ username, password, status: { $ne: 2 } },
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
			} else if (branch == null) {
				return res.status(200).json({
					status: 0,
					message: "User account not found or blocked.",
				});
			}
			let sign_creds = { username: username, password: password };
			const token = jwtsign(sign_creds);
			res.status(200).json({
				status: 1,
				details: branch,
				token: token,
			});
		}
	);
});

router.post("/merchantCashier/login", (req, res) => {
	const { username, password } = req.body;
	MerchantStaff.findOne(
		{ username, password, status: { $ne: 2 } },
		"-password",
		function (err, staff) {
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
			} else if (staff == null) {
				res.status(200).json({
					status: 0,
					message: "User account not found or blocked.",
				});
			} else {
				Merchant.findOne(
					{ _id: staff.merchant_id },
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
								message: "Merchant is blocked",
							});
						} else {
							MerchantBranch.findOne(
								{ _id: staff.branch_id, status: 1 },
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
									} else if (branch == null) {
										res.status(200).json({
											status: 0,
											message: "Branch is blocked",
										});
									} else {
										MerchantCashier.findOneAndUpdate(
											{ staff_id: staff._id, status: 1 },
											{ username: username },
											{ new: true },
											(err, cashier) => {
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
												} else if (cashier == null) {
													return res.status(200).json({
														status: 0,
														message: "Cashier not found or blocked",
													});
												} else {
													let sign_creds = { username: username, password: password };
													const token = jwtsign(sign_creds);
													res.status(200).json({
														status: 1,
														token: token,
														cashier: cashier,
														staff: staff,
														branch: branch,
														merchant: merchant,
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

router.post("/merchant/login", (req, res) => {
	const { username, password } = req.body;
	Merchant.findOne({ username, password }, "-password", function (
		err,
		merchant
	) {
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
			return res.status(200).json({
				status: 0,
				message: "User account not found. Please signup",
			});
		} else {
			let sign_creds = { username: username, password: password };
			const token = jwtsign(sign_creds);
			res.status(200).json({
				status: 1,
				details: merchant,
				token: token,
			});
		}
	});
});

router.post("/login", function (req, res) {
	const { username, password } = req.body;
	Infra.findOne(
		{
			username: { $regex: new RegExp(username, "i") },
			password,
		},
		function (err, user) {
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
			} else if (!user) {
				res.status(200).json({
					status: 0,
					message: "Incorrect username or password",
				});
			} else {
				let token = makeid(10);
				Infra.findByIdAndUpdate(
					user._id,
					{
						token: token,
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
							if (user.profile_id && user.profile_id !== "") {
								Profile.findOne(
									{
										_id: user.profile_id,
									},
									function (err, profile) {
										res.status(200).json({
											token: token,
											permissions: profile.permissions,
											name: user.name,
											isAdmin: user.isAdmin,
											initial_setup: user.initial_setup,
										});
									}
								);
							} else {
								if (user.isAdmin) {
									res.status(200).json({
										token: token,
										permissions: "all",
										name: user.name,
										isAdmin: user.isAdmin,
										initial_setup: user.initial_setup,
									});
								} else {
									res.status(200).json({
										token: token,
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
			}
		}
	);
});

router.post("/bankLogin", function (req, res) {
	const { username, password } = req.body;
	Bank.findOne(
		{
			username,
			password,
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
			} else if (!bank) {
				res.status(200).json({
					status: 0,
					message: "Incorrect username or password",
				});
			} else if (bank.status == -1) {
				res.status(200).json({
					status: 0,
					message: "Your account has been blocked, pls contact the admin!",
				});
			} else {
				let token = makeid(10);
				Bank.findByIdAndUpdate(
					bank._id,
					{
						token: token,
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
								token: token,
								name: bank.name,
								initial_setup: bank.initial_setup,
								username: bank.username,
								mobile: bank.mobile,
								status: bank.status,
								contract: bank.contract,
								logo: bank.logo,
								id: bank._id,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/branchLogin", function (req, res) {
	const { username, password } = req.body;
	Branch.findOne(
		{
			username,
			password,
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
			} else if (!bank) {
				res.status(200).json({
					status: 0,
					message: "Incorrect username or password",
				});
			} else if (bank.status == -1) {
				res.status(200).json({
					status: 0,
					message: "Your account has been blocked, pls contact the admin!",
				});
			} else {
				Bank.findOne(
					{
						_id: bank.bank_id,
					},
					function (err, ba) {
						let logo = ba.logo;
						let token = makeid(10);
						Branch.findByIdAndUpdate(
							bank._id,
							{
								token: token,
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
										token: token,
										name: bank.name,
										initial_setup: bank.initial_setup,
										username: bank.username,
										status: bank.status,
										email: bank.email,
										mobile: bank.mobile,
										logo: logo,
										id: bank._id,
									});
								}
							}
						);
					}
				);
			}
		}
	);
});

router.post("/cashierLogin", function (req, res) {
	const { username, password } = req.body;
	BankUser.findOne(
		{
			username,
			password,
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
					message: "Incorrect username or password",
				});
			} else if (bank.status == -1) {
				res.status(200).json({
					status: 0,
					message: "Your account has been blocked, pls contact the admin!",
				});
			} else {
				let token = makeid(10);
				Cashier.findOneAndUpdate(
					{
						bank_user_id: bank._id,
					},
					{ $set: { token, token } },
					function (err, cashier) {
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
						} else if (cashier == null) {
							return res.status(200).json({
								status: 0,
								message: "This user is not assigned as a cashier.",
							});
						} else {
							res.status(200).json({
								token: token,
								name: cashier.name,
								username: bank.username,
								status: cashier.status,
								email: bank.email,
								mobile: bank.mobile,
								cashier_id: cashier._id,
								id: bank._id,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/user/login", (req, res) => {
	const { username, password } = req.body;
	User.findOne({ username, password }, "-password", function (err, user) {
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
		} else if (user == null) {
			return res.status(200).json({
				status: 0,
				message: "User account not found. Please signup",
			});
		} else {
			let sign_creds = { username: username, password: password };
			const token = jwtsign(sign_creds);
			res.status(200).json({
				status: 1,
				user: user,
				token: token,
			});
		}
	});
});

module.exports = router;
