const express = require("express");
const router = express.Router();

const config = require("../../config.json");
const jwtTokenAuth = require("../JWTTokenAuth");

//utils
const sendSMS = require("../utils/sendSMS");
const sendMail = require("../utils/sendMail");
const makeid = require("../utils/idGenerator");
const { errorMessage, catchError } = require("../utils/errorHandler");
const blockchain = require("../../services/Blockchain");

//models
const Bank = require("../../models/Bank");
const Partner = require("../../models/partner/Partner");
const CashierTransfer = require("../../models/CashierTransfer");
const PartnerBranch = require("../../models/partner/Branch");
const PartnerCashier = require("../../models/partner/Cashier");
const PartnerUser = require("../../models/partner/User");
const Invoice = require("../../models/merchant/Invoice");
const getWalletIds = require("../utils/getWalletIds");
const DailyReport = require("../../models/cashier/DailyReport");

router.post("/partner/getBranchDashStats", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { branch_id } = req.body;
	Partner.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, partner) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!partner || partner === null || partner === undefined){
				PartnerUser.findOne(
					{
						username: jwtusername,
						role: "partnerAdmin",
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

router.post("/partner/getBranchDailyReport", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { branch_id, start, end} = req.body;
	Partner.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, partner) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!partner || partner === null || partner === undefined){
				PartnerUser.findOne(
					{
						username: jwtusername,
						role: "partnerAdmin",
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
		
				DailyReport.aggregate(
					[{ 
						$match : {
							branch_id: branch_id,
							created_at: {
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
								opening_balance: {
									$sum: "$opening_balance",
								},
								cash_in_hand: {
									$sum: "$cash_in_hand",
								},
								cash_paid: {
									$sum: "$paid_in_cash",
								},
								cash_received: {
									$sum: "$cash_received",
								},
								fee_generated: {
									$sum: "$fee_generated",
								},
								comm_generated: {
									$sum: "$comm_generated",
								},
								closing_balance: {
									$sum: "$closing_balance",
								},
								discripancy: {
									$sum: "$descripency",
								}
								
							},
						},
					],
					async(err, reports) => {
						if (err) {
							res.status(200).json(catchError(err));
						} else {
							Invoice.aggregate(
								[{ 
									$match : {
										payer_branch_id: branch_id,
										date_paid: {
											$gte: new Date(
												start
											),
											$lte: new Date(
												end
											),
										},
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
									if (err) {
										res.status(200).json(catchError(err));
									} else {
										let amountpaid = 0;
										let billpaid = 0;
										if (
											invoices != undefined &&
											invoices != null &&
											invoices.length > 0
										) {
											amountpaid = invoices[0].totalAmountPaid;
											billpaid = invoices[0].bills_paid;
										}
											var totalPendingTransfers = await CashierTransfer.countDocuments(
												{ status: 0, branch_id: branch_id }
											);
											var totalAcceptedTransfers = await CashierTransfer.countDocuments(
												{ status: 1, branch_id: branch_id }
											);
											var totalcancelledTransfers = await CashierTransfer.countDocuments(
												{ status: -1, branch_id: branch_id }
											);
											

											res.status(200).json({
												status: 1,
												reports: reports,
												accepted: totalAcceptedTransfers,
												pending: totalPendingTransfers,
												decline: totalcancelledTransfers,
												invoicePaid: billpaid,
												amountPaid: amountpaid,
											});
									}
								}
							)
						}
					}
				);
			
		}
	);
});

router.post(
	"/partner/getBranchWalletBalnce",
	jwtTokenAuth,
	function (req, res) {
		const { branch_id, wallet_type } = req.body;
		const jwtusername = req.sign_creds.username;
		Partner.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err, partner) {
				let errMsg = errorMessage(
					err,
					partner,
					"Token changed or user not valid. Try to login again or contact system administrator."
				);
				if (errMsg.status == 0) {
					res.status(200).json(result);
				} else {
					PartnerBranch.findById(branch_id, (err, branch) => {
						let errMsg = errorMessage(
							err,
							branch,
							"Token changed or user not valid. Try to login again or contact system administrator."
						);
						if (errMsg.status == 0) {
							res.status(200).json(result);
						} else {
							let wallet_id = branch.wallet_ids[wallet_type];

							blockchain
								.getBalance(wallet_id)
								.then(function (result) {
									res.status(200).json({
										status: 1,
										balance: result,
									});
								})
								.catch((err) => {
									res.status(200).json(catchError(err));
								});
						}
					});
				}
			}
		);
	}
);

router.post("/partner/updateBranchStatus", jwtTokenAuth, function (req, res) {
	const { status, branch_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Partner.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, Partner) {
			let result = errorMessage(
				err,
				Partner,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				PartnerBranch.findByIdAndUpdate(
					branch_id,
					{
						status: status,
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
								message: "branch status updated",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/partner/getHistoryTotal", jwtTokenAuth, function (req, res) {
	const { from } = req.body;
	const jwtusername = req.sign_creds.username;
	Partner.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, partner) {
			let result = errorMessage(
				err,
				partner,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.findOne({ _id: partner.bank_id }, (err, bank) => {
					let result = errorMessage(
						err,
						bank,
						"Bank of the partner is not valid."
					);
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						const wallet = partner.wallet_ids[from];
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
				});
			}
		}
	);
});

router.post("/partner/getHistory", jwtTokenAuth, function (req, res) {
	const { from } = req.body;
	const jwtusername = req.sign_creds.username;
	Partner.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, partner) {
			let result = errorMessage(
				err,
				partner,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const wallet = partner.wallet_ids[from];
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

router.post("/partner/dashStats", jwtTokenAuth, function (req, res) {
	try {
		const jwtusername = req.sign_creds.username;
		Partner.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			async function (err, partner) {
				let result = errorMessage(
					err,
					partner,
					"Token changed or user not valid. Try to login again or contact system administrator."
				);
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					try {
						const user_id = partner._id;
						var branchCount = await PartnerBranch.countDocuments({
							partner_id: user_id,
						});

						var cashierCount = await PartnerCashier.countDocuments({
							partner_id: user_id,
						});
						var userCount = await PartnerUser.countDocuments({
							partner_id: user_id,
						});

						res.status(200).json({
							totalBranches: branchCount,
							totalCashiers: cashierCount,
							totalUsers: userCount,
						});
					} catch (err) {
						console.log(err);
						res.status(200).json({ status: 0, message: err.message });
					}
				}
			}
		);
	} catch (err) {
		console.log(err);
		var message = err;
		if (err.message) {
			message = err.message;
		}
		res.status(200).json({ status: 0, message: message });
	}
});

router.post("/partner/setupUpdate", jwtTokenAuth, (req, res) => {
	const { username, password } = req.body;
	const jwtusername = req.sign_creds.username;
	Partner.findOneAndUpdate(
		{
			username: jwtusername,
		},
		{
			username: username,
			password: password,
			initial_setup: true,
		},
		function (err, partner) {
			let result = errorMessage(
				err,
				partner,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
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
});

router.post("/partner/listUsers", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { partner_id } = req.body;
	Partner.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, partner) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!partner || partner === null || partner === undefined){
				PartnerUser.findOne(
					{
						username: jwtusername,
						role: "partnerAdmin",
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
				PartnerUser.find({ partner_id: partner_id }, function (err, users) {
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
							users: users,
						});
					}
				});
			
		}
	);
});

router.post("/partner/addUser", jwtTokenAuth, (req, res) => {
	let data = new PartnerUser();
	const {
		name,
		email,
		ccode,
		mobile,
		role,
		verify_user_access,
		username,
		password,
		branch_id,
		logo,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Partner.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, partner) {
			let result = errorMessage(
				err,
				partner,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				data.name = name;
				data.email = email;
				data.mobile = mobile;
				data.role = role;
				data.username = username;
				data.password = password;
				data.branch_id = branch_id;
				data.verify_user_access = verify_user_access;
				data.partner_id = partner._id;
				data.ccode = ccode;
				data.logo = logo;

				data.save((err, partner) => {
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
						let content =
							"<p>Your have been added as a Partner User in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
							config.mainIP +
							"/partner/cashier/yourBranchName'>http://" +
							config.mainIP +
							"/</a></p><p><p>Your username: " +
							username +
							"</p><p>Your password: " +
							password +
							"</p>";
						sendMail(content, "Partner User Account Created", email);
						let content2 =
							"Your have been added as Partner User in E-Wallet application Login URL: http://" +
							config.mainIP +
							"/partner/cashier/yourBranchName Your username: " +
							username +
							" Your password: " +
							password;
						sendSMS(content2, mobile);
						return res.status(200).json({
							success: 1,
							data: partner,
						});
					}
				});
			}
		}
	);
});

router.post("/partner/editUser", jwtTokenAuth, (req, res) => {
	const {
		name,
		email,
		role,
		ccode,
		mobile,
		username,
		verify_user_access,
		password,
		branch_id,
		logo,
		user_id,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Partner.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, partner) {
			let result = errorMessage(
				err,
				partner,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				PartnerUser.findOneAndUpdate(
					{
						_id: user_id,
					},
					{
						name: name,
						email: email,
						ccode: ccode,
						mobile: mobile,
						role: role,
						verify_user_access: verify_user_access,
						username: username,
						password: password,
						branch_id: branch_id,
						logo: logo,
					},
					{ new: true },
					(err, user) => {
						let result = errorMessage(err, user, "user not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							return res.status(200).json({
								success: 1,
								data: user,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/partner/listCashiers", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Partner.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, partner) {
			let result = errorMessage(
				err,
				partner,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const partner_id = partner._id;
				PartnerCashier.find(
					{ partner_id: partner_id },
					function (err, cashiers) {
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
								cashiers: cashiers,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/partner/editCashier", jwtTokenAuth, (req, res) => {
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
	Partner.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, partner) {
			let result = errorMessage(
				err,
				partner,
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
					{ new: true },
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
						} else {
							return res.status(200).json({
								status: 1,
								data: cashier,
								message: "Cashier edited successfully",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/partner/addCashier", jwtTokenAuth, (req, res) => {
	let data = new PartnerCashier();
	const {
		name,
		branch_id,
		credit_limit,
		code,
		working_from,
		working_to,
		per_trans_amt,
		max_trans_amt,
		max_trans_count,
		cashier_length,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Partner.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, partner) {
			let result = errorMessage(
				err,
				partner,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				PartnerBranch.findOne(
					{
						_id: branch_id,
					},
					function (err, branch) {
						let result = errorMessage(err, branch, "Partner Branch not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							data.name = name;
							data.code = code;
							data.credit_limit = credit_limit;
							data.working_from = working_from;
							data.working_to = working_to;
							data.per_trans_amt = per_trans_amt;
							data.max_trans_amt = max_trans_amt;
							data.max_trans_count = max_trans_count;
							data.partner_id = partner._id;
							data.branch_id = branch_id;
							data.bank_id = partner.bank_id;
							if (cashier_length == 0) {
								data.central = true;
								data.opening_balance = branch.cash_in_hand;
								data.cash_in_hand = branch.cash_in_hand;
							}
							data.save((err) => {
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
									Partner.updateOne(
										{ _id: partner._id },
										{ $inc: { total_cashiers: 1 } },
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
												PartnerBranch.updateOne(
													{ _id: branch._id },
													{ $inc: { total_cashiers: 1 } },
													function (err) {
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
															res.status(200).json({ status: 1, data: data });
														}
													}
												);
											}
										}
									);
								}
							});
						}
					}
				);
			}
		}
	);
});

router.post("/partner/listBranches", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const {partner_id} = req.body;
	Partner.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, partner) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!partner || partner === null || partner === undefined){
				PartnerUser.findOne(
					{
						username: jwtusername,
						role: "partnerAdmin",
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

				PartnerBranch.find(
					{ partner_id: partner_id },
					function (err, branches) {
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
								branches: branches,
							});
						}
					}
				);
			}
		
	);
});

router.post("/partner/getBranch", jwtTokenAuth, function (req, res) {
	const { branch_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Partner.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, partner) {
			let result = errorMessage(
				err,
				partner,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				PartnerBranch.findOne({ _id: branch_id }, function (err, branch) {
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
							branch: branch,
						});
					}
				});
			}
		}
	);
});

router.post("/partner/addBranch", jwtTokenAuth, (req, res) => {
	let data = new PartnerBranch();
	const {
		name,
		code,
		username,
		credit_limit,
		cash_in_hand,
		address,
		state,
		zip,
		country,
		ccode,
		mobile,
		email,
		working_from,
		working_to,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Partner.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, partner) {
			let result = errorMessage(
				err,
				partner,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.findOne({ _id: partner.bank_id }, (err, bank) => {
					let result = errorMessage(
						err,
						partner,
						"Token changed or user not valid. Try to login again or contact system administrator."
					);
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						const wallet_ids = getWalletIds("partnerBranch", code, bank.bcode);
						blockchain
							.createWallet([wallet_ids.operational, wallet_ids.master])
							.then(function (result) {
								if (result != "" && !result.includes("wallet already exists")) {
									console.log(result);
									res.status(200).json({
										status: 0,
										message:
											"Blockchain service was unavailable. Please try again.",
										result: result,
									});
								} else {
									data.name = name;
									data.code = code;
									if (credit_limit !== "" && credit_limit != null) {
										data.credit_limit = credit_limit;
									}
									if (cash_in_hand !== "" && cash_in_hand != null) {
										data.cash_in_hand = cash_in_hand;
									}
									data.username = username;
									data.address = address;
									data.state = state;
									data.country = country;
									data.zip = zip;
									data.ccode = ccode;
									data.mobile = mobile;
									data.email = email;
									data.partner_id = partner._id;
									data.password = makeid(10);
									data.working_from = working_from;
									data.working_to = working_to;
									data.bank_id = bank._id;
									data.wallet_ids.operational = wallet_ids.operational;
									data.wallet_ids.master = wallet_ids.master;
									let partnerName = partner.name;

									data.save((err) => {
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
											Partner.updateOne(
												{ _id: partner._id },
												{ $inc: { total_branches: 1 } },
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
														let content =
															"<p>Your branch is added in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
															config.mainIP +
															"/branch/" +
															partnerName +
															"'>http://" +
															config.mainIP +
															"/branch/" +
															partnerName +
															"</a></p><p><p>Your username: " +
															data.username +
															"</p><p>Your password: " +
															data.password +
															"</p>";
														sendMail(content, "Partner Branch Created", email);
														let content2 =
															"Your branch is added in E-Wallet application Login URL: http://" +
															config.mainIP +
															"/branch/" +
															partnerName +
															" Your username: " +
															data.username +
															" Your password: " +
															data.password;
														sendSMS(content2, mobile);
														// return res.status(200).json(data);
														res.status(200).json({
															status: 1,
															message: "Partner Branch Created",
															walletStatus: result.toString(),
														});
													}
												}
											);
										}
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
				});
			}
		}
	);
});

router.post("/partner/editBranch", jwtTokenAuth, (req, res) => {
	let data = new PartnerBranch();
	const {
		branch_id,
		name,
		code,
		username,
		credit_limit,
		address,
		state,
		zip,
		country,
		ccode,
		mobile,
		email,
		working_from,
		working_to,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Partner.findOne(
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
				PartnerBranch.findByIdAndUpdate(
					branch_id,
					{
						name: name,
						ode: code,
						credit_limit: credit_limit,
						username: username,
						address: address,
						state: state,
						zip: zip,
						ccode: ccode,
						country: country,
						mobile: mobile,
						email: email,
						working_from: working_from,
						working_to: working_to,
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
							return res.status(200).json({ status: 1, data: data });
						}
					}
				);
			}
		}
	);
});

router.post("/partner/activate", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Partner.findOne(
		{
			username: jwtusername,
		},
		function (err, partner) {
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
			} else if (!partner) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Bank.findOne({ _id: partner.bank_id }, (err, bank) => {
					const wallet_ids = getWalletIds("partner", partner.code, bank.bcode);
					blockchain
						.createWallet([wallet_ids.operational, wallet_ids.master])
						.then(function (result) {
							console.log("result", result);
							if (result != "" && !result.includes("wallet already exists")) {
								console.log(result);
								res.status(200).json({
									status: 0,
									message:
										"Blockchain service was unavailable. Please try again.",
									result: result,
								});
							} else {
								Partner.findByIdAndUpdate(
									partner._id,
									{
										status: 1,
										wallet_ids: {
											operational: wallet_ids.operational,
											master: wallet_ids.master,
										},
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
												status: "activated",
												walletStatus: result,
											});
										}
									}
								);
							}
						})
						.catch((err) => {
							console.log(err);
							res.status(200).json({
								status: 0,
								message: err.message,
							});
						});
				});
			}
		}
	);
});

module.exports = router;
