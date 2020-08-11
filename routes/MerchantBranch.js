const express = require("express");
const router = express.Router();

const jwtTokenAuth = require("./JWTTokenAuth");

//models
const MerchantBranch = require("../models/merchant/MerchantBranch");
const MerchantStaff = require("../models/merchant/MerchantStaff");
const MerchantCashier = require("../models/merchant/MerchantCashier");

router.post("/merchantBranch/editDetails", jwtTokenAuth, (req, res) => {
	const {
		name,
		username,
		bcode,
		address1,
		state,
		zip,
		country,
		ccode,
		email,
		working_from,
		working_to,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantBranch.findOneAndUpdate(
		{
			username: jwtusername,
			status: 1,
		},
		{
			name: name,
			username: username,
			address1: address1,
			state: state,
			zip: zip,
			ccode: ccode,
			bcode: bcode,
			country: country,
			email: email,
			working_from: working_from,
			working_to: working_to,
		},
		{
			new: true,
		},
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				res.status(200).json({
					status: 1,
					data: branch,
				});
			}
		}
	);
});

router.get("/merchantBranch/todaysStatus", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	MerchantBranch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
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
				console.log(err);
				res.status(200).json({
					status: 0,
					message: "Merchant branch is not valid",
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
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
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

router.post("/merchantBranch/editCashier", jwtTokenAuth, (req, res) => {
	const {
		cashier_id,
		name,
		working_from,
		working_to,
		per_trans_amt,
		max_trans_amt,
		max_trans_count,
	} = req.body;
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
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				MerchantCashier.findOneAndUpdate(
					{ _id: cashier_id, branch_id: branch._id },
					{
						name: name,
						working_from: working_from,
						working_to: working_to,
						per_trans_amt: per_trans_amt,
						max_trans_amt: max_trans_amt,
						max_trans_count: max_trans_count,
					},
					(err, cashier) => {
						if (err) {
							res.status(200).json({
								status: 0,
								message: "Internal server error",
								err: err,
							});
						} else if (cashier == null) {
							res.status(200).json({
								status: 0,
								message: "Cashier not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								message: "Edited merchant cashier successfully",
							});
						}
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
				MerchantCashier.find({ branch_id: branch._id }, (err, cashiers) => {
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
				MerchantStaff.find({ branch_id: branch._id }, (err, staffs) => {
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
				MerchantStaff.findOne(
					{ _id: staff_id, status: 1, branch_id: branch._id },
					(err, staff) => {
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
								message: "Staff not found",
							});
						} else {
							MerchantCashier.findOneAndUpdate(
								{ _id: cashier_id, branch_id: branch._id },
								{ staff_id: staff_id },
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
								}
							);
						}
					}
				);
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
					{ _id: cashier_id, branch_id: branch._id },
					{
						$set: {
							status: 0,
						},
					},
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
							res.status(200).json({
								status: 1,
								data: "Cashier not found",
							});
						} else {
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
					{ _id: cashier_id, branch_id: branch._id },
					{
						$set: {
							status: 1,
						},
					},
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
							res.status(200).json({
								status: 1,
								data: "Cashier not found",
							});
						} else {
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
