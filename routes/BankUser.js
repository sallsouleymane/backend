const express = require("express");
const router = express.Router();

const BankUser = require("../models/BankUser");
const jwtTokenAuth = require("./JWTTokenAuth");

router.post("/cashierSetupUpdate", jwtTokenAuth, function (req, res) {
	const { password } = req.body;
	const jwtusername = req.sign_creds.username;
	BankUser.findOne(
		{
			username: jwtusername,
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
			} else if (!bank) {
				res.status(200).json({
					status: 0,
					message: "Incorrect username or password",
				});
			} else {
				BankUser.findByIdAndUpdate(
					bank._id,
					{
						password: password,
						initial_setup: true,
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
								message: "Updated successfully",
							});
						}
					}
				);
			}
		}
	);
});

module.exports = router;
