const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Cashier = require("../models/Cashier");

router.post("/getUser", function (req, res) {
	const { token, mobile } = req.body;
	Cashier.findOne(
		{ token },
		function (err, cashier) {
			if (err) {
				console.log(err);
				return res.status(200).json({
					error: "Internal Error"
				});
			}
			if (cashier == null) {
				res.status(200).json({
					error: "You are either not authorised or not logged in."
				});
			}
			User.findOne(
                { mobile },
                function (err, user) {
                    if (err) {
                        console.log(err);
                        return res.status(200).json({
                            error: "Internal Error"
                        });
                    }
                    if (cashier == null) {
                        res.status(200).json({
                            error: "You are either not authorised or not logged in."
                        });
                    }
                    res.status(200).json({
                        status: "success",
                        data: user,
                    });
                })
	})
})

module.exports = router;
