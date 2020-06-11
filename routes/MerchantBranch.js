const express = require("express");
const router = express.Router();

const jwtTokenAuth = require("./JWTTokenAuth");

//models
const MerchantBranch = require("../models/merchant/MerchantBranch");
const MerchantStaff = require("../models/merchant/MerchantStaff");
const MerchantCashier = require("../models/merchant/MerchantCashier");

router.get("/merchantBranch/todaysStatus", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	MerchantBranch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, branch) {
			if (err || branch == null) {
				console.log(err);
				res.status(200).json({
					status: 0,
					message: "Internal Server Error",
				});
			} else {
				const today = new Date();
				MerchantBranch.findOneAndUpdate(
					{
						_id: branch._id,
						last_paid_at: {
							$lte: new Date(today.setHours(00, 00, 00)),
						},
					},
					{ amount_collected: 0 },
					{ new: true },
					(err, branch2) => {
						if (err) {
							console.log(err);
							return res.status(200).json({
								status: 0,
								message: "Internal Server error",
							});
						} else if (branch2 != null) {
							branch = branch2;
						}
						res.status(200).json({
							status: 1,
							message: "Today's Status",
							todays_payment: branch.amount_collected,
							last_paid_at: branch.last_paid_at,
							due: branch.amount_due,
							bills_paid: branch.bills_paid,
							bills_raised: branch.bills_raised,
						});
					}
				);
			}
		}
	);
});

router.get("/merchantBranch/listCashier", jwtTokenAuth, (req, res) => {
	const jwtusername = req.sign_creds.username;
	MerchantBranch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, branch) {
			if (err) {
				console.log(err);
				res.status(200).json({
					status: 0,
					message: "Internal Server Error",
				});
			} else if (branch == null) {
				res.status(200).json({
					status: 0,
					message: "Branch is blocked",
				});
			} else {
				MerchantCashier.find({ branch_id: branch._id }, (err, cashiers) => {
					if (err) {
						console.log(err);
						res.status(200).json({
							status: 0,
							message: "Internal Server Error",
						});
					} else {
						res.status(200).json({
							status: 1,
							message: "Cashiers list",
							cashiers: cashiers,
						});
					}
				});
			}
		}
	);
});

router.get("/merchantBranch/listStaff", jwtTokenAuth, (req, res) => {
	const jwtusername = req.sign_creds.username;
	MerchantBranch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, branch) {
			if (err) {
				console.log(err);
				res.status(200).json({
					status: 0,
					message: "Internal Server Error",
				});
			} else if (branch == null) {
				res.status(200).json({
					status: 0,
					message: "Branch is blocked",
				});
			} else {
				MerchantStaff.find({ branch_id: branch._id }, (err, staffs) => {
					if (err) {
						console.log(err);
						res.status(200).json({
							status: 0,
							message: "Internal Server Error",
						});
					} else {
						res.status(200).json({
							status: 1,
							message: "Staffs list",
							staffs: staffs,
						});
					}
				});
			}
		}
	);
});

router.post("/merchantBranch/assignStaff", jwtTokenAuth, (req, res) => {
	const { cashier_id, staff_id } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantBranch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, branch) {
			if (err) {
				res.status(200).json({
					status: 0,
					message: "Internal Server Error",
				});
			} else if (branch == null) {
				res.status(200).json({
					status: 0,
					message: "Branch is blocked",
				});
			} else {
				MerchantStaff.findOne({ _id: staff_id, status: 1, branch_id: branch._id }, (err, staff) => {
					if (err) {
						res.status(200).json({
							status: 0,
							message: "Internal Server Error",
						});
					} else if (staff == null) {
						res.status(200).json({
							status: 0,
							message: "Staff not found",
						});
					} else {
						MerchantCashier.findOneAndUpdate({ _id: cashier_id, branch_id: branch._id }, { staff_id: staff_id }, (err, cashier) => {
							if (err) {
								res.status(200).json({
									status: 0,
									message: "Internal Server Error",
								});
							} else if (cashier == null) {
								res.status(200).json({
									status: 0,
									message: "Cashier not found",
								});
							} else {
                                res.status(200).json({
									status: 1,
									message: "Assigned staff as a cashier",
								});
                            }
						});
					}
				});
			}
		}
	);
});

router.post("/merchantBranch/blockCashier", jwtTokenAuth, (req, res) => {
	const { cashier_id } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantBranch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, branch) {
			if (err) {
				res.status(200).json({
					status: 0,
					message: "Internal Server error",
				});
			} else if (branch == null) {
				res.status(200).json({
					status: 0,
					message: "Branch is blocked",
				});
			} else {
				MerchantCashier.findOneAndUpdate({_id: cashier_id, branch_id: branch._id},
					{ $set: {
						status: 0
					}
					},
					(err, cashier) => {
						if (err) {
							res.status(200).json({
								status: 0,
								message: err,
							});
						} else if (cashier == null) {
							res.status(200).json({
								status: 1,
								data: "Cashier not found",
							});
						}else {
							res.status(200).json({
								status: 1,
								data: "blocked cashier",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchantBranch/unblockCashier", jwtTokenAuth, (req, res) => {
	const { cashier_id } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantBranch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, branch) {
			if (err) {
				res.status(200).json({
					status: 0,
					message: "Internal Server error",
				});
			} else if (branch == null) {
				res.status(200).json({
					status: 0,
					message: "Branch is blocked",
				});
			} else {
				MerchantCashier.findOneAndUpdate({_id: cashier_id, branch_id: branch._id},
					{ $set: {
						status: 1
					}
					},
					(err, cashier) => {
						if (err) {
							res.status(200).json({
								status: 0,
								message: err,
							});
						} else if (cashier == null) {
							res.status(200).json({
								status: 1,
								data: "Cashier not found",
							});
						}else {
							res.status(200).json({
								status: 1,
								data: "Unblocked cashier",
							});
						}
					}
				);
			}
		}
	);
});

module.exports = router;