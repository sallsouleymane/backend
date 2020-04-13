const express = require("express");
const router = express.Router();
const jwt = require('jsonwebtoken');
const secret = "jwt_secret_key_for_ewallet_of_32bit_string";

//utils
const makeid = require("./utils/idGenerator");

const Infra = require("../models/Infra");
const User = require("../models/User");
const Bank = require("../models/Bank");
const Profile = require("../models/Profile");
const Branch = require("../models/Branch");
const BankUser = require("../models/BankUser");
const Cashier = require("../models/Cashier");

function jwtsign(username, password){
	var token = jwt.sign(
		{
			username: username,
			password, password
		},
		secret,
		{
			expiresIn: "6800000"
		}
	);
	return token
}

router.post("/login", function(req, res) {
	const { username, password } = req.body;
	Infra.findOne(
		{
			username: { $regex: new RegExp(username, "i") },
			password
		},
		function(err, user) {
			if (err) {
				res.status(500).json({
					error: "Internal error please try again"
				});
			} else if (!user) {
				res.status(401).json({
					error: "Incorrect username or password"
				});
			} else {
				let token = makeid(10);
				Infra.findByIdAndUpdate(
					user._id,
					{
						token: token
					},
					err => {
						if (err)
							return res.status(400).json({
								error: err
							});
						if (user.profile_id && user.profile_id !== "") {
							Profile.findOne(
								{
									_id: user.profile_id
								},
								function(err, profile) {
									res.status(200).json({
										token: token,
										permissions: profile.permissions,
										name: user.name,
										isAdmin: user.isAdmin,
										initial_setup: user.initial_setup
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
									initial_setup: user.initial_setup
								});
							} else {
								res.status(200).json({
									token: token,
									permissions: "",
									name: user.name,
									isAdmin: user.isAdmin,
									initial_setup: user.initial_setup
								});
							}
						}
					}
				);
			}
		}
	);
});

router.post("/bankLogin", function(req, res) {
	const { username, password } = req.body;
	Bank.findOne(
		{
			username,
			password
		},
		function(err, bank) {
			if (err) {
				res.status(500).json({
					error: "Internal error please try again"
				});
			} else if (!bank) {
				res.status(401).json({
					error: "Incorrect username or password"
				});
			} else if (bank.status == -1) {
				res.status(401).json({
					error: "Your account has been blocked, pls contact the admin!"
				});
			} else {
				let token = makeid(10);
				Bank.findByIdAndUpdate(
					bank._id,
					{
						token: token
					},
					err => {
						if (err)
							return res.status(400).json({
								error: err
							});
						res.status(200).json({
							token: token,
							name: bank.name,
							initial_setup: bank.initial_setup,
							username: bank.username,
							mobile: bank.mobile,
							status: bank.status,
							contract: bank.contract,
							logo: bank.logo,
							id: bank._id
						});
					}
				);
			}
		}
	);
});

router.post("/branchLogin", function(req, res) {
	const { username, password } = req.body;
	Branch.findOne(
		{
			username,
			password
		},
		function(err, bank) {
			if (err) {
				res.status(500).json({
					error: "Internal error please try again"
				});
			} else if (!bank) {
				res.status(401).json({
					error: "Incorrect username or password"
				});
			} else if (bank.status == -1) {
				res.status(401).json({
					error: "Your account has been blocked, pls contact the admin!"
				});
			} else {
				Bank.findOne(
					{
						_id: bank.bank_id
					},
					function(err, ba) {
						let logo = ba.logo;
						let token = makeid(10);
						Branch.findByIdAndUpdate(
							bank._id,
							{
								token: token
							},
							err => {
								if (err)
									return res.status(400).json({
										error: err
									});
								res.status(200).json({
									token: token,
									name: bank.name,
									initial_setup: bank.initial_setup,
									username: bank.username,
									status: bank.status,
									email: bank.email,
									mobile: bank.mobile,
									logo: logo,
									id: bank._id
								});
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
				res.status(500).json({
					error: "Internal error please try again",
				});
			} else if (bank == null) {
				res.status(401).json({
					error: "Incorrect username or password",
				});
			} else if (bank.status == -1) {
				res.status(401).json({
					error: "Your account has been blocked, pls contact the admin!",
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
							return res.status(401).json({
								error: "Internal error",
							});
						}
						if (cashier == null) {
							return res.status(401).json({
								error: "This user is not assigned as a cashier.",
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
	User.findOne(
		{ username, password },
		function(err, user) {
			if (err) {
				console.log(err);
				return res.status(200).json({
					status: 0,
					error: "Internal Server Error"
				});
			}
			if (user == null) {
				return res.status(200).json({
					status: 0,
					error: "User account not found. Please signup"
				});
			}
			const token = jwtsign(username, password)
			res.status(200).json({
				status: 1,
				user: user,
				token: token
			});
		}
	);
});

module.exports = router;
