const express = require("express");
const router = express.Router();

const config = require("../../config.json");
const jwtTokenAuth = require("../JWTTokenAuth");

//utils
const { errorMessage, catchError } = require("../utils/errorHandler");
const blockchain = require("../../services/Blockchain");

//models
const Partner = require("../../models/partner/Partner");
const PartnerBranch = require("../../models/partner/Branch");
const PartnerCashier = require("../../models/partner/Cashier");
const CashierTransfer = require("../../models/CashierTransfer");
const CashierPending = require("../../models/CashierPending");
const Invoice = require("../../models/merchant/Invoice");
const PartnerUser = require("../../models/partner/User");

router.post("/partnerBranch/getCashierDetails", jwtTokenAuth, function (req, res) {
	const { cashier_id } = req.body;

	const jwtusername = req.sign_creds.username;
	PartnerBranch.findOne(
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
				PartnerCashier.findById(
					cashier_id,
					async(err, cashier) => {
						let result = errorMessage(err, cashier, "Cashier not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							var totalPendingTransfers = await CashierTransfer.countDocuments({status: 0, cashier_id: cashier_id});
							var totalAcceptedTransfers = await CashierTransfer.countDocuments({status: 1, cashier_id: cashier_id});
							var totalcancelledTransfers = await CashierTransfer.countDocuments({status: -1, cashier_id: cashier_id});
							res.status(200).json({
								status: 1,
								cashier: cashier,
								pending: totalPendingTransfers,
								accepted: totalAcceptedTransfers,
								cancelled: totalcancelledTransfers
							});
						}
					}
				);
			}
		}
	);
});

router.post("/partnerBranch/SetupUpdate", jwtTokenAuth, function (req, res) {
	const { password } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerBranch.findOne(
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
			} else if (!branch) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				PartnerBranch.findByIdAndUpdate(
					branch._id,
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

router.post("/partnerBranch/updateCashierTransferStatus", jwtTokenAuth, function (req, res) {
	const { transfer_id, cashier_id, status } = req.body;

	const jwtusername = req.sign_creds.username;
	PartnerBranch.findOne(
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
			} else if (!branch) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				CashierPending.findByIdAndUpdate(
					transfer_id,
					{ status: status },
					function (err, d) {
						let result = errorMessage(err, d, "History not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							PartnerCashier.findByIdAndUpdate(
								cashier_id,
								{ $inc: {pending_trans: -1}},
								function (err, cashier) {
									let result = errorMessage(err, cashier, "Cashier not found");
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
					}
				);
			}
		}
	);
});

router.post(
	"/partnerBranch/getHistoryTotal",
	jwtTokenAuth,
	function (req, res) {
		const { from } = req.body;
		const jwtusername = req.sign_creds.username;
		PartnerBranch.findOne(
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
					const wallet = branch.wallet_ids[from];
					blockchain
						.getTransactionCount(wallet)
						.then(function (count) {
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
									count: count,
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
		);
	}
);

router.post("/partnerBranch/getHistory", jwtTokenAuth, function (req, res) {
	const { from } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerBranch.findOne(
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
				const wallet = branch.wallet_ids[from];
				blockchain
					.getStatement(wallet)
					.then(function (history) {
						res.status(200).json({
							status: 1,
							history: history,
						});
					})
					.catch((err) => {
						res.status(200).json(catchError(err));
					});
			}
		}
	);
});

router.post("/partnerBranch/editCashier", jwtTokenAuth, (req, res) => {
	const {
		cashier_id,
		name,
		code,
		working_from,
		working_to,
		per_trans_amt,
		max_trans_amt,
		max_trans_count,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerBranch.findOne(
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
				PartnerCashier.findByIdAndUpdate(
					cashier_id,
					{
						name: name,
						working_from: working_from,
						working_to: working_to,
						per_trans_amt: per_trans_amt,
						code: code,
						max_trans_count: max_trans_count,
						max_trans_amt: max_trans_amt,
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
							return res.status(200).json({
								status: 1,
								message: "Partner Cashier edited successfully",
							});
						}
					}
				);
			}
		}
	);
});

router.post(
	"/partnerBranch/updateCashierUser",
	jwtTokenAuth,
	function (req, res) {
		const { cashier_id, user_id } = req.body;
		const jwtusername = req.sign_creds.username;
		PartnerBranch.findOne(
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
					PartnerCashier.countDocuments(
						{ partner_user_id: user_id },
						function (err, count) {
							if (count > 0) {
								res.status(200).json({
									status: 0,
									message:
										"User is already assigned to this or another cashier",
								});
							} else {
								PartnerCashier.findByIdAndUpdate(
									cashier_id,
									{ partner_user_id: user_id },
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
										} else {
											res.status(200).json({
												status: 1,
												row: cashier,
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
);

router.post(
	"/partnerBranch/getDetailsByName",
	jwtTokenAuth,
	function (req, res) {
		const { name } = req.body;
		const jwtusername = req.sign_creds.username;
		PartnerBranch.findOne(
			{
				username: jwtusername,
				status: 1,
				name: name,
			},
			function (err, branch) {
				let result = errorMessage(
					err,
					branch,
					"Branch not found or login session expired"
				);
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					res.status(200).json({
						status: 1,
						branch: branch,
					});
				}
			}
		);
	}
);

router.post("/partnerBranch/getBranchDashStats", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { branch_id } = req.body;
	PartnerBranch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, branch) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!branch || branch === null || branch === undefined){
				PartnerUser.findOne(
					{
						username: jwtusername,
						role: "branchAdmin",
					},
					function (err, admin) {
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
						}else if (!admin || admin===null || admin === undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Partner.findOne({ _id: admin.partner_id }, (err, adminpartner) => {
								var result = errorMessage(err, adminpartner, "Partner is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
								}
							});
						}	
					}
				);
			}
			

				PartnerCashier.countDocuments(
					{
						branch_id: branch_id,
					},
					(err, count) => {
						if (count == null || !count) {
							count = 0;
						}
						PartnerCashier.aggregate(
							[
								{ $match : {branch_id: branch_id}},
								{
									$group: {
										_id: null,
										total: {
											$sum: "$cash_in_hand",
										},
										totalFee: {
											$sum: "$fee_generated",
										},
										totalCommission: {
											$sum: "$commission_generated",
										},
										openingBalance: {
											$sum: "$opening_balance",
										},
										closingBalance: {
											$sum: "$closing_balance",
										},
										cashReceived: {
											$sum: "$cash_received",
										},
										cashPaid: {
											$sum: "$cash_paid",
										}
									},
								},
							],
							async (err, aggregate) => {
								Invoice.aggregate(
									[{ 
										$match : {
											payer_branch_id: branch_id,
											paid:1,
										}
									},
										{
											$group: {
												_id: null,
												totalAmountPaid: {
													$sum: "$amount",
												},
												bills_paid: { $sum: 1 },
											},
										},
									],
									async (err, invoices) => {
										let amountpaid = 0;
										let billpaid = 0;
										let cin = 0;
										let fg = 0;
										let cg = 0;
										let ob = 0;
										let cr = 0;
										let cp = 0;
										let cb = 0;
										if (
											aggregate != undefined &&
											aggregate != null &&
											aggregate.length > 0
										) {
											cin = aggregate[0].total;
											fg = aggregate[0].totalFee;
											cg = aggregate[0].totalCommission;
											ob = aggregate[0].openingBalance;
											cr = aggregate[0].cashReceived;
											cp = aggregate[0].cashPaid;
											cb = aggregate[0].closingBalance;
										}
										if (
											invoices != undefined &&
											invoices != null &&
											invoices.length > 0
										) {
											amountpaid = invoices[0].totalAmountPaid;
											billpaid = invoices[0].bills_paid;
										}
										var totalPendingTransfers = await CashierTransfer.countDocuments({status: 0, branch_id: branch_id});
										var totalAcceptedTransfers = await CashierTransfer.countDocuments({status: 1, branch_id: branch_id});
										var totalcancelledTransfers = await CashierTransfer.countDocuments({status: -1, branch_id: branch_id});
										res.status(200).json({
											status: 1,
											invoicePaid: billpaid,
											amountPaid: amountpaid,
											totalCashier: count,
											cashInHand: cin,
											feeGenerated : fg,
										 	cashReceived: cr,
											cashPaid: cp,
											commissionGenerated: cg,
											openingBalance: ob,
											closingBalance: cb,
											cancelled: totalcancelledTransfers,
											pending: totalPendingTransfers,
											accepted: totalAcceptedTransfers,
										});
									}
								);
							}
						);
					}
				);
			
		}
	);
});

module.exports = router;
