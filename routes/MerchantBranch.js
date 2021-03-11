const express = require("express");
const router = express.Router();

const jwtTokenAuth = require("./JWTTokenAuth");
const { errorMessage, catchError } = require("./utils/errorHandler");

//models
const MerchantBranch = require("../models/merchant/MerchantBranch");
const MerchantSettings = require("../models/merchant/MerchantSettings");
const MerchantStaff = require("../models/merchant/Staff");
const MerchantPosition = require("../models/merchant/Position");
const Invoice = require("../models/merchant/Invoice");

router.post("/merchantBranch/cashierStats",jwtTokenAuth,function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { cashier_id } = req.body;
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
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
				MerchantPosition.findById(
					cashier_id,
					async function (err, position) {
						let result = errorMessage(err, position, "Position is not valid");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							try {
								let status = await Invoice.aggregate([
										{
											$match: {
												payer_id: position._id.toString(),
												paid_by: "MC",
												paid: 1,
												date_paid: {
													$gte: new Date(
														start
													),
													$lte: new Date(
														end
													),
												},
											},
										},
										{
											$group: {
												_id: null,
												amount_collected: { $sum: "$amount" },
												penalty_collected: { $sum: "$penalty" },
												bills_paid: { $sum: 1 },
											},
										},
								]);
								if (status.length > 0) {
										res.status(200).json({
											status: 1,
											message: "Today's Status",
											bills_paid: status[0].bills_paid,
											amount_collected: status[0].amount_collected,
											penalty_collected: status[0].penalty_collected,
											cash_in_hand: position.cash_in_hand,
											opening_balance: position.opening_balance,
											opening_time: position.opening_time,
											closing_time: position.closing_time,
											discrepancy: position.discrepancy,
											closing_balance: position.closing_balance,
										});
								} else {
										res.status(200).json({
											status: 1,
											message: "Today's Status",
											bills_paid: 0,
											amount_collected: 0,
											penalty_collected: 0,
											cash_in_hand: position.cash_in_hand,
											opening_balance: position.opening_balance,
											opening_time: position.opening_time,
											closing_time: position.closing_time,
											discrepancy: position.discrepancy,
											closing_balance: position.closing_balance,
										});
								}
							} catch (err) {
								res.status(200).json(catchError(err));
							}
						}
					}
				);
			}
		}
		);
});

router.post("/merchantBranch/staffStats",jwtTokenAuth,function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { staff_id } = req.body;
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
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
				MerchantPosition.findById(
					staff_id,
					async function (err, position) {
						let result = errorMessage(err, position, "Position is not valid");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							try {
								let bills_created = await Invoice.countDocuments({
									creator_id: position._id,
									is_validated: 1,
									created_at : {
										$gte: start, 
										$lt: end
									},
									iis_created:1,
								});
								let bills_uploaded = await Invoice.countDocuments({
									creator_id: position._id,
									is_validated: 1,
									created_at : {
										$gte: start, 
										$lt: end
									},
									iis_created:0,
								});
								let bills_paid = await Invoice.countDocuments({
									creator_id: position._id,
									paid: 1,
									created_at : {
										$gte: start, 
										$lt: end
									},
								});
								let counter_invoices = await Invoice.countDocuments({
									creator_id: position._id,
									is_counter: true,
									created_at : {
										$gte: start, 
										$lt: end
									},
								});
								res.status(200).json({
									status: 1,
									message: "Today's Status",
									bills_paid: bills_paid,
									bills_created: bills_created,
									bills_uploaded: bills_uploaded,
									counter_invoices: counter_invoices,
									opening_time: position.opening_time,
									closing_time: position.closing_time,
								});
							} catch (err) {
								res.status(200).json(catchError(err));
							}
						}
					}
				);
			}
		}
		);
});

router.post("/merchantBranch/listInvoicesByDate", jwtTokenAuth, (req, res) => {
	const { date } = req.body;
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
				Invoice.find(
					{ branch_id: branch._id, bill_date: date },
					(err, invoices) => {
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
								invoices: invoices,
							});
						}
					}
				);
				
			}
		}
	);
});

router.post("/merchantBranch/listInvoicesByPeriod", jwtTokenAuth, (req, res) => {
	const { start_date, end_date } = req.body;
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
				Invoice.find(
					{ 	branch_id: branch._id,
						"bill_period.start_date":  {
							$gte: start_date
						},
						"bill_period.end_date": {
							$lte: end_date
						},
					},
					(err, invoices) => {
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
								invoices: invoices,
							});
						}
					}
				);
				
			}
		}
	);
});

router.post("/merchantBranch/listInvoicesByDateRange", jwtTokenAuth, (req, res) => {
	const { start_date, end_date } = req.body;
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
				Invoice.find(
					{ 	branch_id: branch._id,
						created_at: {
							$gte: start_date,
							$lte: end_date,
						},
					},
					(err, invoices) => {
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
								invoices: invoices,
							});
						}
					}
				);
				
			}
		}
	);
});

router.post("/merchantBranch/getSettings", jwtTokenAuth, function (req, res) {
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
				MerchantSettings.findOne(
					{ merchant_id: branch.merchant_id },
					(err, setting) => {
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
						} else if (!setting) {
							res.status(200).json({
								status: 0,
								message: "Setting Not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								setting: setting,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchantBranch/listStaffInvoicesByDate", jwtTokenAuth, (req, res) => {
	const { date, staff_id } = req.body;
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
				Invoice.find(
					{ creator_id: staff_id, bill_date: date },
					(err, invoices) => {
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
								invoices: invoices,
							});
						}
					}
				);
				
			}
		}
	);
});

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

router.post("/merchantBranch/getDashStats", jwtTokenAuth, function (req, res) {
	const startOfDay = new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString()
	const endOfDay = new Date(new Date().setUTCHours(23, 59, 59, 999)).toISOString()

	const jwtusername = req.sign_creds.username;
	MerchantBranch.findOne(
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
				MerchantPosition.aggregate(
					[
						{ $match :
							{
								branch_id: String(user._id),
								type: 'cashier'
							}
						}, 
						{
							$group: {
								_id: null,
								total: {
									$sum: "$cash_in_hand",
								},
								openingBalance: {
									$sum: "$opening_balance",
								},
							},
						},
					],
					async (err, post5) => {
						let result = errorMessage(
							err,
							post5,
							"Error."
						);
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							Invoice.aggregate(
								[
									{ $match :
										{
											branch_id: String(user._id),
											paid: 1,
											date_paid : {
												$gte: startOfDay, 
												$lt: endOfDay
											},
										}
									}, 
									{
										$group: {
											_id: null,
											totalPenalty: {
												$sum: "$penalty",
											},
											totalAmount: {
												$sum: "$amount",
											},
										},
									},

								],
								async (err, post6) => {
									let result = errorMessage(
										err,
										post6,
										"Error."
									);
									if (result.status == 0) {
										res.status(200).json(result);
									} else {
										let cin = 0;
										let ob = 0;
										let pc = 0;
										let ta = 0;
										if (
											post5 != undefined &&
											post5 != null &&
											post5.length > 0
										) {
											cin = post5[0].total;
											ob = post5[0].openingBalance;
										}
										if (
											post6 != undefined &&
											post6 != null &&
											post6.length > 0
										) {
											pc = post6[0].totalPenalty;
											ta = post6[0].totalAmount;
										}
										var totalStaff = await MerchantPosition.countDocuments({branch_id: user._id, type: 'staff'});
										var totalCashier = await MerchantPosition.countDocuments({ branch_id: user._id, type: 'cashier'});
										var totalInvoice = await Invoice.countDocuments(
											{
												branch_id: user._id,
												created_at: {
													$gte: startOfDay, 
													$lt: endOfDay
												},
											});
										var totalInvoicePaid = await Invoice.countDocuments(
											{
												branch_id: user._id,
												created_at: {
													$gte: startOfDay, 
													$lt: endOfDay
												},
												paid:1,
											});
										res.status(200).json({
											status: 1,
											cash_in_hand: cin,
											opening_balance: ob,
											total_cashier: totalCashier,
											total_staff: totalStaff,
											penalty_collected: pc,
											amount_collected: ta,
											invoice_raised: totalInvoice,
											invoice_paid: totalInvoicePaid
										});
									}
								}
							)

						}
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
