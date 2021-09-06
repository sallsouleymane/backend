const express = require("express");
const router = express.Router();

//services
const { getStatement, initiateTransfer } = require("../services/Blockchain.js");
const jwtTokenAuth = require("./JWTTokenAuth");
const { errorMessage, catchError } = require("./utils/errorHandler");

const Infra = require("../models/Infra");
const Bank = require("../models/Bank");
const OTP = require("../models/OTP");
const Branch = require("../models/Branch");
const BankUser = require("../models/BankUser");
const Cashier = require("../models/Cashier");
const CashierTransfer = require("../models/CashierTransfer");
const CashierPending = require("../models/CashierPending");
const CashierLedger = require("../models/CashierLedger");
const BranchSend = require("../models/BranchSend");
const BranchClaim = require("../models/BranchClaim");
const BranchLedger = require("../models/BranchLedger");
const Invoice = require("../models/merchant/Invoice");

//controllers
const cancelTransCntrl = require("../controllers/branch/cancelTransaction");

router.post(
	"/branch/approveCancelTxReq",
	jwtTokenAuth,
	cancelTransCntrl.approveCancelRequest
);

router.post(
	"/branch/rejectCancelTxReq",
	jwtTokenAuth,
	cancelTransCntrl.rejectCancelRequest
);

/**
 * @swagger
 * /branch/cashierStats:
 *  post:
 *    description: Use to get cashier dashboard stats by branch
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/branch/cashierStats",jwtTokenAuth,function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { cashier_id } = req.body;
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	Branch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, branch) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else{
				let status = await Invoice.aggregate([
					{
						$match: {
							payer_id: cashier_id,
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
						stats: status,						
					});
				} else{
					res.status(200).json({
						stats: {},						
					});
				}
								
			}
		}
	);	
});

/**
 * @swagger
 * /branch/getBranchDashStats:
 *  post:
 *    description: Use to get branch dashboard stats by branch
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/branch/getBranchDashStats", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	const { branch_id } = req.body;
	Branch.findOne(
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
			}else{
				Cashier.countDocuments(
					{
						branch_id: branch_id,
					},
					(err1, count) => {
						if (count == null || !count) {
							count = 0;
						}
						Cashier.aggregate(
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
							async (err2, aggregate) => {
								Invoice.aggregate(
									[{ 
										$match : {
											payer_branch_id: branch_id,
											paid:1,
											date_paid: {
												$gte: new Date(
													start
												),
												$lte: new Date(
													end
												),
											},
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
									async (err3, invoices) => {
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
			
		}
	);
});


/**
 * @swagger
 * /getBranchDashStats:
 *  post:
 *    description: Use to get branch dashboard 
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/getBranchDashStats", jwtTokenAuth, function (req, res) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";

	const jwtusername = req.sign_creds.username;
	Branch.findOne(
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
				console.log({ $gte: new Date(start), $lte: new Date(end) });
				BranchLedger.findOne(
					{
						created_at: { $gte: new Date(start), $lte: new Date(end) },
						branch_id: user._id,
						trans_type: "CR",
					},
					(e, post2) => {
						let received = 0;
						if (post2 !== null) {
							received = Number(post2.amount);
						}
						BranchLedger.findOne(
							{
								branch_id: user._id,
								trans_type: "DR",
								created_at: { $gte: new Date(start), $lte: new Date(end) },
							},
							(e11, post3) => {
								let paid = 0;
								if (post3 != null && post3 != "") {
									paid = Number(post3.amount);
									if (paid == null || paid == "") {
										paid = 0;
									}
								}
								Cashier.countDocuments(
									{
										branch_id: user._id,
									},
									(e1, post4) => {
										if (post4 == null || !post4) {
											post4 = 0;
										}

										Cashier.aggregate(
											[
												{ $match: { branch_id: String(user._id) } },
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
													},
												},
											],
											async (e2, post5) => {
												let cin = 0;
												let fg = 0;
												let cg = 0;
												let ob = 0;
												if (
													post5 != undefined &&
													post5 != null &&
													post5.length > 0
												) {
													cin = post5[0].total;
													fg = post5[0].totalFee;
													cg = post5[0].totalCommission;
													ob = post5[0].openingBalance;
												}
												var totalPendingTransfers = await CashierTransfer.countDocuments(
													{ status: 0, branch_id: user._id }
												);
												var totalAcceptedTransfers = await CashierTransfer.countDocuments(
													{ status: 1, branch_id: user._id }
												);
												var totalcancelledTransfers = await CashierTransfer.countDocuments(
													{ status: -1, branch_id: user._id }
												);

												res.status(200).json({
													status: 1,
													totalCashier: post4,
													cashPaid: paid == null ? 0 : paid,
													cashReceived: received == null ? 0 : received,
													cashInHand: cin,
													feeGenerated: fg,
													commissionGenerated: cg,
													openingBalance: ob,
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
			}
		}
	);
});

/**
 * @swagger
 * /addBranchCashier:
 *  post:
 *    description: Use to create a cashier position 
 *    responses:
 *      '200':
 *        description: A successful response
 */


router.post("/addBranchCashier", jwtTokenAuth, function (req, res) {
	let data = new Cashier();
	const {
		name,
		bcode,
		working_from,
		working_to,
		per_trans_amt,
		max_trans_amt,
		max_trans_count,
	} = req.body;

	const jwtusername = req.sign_creds.username;
	Branch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			let result = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				data.name = name;
				data.bcode = bcode;
				data.working_from = working_from;
				data.working_to = working_to;
				data.per_trans_amt = per_trans_amt;
				data.max_trans_amt = max_trans_amt;
				data.max_trans_count = max_trans_count;
				data.branch_id = bank._id;
				data.bank_id = bank.bank_id;

				data.save((err1, d) => {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message) {
							message1 = err1.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else {
						res.status(200).json({
							status: 1,
							message: "Added cashier successfully",
							data: data,
						});
					}
				});
			}
		}
	);
});

/**
 * @swagger
 * /addOpeningBalance:
 *  post:
 *    description: Use to add opening balance
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/addOpeningBalance", jwtTokenAuth, function (req, res) {
	const {
		cashier_id,
		denom10,
		denom20,
		denom50,
		denom100,
		denom1000,
		denom2000,
		total,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Branch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, otpd) {
			let result = errorMessage(
				err,
				otpd,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				let data = new CashierLedger();
				data.amount = total;
				data.cashier_id = cashier_id;
				data.trans_type = "OB";
				let td = {
					denom10,
					denom20,
					denom50,
					denom100,
					denom1000,
					denom2000,
				};
				data.transaction_details = JSON.stringify(td);

				data.save((err1) => {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message) {
							message1 = err1.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else {
						Cashier.findByIdAndUpdate(
							cashier_id,
							{
								opening_balance: total,
								cash_in_hand: total,
							},
							(err2, d) => {
								res.status(200).json({
									status: 1,
									message: "Added successfully",
								});
							}
						);
					}
				});
			}
		}
	);
});

router.post("/getBranch", jwtTokenAuth, function (req, res) {
	res.status(200).json({
		status: 0,
		message: "This API is removed",
		Replace: "/getOne api",
	});
});

/**
 * @swagger
 * /getBranchInfo":
 *  post:
 *    description: Use to get branch info
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/getBranchInfo", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Branch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		"-password",
		function (err, branch) {
			let result = errorMessage(
				err,
				branch,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				BankUser.find(
					{
						branch_id: branch._id,
					},
					"-password",
					function (err2, users) {
						res.status(200).json({
							status: 1,
							branches: branch,
							bankUsers: users,
						});
					}
				);
			}
		}
	);
});


/**
 * @swagger
 * /branchSetupUpdate":
 *  post:
 *    description: Use to setup branch creentials
 *    responses:
 *      '200':
 *        description: A successful response
 */


router.post("/branchSetupUpdate", jwtTokenAuth, function (req, res) {
	const { password } = req.body;
	const jwtusername = req.sign_creds.username;
	Branch.findOne(
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
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Branch.findByIdAndUpdate(
					bank._id,
					{
						password: password,
						initial_setup: true,
					},
					(err1) => {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
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

router.post("/checkBranchFee", jwtTokenAuth, function (req, res) {
	const { amount } = req.body;

	const jwtusername = req.sign_creds.username;
	Branch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, f2) {
			let result = errorMessage(
				err,
				f2,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.findOne(
					{
						_id: f2.bank_id,
					},
					function (err1, f3) {
						let result1 = errorMessage(err1, f3, "Bank not Found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							var oamount = Number(amount);

							const find = {
								bank_id: f3._id,
								trans_type: "Non Wallet to Non Wallet",
								status: 1,
								active: "Active",
							};
							console.log(find);
							Fee.findOne(find, function (err2, fe) {
								let result2 = errorMessage(
									err2,
									fe,
									"Transaction cannot be done at this time"
								);
								if (result.status == 0) {
									res.status(200).json(result2);
								} else {
									let fee = 0;

									fe.ranges.map((range) => {
										if (
											oamount >= range.trans_from &&
											oamount <= range.trans_to
										) {
											let temp = (oamount * range.percentage) / 100;
											fee = temp + range.fixed;
										}

										res.status(200).json({
											status: 1,
											fee: fee,
										});
									});
								}
							});
						}
					}
				);
			}
		}
	);
});

router.post("/updateCashierTransferStatus", jwtTokenAuth, function (req, res) {
	const { transfer_id, cashier_id, status } = req.body;

	const jwtusername = req.sign_creds.username;
	Branch.findOne(
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
				CashierPending.findByIdAndUpdate(
					transfer_id,
					{ status: status },
					function (err1, d) {
						let result1 = errorMessage(err1, d, "History not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							Cashier.findByIdAndUpdate(
								cashier_id,
								{ $inc: { pending_trans: -1 } },
								function (err2, cashier) {
									let result2 = errorMessage(err2, cashier, "Cashier not found");
									if (result2.status == 0) {
										res.status(200).json(result2);
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

/**
 * @swagger
 * /branch/updateCashierUser":
 *  post:
 *    description: Use to update the cashier user
 *    responses:
 *      '200':
 *        description: A successful response
 */


router.post(
	"/branch/updateCashierUser",
	jwtTokenAuth,
	function (req, res) {
		const { cashier_id, user_id } = req.body;
		const jwtusername = req.sign_creds.username;
		Branch.findOne(
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
					Cashier.countDocuments(
						{ bank_user_id: user_id },
						function (err1, count) {
							if (count > 0) {
								res.status(200).json({
									status: 0,
									message:
										"User is already assigned to this or another cashier",
								});
							} else {
								Cashier.findByIdAndUpdate(
									cashier_id,
									{ bank_user_id: user_id },
									function (err2, cashier) {
										if (err2) {
											console.log(err2);
											var message2 = err2;
											if (err2.message) {
												message2 = err2.message;
											}
											res.status(200).json({
												status: 0,
												message: message2,
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

/**
 * @swagger
 * /branch/disassignUser":
 *  post:
 *    description: Use to disassign a user from a cashier position
 *    responses:
 *      '200':
 *        description: A successful response
 */


router.post("/branch/disassignUser", jwtTokenAuth, (req, res) => {
	const { cashier_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Branch.findOne(
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
				Cashier.findByIdAndUpdate(
					cashier_id,
					{ bank_user_id: null },
					function (err1, cashier) {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
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
});


/**
 * @swagger
 * /branch/getCashierDetails":
 *  post:
 *    description: Use to get cashier details
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/branch/getCashierDetails", jwtTokenAuth, function (req, res) {
	const { cashier_id } = req.body;

	const jwtusername = req.sign_creds.username;
	Branch.findOne(
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
				Cashier.findById(
					cashier_id,
					async(err1, cashier) => {
						let result1 = errorMessage(err1, cashier, "Cashier not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
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


router.post("/getCashierDetails", jwtTokenAuth, function (req, res) {
	const { cashier_id } = req.body;

	const jwtusername = req.sign_creds.username;
	Branch.findOne(
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
				Cashier.findById(cashier_id, async (err1, cashier) => {
					let result1 = errorMessage(err1, cashier, "Cashier not found");
					if (result1.status == 0) {
						res.status(200).json(result1);
					} else {
						var totalPendingTransfers = await CashierTransfer.countDocuments({
							status: 0,
							cashier_id: cashier_id,
						});
						var totalAcceptedTransfers = await CashierTransfer.countDocuments({
							status: 1,
							cashier_id: cashier_id,
						});
						var totalcancelledTransfers = await CashierTransfer.countDocuments({
							status: -1,
							cashier_id: cashier_id,
						});
						res.status(200).json({
							status: 1,
							cashier: cashier,
							pending: totalPendingTransfers,
							accepted: totalAcceptedTransfers,
							cancelled: totalcancelledTransfers,
						});
					}
				});
			}
		}
	);
});

router.post("/branchVerifyClaim", jwtTokenAuth, function (req, res) {
	const { otpId, otp } = req.body;

	const jwtusername = req.sign_creds.username;
	Branch.findOne(
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
				OTP.findOne(
					{
						_id: otpId,
						otp: otp,
					},
					function (err1, otpd) {
						let result1 = errorMessage(err1, otpd, "OTP Missmatch");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								status: 1,
								message: "Claim verified",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/branchClaimMoney", jwtTokenAuth, function (req, res) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";

	const {
		transferCode,
		proof,
		givenname,
		familyname,
		receiverGivenName,
		receiverFamilyName,
	} = req.body;

	const jwtusername = req.sign_creds.username;
	Branch.findOne(
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
				BranchSend.findOne(
					{
						transaction_code: transferCode,
					},
					function (err1, otpd) {
						let result1 = errorMessage(err1, otpd, "Transaction Not Found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							Branch.findOne(
								{
									_id: f._id,
								},
								function (err2, f2) {
									let result2 = errorMessage(err2, f2, "Branch Not Found");
									if (result2.status == 0) {
										res.status(200).json(result2);
									} else {
										Bank.findOne(
											{
												_id: f.bank_id,
											},
											function (err3, f3) {
												let result3 = errorMessage(err3, f3, "Bank Not Found");
												if (result3.status == 0) {
													res.status(200).json(result3);
												} else {
													Infra.findOne(
														{
															_id: f3.user_id,
														},
														function (err4, f4) {
															let result4 = errorMessage(
																err4,
																f4,
																"Infra Not Found"
															);
															if (result4.status == 0) {
																res.status(200).json(result4);
															} else {
																let data = new BranchClaim();
																data.transaction_code = transferCode;
																data.proof = proof;
																data.branch_id = f._id;
																data.amount = otpd.amount;
																data.fee = otpd.fee;
																data.sender_name = givenname + " " + familyname;
																data.receiver_name =
																	receiverGivenName + " " + receiverFamilyName;
																var mns = f3.mobile.slice(-2);
																var mnr = f2.mobile.slice(-2);
																var now = new Date().getTime();
																var child_code = mns + "" + mnr + "" + now;
																var master_code = otpd.master_code;
																data.master_code = master_code;
																data.child_code = child_code;

																const oamount = otpd.amount;
																data.save((err5, d) => {
																	if (err5) {
																		console.log(err5);
																		var message5 = err5;
																		if (err5.message) {
																			message5 = err5.message;
																		}
																		res.status(200).json({
																			status: 0,
																			message: message5,
																		});
																	} else {
																		let trans1 = {};
																		trans1.from = f3.wallet_ids.escrow;
																		trans1.to = f2.wallet_ids.operational;
																		trans1.amount = oamount;
																		trans1.note = "Branch claim Money";
																		trans1.email1 = f3.email;
																		trans1.email2 = f2.email;
																		trans1.mobile1 = f3.mobile;
																		trans1.mobile2 = f2.mobile;
																		trans1.from_name = f3.name;
																		trans1.to_name = f2.name;
																		trans1.user_id = "";
																		trans1.master_code = master_code;
																		trans1.child_code = child_code;
																		initiateTransfer(trans1)
																			.then(function (result15) {
																				if (result15.length <= 0) {
																					BranchClaim.findByIdAndUpdate(
																						d._id,
																						{
																							status: 1,
																						},
																						(err6) => {
																							if (err6) {
																								console.log(err6);
																								var message6 = err6;
																								if (err6.message) {
																									message6 = err6.message;
																								}
																								res.status(200).json({
																									status: 0,
																									message: message6,
																								});
																							} else {
																								BranchLedger.findOne(
																									{
																										branch_id: f._id,
																										trans_type: "DR",
																										created_at: {
																											$gte: new Date(start),
																											$lte: new Date(end),
																										},
																									},
																									function (err7, c) {
																										if (err7) {
																											console.log(err7);
																											var message7 = err7;
																											if (err7.message) {
																												message7 = err7.message;
																											}
																											res.status(200).json({
																												status: 0,
																												message: message7,
																											});
																										} else if (c == null) {
																											let data1 = new BranchLedger();
																											data1.amount = Number(
																												oamount
																											);
																											data1.trans_type = "DR";
																											data1.branch_id = f._id;
																											data1.save(function (
																												err67,
																												c67
																											) {});
																										} else {
																											var amt =
																												Number(c.amount) +
																												Number(oamount);
																											BranchLedger.findByIdAndUpdate(
																												c._id,
																												{ amount: amt },
																												function (err8, c8) {}
																											);
																										}
																									}
																								);

																								res.status(200).json({
																									status: 1,
																									message: "Money claimed",
																								});
																							}
																						}
																					);
																				} else {
																					res.status(200).json({
																						status: 0,
																						message: result.toString(),
																					});
																				}
																			})
																			.catch((error) => {
																				console.log(error);
																				res.status(200).json({
																					status: 0,
																					message: error.message,
																				});
																			});
																	}
																}); //save
															} //infra
														}
													);
												}
											}
										);
									}
								}
							); //branch
						}
					}
				);
			}
		}
	);
});

router.post("/branchVerifyOTPClaim", jwtTokenAuth, function (req, res) {
	const { transferCode, otp } = req.body;

	const jwtusername = req.sign_creds.username;
	Branch.findOne(
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
				BranchSend.findOne(
					{
						transaction_code: transferCode,
						otp: otp,
					},
					function (err1, otpd) {
						let result1 = errorMessage(err1, otpd, "OTP Missmatch");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								status: 1,
								message: "Claim otp verified",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/getBranchClaimMoney", jwtTokenAuth, function (req, res) {
	const { transferCode } = req.body;

	const jwtusername = req.sign_creds.username;
	Branch.findOne(
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
				BranchClaim.findOne(
					{
						transaction_code: transferCode,
						status: 1,
					},
					function (err1, cs) {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						} else if (cs == null) {
							BranchSend.findOne(
								{
									transaction_code: transferCode,
								},
								function (err2, cs2) {
									if (err2) {
										console.log(err2);
										var message2 = err2;
										if (err2.message) {
											message2 = err2.message;
										}
										res.status(200).json({
											status: 0,
											message: message2,
										});
									} else if (cs2 == null) {
										res.status(200).json({
											status: 0,
											message: "Record Not Found",
										});
									} else {
										res.status(200).json({
											status: 1,
											row: cs2,
										});
									}
								}
							);
						} else {
							res.status(200).json({
								status: 0,
								message: "This transaction was already claimed",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/getBranchHistory", jwtTokenAuth, function (req, res) {
	const { from } = req.body;

	const jwtusername = req.sign_creds.username;
	Branch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, b) {
			let result = errorMessage(
				err,
				b,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const wallet = b.wallet_ids[from];
				console.log(wallet);
				getStatement(wallet)
					.then(function (result1) {
						res.status(200).json({
							status: 1,
							history: result1,
						});
					})
					.catch((error) => {
						res.status(200).json(catchError(error));
					});
			}
		}
	);
});

module.exports = router;
