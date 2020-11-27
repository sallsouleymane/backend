const express = require("express");
const router = express.Router();

const jwtTokenAuth = require("./JWTTokenAuth");
const { errorMessage, catchError } = require("./utils/errorHandler");

//models
const MerchantBranch = require("../models/merchant/MerchantBranch");
const MerchantStaff = require("../models/merchant/Staff");
const MerchantPosition = require("../models/merchant/Position");

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
			let result = errorMessage(
				err,
				branch,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
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
			let result = errorMessage(err, branch, "Merchant branch is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
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

router.post("/merchantBranch/editPosition", jwtTokenAuth, (req, res) => {
	const {
		position_id,
		name,
		working_from,
		working_to,
		counter_invoice_access,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantBranch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, branch) {
			let result = errorMessage(
				err,
				branch,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantPosition.findOneAndUpdate(
					{ _id: position_id, branch_id: branch._id },
					{
						name: name,
						working_from: working_from,
						working_to: working_to,
						counter_invoice_access: counter_invoice_access,
					},
					(err, position) => {
						let result = errorMessage(err, position, "position not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							res.status(200).json({
								status: 1,
								message: "Edited merchant Position successfully",
							});
						}
					}
				);
			}
		}
	);
});

router.get("/merchantBranch/listPosition", jwtTokenAuth, (req, res) => {
	const jwtusername = req.sign_creds.username;
	MerchantBranch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, branch) {
			let result = errorMessage(err, branch, "Branch is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantPosition.find({ branch_id: branch._id }, (err, positions) => {
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
							message: "ositions list",
							positions: positions,
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
			let result = errorMessage(err, branch, "Branch is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
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
	const { position_id, staff_id } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantBranch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, branch) {
			let result = errorMessage(err, branch, "Branch is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				console.log(branch._id);
				MerchantStaff.findOne(
					{ _id: staff_id, status: 1, branch_id: branch._id },
					(err, staff) => {
						let result = errorMessage(err, staff, "Staff not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							MerchantPosition.findOneAndUpdate(
								{ _id: position_id, branch_id: branch._id, type: staff.role },
								{ staff_id: staff_id, username: staff.username },
								(err, position) => {
									let result = errorMessage(
										err,
										position,
										"Position not found or role does not match"
									);
									if (result.status == 0) {
										res.status(200).json(result);
									} else {
										res.status(200).json({
											status: 1,
											message: "Assigned staff a position",
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

router.post("/merchantBranch/blockPosition", jwtTokenAuth, (req, res) => {
	const { position_id } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantBranch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, branch) {
			let result = errorMessage(err, branch, "Branch is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantPosition.findOneAndUpdate(
					{ _id: position_id, branch_id: branch._id },
					{
						$set: {
							status: 0,
						},
					},
					(err, position) => {
						let result = errorMessage(err, position, "position not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							res.status(200).json({
								status: 1,
								data: "blocked position",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchantBranch/unblockPosition", jwtTokenAuth, (req, res) => {
	const { position_id } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantBranch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, branch) {
			let result = errorMessage(err, branch, "Branch is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantPosition.findOneAndUpdate(
					{ _id: position_id, branch_id: branch._id },
					{
						$set: {
							status: 1,
						},
					},
					(err, position) => {
						let result = errorMessage(err, position, "Position not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							res.status(200).json({
								status: 1,
								message: "Unblocked position",
							});
						}
					}
				);
			}
		}
	);
});

module.exports = router;
