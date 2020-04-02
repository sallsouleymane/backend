const express = require("express");
const router = express.Router();

const BankUser = require("../models/BankUser");

router.post("/cashierSetupUpdate", function(req, res) {
	const { username, password, token } = req.body;
	BankUser.findOne(
		{
			token,
			status: 1
		},
		function(err, bank) {
			if (err) {
				res.status(500).json({
					error: "Internal error please try again"
				});
			} else if (!bank || bank == null) {
				res.status(401).json({
					error: "Incorrect username or password"
				});
			} else {
				BankUser.findByIdAndUpdate(
					bank._id,
					{
						password: password,
						initial_setup: true
					},
					err => {
						if (err)
							return res.status(400).json({
								error: err
							});
						res.status(200).json({
							success: "Updated successfully"
						});
					}
				);
			}
		}
	);
});

module.exports = router;