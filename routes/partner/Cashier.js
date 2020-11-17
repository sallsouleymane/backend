const express = require("express");
const router = express.Router();

const jwtTokenAuth = require("../JWTTokenAuth");

//utils
const sendSMS = require("../utils/sendSMS");
const sendMail = require("../utils/sendMail");
const makeid = require("../utils/idGenerator");
const makeotp = require("../utils/makeotp");
const getTypeClass = require("../utils/getTypeClass");
const { errorMessage, catchError } = require("../utils/errorHandler");
const blockchain = require("../../services/Blockchain");

const transferToOpByPartner = require("../transactions/transferToOpByPartner");

//models
const Infra = require("../../models/Infra");
const Bank = require("../../models/Bank");
const Partner = require("../../models/partner/Partner");
const PartnerBranch = require("../../models/partner/Branch");
const PartnerCashier = require("../../models/partner/Cashier");
const PartnerUser = require("../../models/partner/User");
const FailedTX = require("../../models/FailedTXLedger");
const Fee = require("../../models/Fee");
const CashierSend = require("../../models/CashierSend");
const CashierPending = require("../../models/CashierPending");
const CashierClaim = require("../../models/CashierClaim");
const CashierLedger = require("../../models/CashierLedger");
const CashierTransfer = require("../../models/CashierTransfer");
const OTP = require("../../models/OTP");
const Merchant = require("../../models/merchant/Merchant");
const MerchantSettings = require("../../models/merchant/MerchantSettings");
const User = require("../../models/User");

router.post("/partnerCashier/sendToOperational", jwtTokenAuth, function (
	req,
	res
) {
	const { wallet_id, amount, is_inclusive } = req.body;
	const jwtusername = req.sign_creds.username;
	var code = wallet_id.substr(0, 2);
	if (code != "BR" && code != "PB") {
		res.status(200).json({
			status: 0,
			message: "You can only send to branch and partner branch",
		});
		return;
	}
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				PartnerBranch.findOne({ _id: cashier.branch_id }, (err, branch) => {
					let result = errorMessage(err, branch, "Branch not found");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						const Collection = getTypeClass(code);
						Collection.findOne(
							{
								bank_id: cashier.bank_id,
								"wallet_ids.operational": wallet_id,
							},
							(err, toBranch) => {
								let result = errorMessage(err, toBranch, "Invalid wallet ID");
								if (result.status == 0) {
									res.status(200).json(result);
								} else {
									const find = {
										bank_id: cashier.bank_id,
										trans_type: "Non Wallet to Operational",
										status: 1,
										active: "Active",
									};
									Fee.findOne(find, (err, rule) => {
										let result = errorMessage(err, rule, "Rule not found");
										if (result.status == 0) {
											res.status(200).json(result);
										} else {
											Bank.findOne({ _id: cashier.bank_id }, (err, bank) => {
												let result = errorMessage(err, bank, "Bank not found");
												if (result.status == 0) {
													res.status(200).json(result);
												} else {
													Infra.findOne({ _id: bank.user_id }, (err, infra) => {
														let result = errorMessage(
															err,
															infra,
															"Infra not found"
														);
														if (result.status == 0) {
															res.status(200).json(result);
														} else {
															const transfer = {
																amount: amount,
																isInclusive: is_inclusive,
															};
															transferToOpByPartner(
																transfer,
																infra,
																bank,
																branch,
																toBranch,
																rule
															)
																.then((result) => {
																	if (result == 1) {
																		CashierSend.findByIdAndUpdate(
																			d._id,
																			{
																				status: 1,
																				fee: result.fee,
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
																					PartnerCashier.findByIdAndUpdate(
																						cashier._id,
																						{
																							cash_received:
																								Number(cashier.cash_received) +
																								Number(transfer.amount) +
																								Number(transfer.fee),
																							cash_in_hand:
																								Number(cashier.cash_in_hand) +
																								Number(trasfer.amount) +
																								Number(transfer.fee),
																							fee_generated:
																								Number(transfer.sendFee) +
																								Number(cashier.fee_generated),
																							total_trans:
																								Number(cashier.total_trans) + 1,
																						},
																						function (e, v) {}
																					);
																					CashierLedger.findOne(
																						{
																							cashier_id: cashier._id,
																							trans_type: "CR",
																							created_at: {
																								$gte: new Date(start),
																								$lte: new Date(end),
																							},
																						},
																						function (err, c) {
																							if (err || c == null) {
																								let data = new CashierLedger();
																								data.amount =
																									Number(transfer.amount) +
																									Number(transfer.fee);
																								data.trans_type = "CR";
																								data.transaction_details = JSON.stringify(
																									{
																										fee: transfer.fee,
																									}
																								);
																								data.cashier_id = cashier._id;
																								data.save(function (err, c) {});
																							} else {
																								var amt =
																									Number(c.amount) +
																									Number(transfer.amount) +
																									Number(transfer.fee);
																								CashierLedger.findByIdAndUpdate(
																									c._id,
																									{
																										amount: amt,
																									},
																									function (err, c) {}
																								);
																							}
																						}
																					);
																					res.status(200).json({
																						status: 1,
																						message:
																							transfer.amount +
																							"XOF amount is Transferred",
																					});
																				}
																			}
																		);
																	} else {
																		res.status(200).json(result);
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
											});
										}
									});
								}
							}
						);
					}
				});
			}
		}
	);
});

router.post("/partnerCashier/getUserByMobile", jwtTokenAuth, function (
	req,
	res
) {
	const { mobile } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne({ username: jwtusername, status: 1 }, function (
		err,
		cashier
	) {
		let result = errorMessage(
			err,
			cashier,
			"You are either not authorised or not logged in."
		);
		if (result.status == 0) {
			res.status(200).json(result);
		} else {
			User.findOne({ mobile }, "-password", function (err, user) {
				let result = errorMessage(err, user, "User not found");
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					res.status(200).json({
						status: 1,
						data: user,
					});
				}
			});
		}
	});
});

router.post("/partnerCashier/getDetails", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				PartnerUser.findOne({ _id: cashier.partner_user_id }, function (
					err,
					user
				) {
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
							cashier: cashier,
							user: user,
						});
					}
				});
			}
		}
	);
});

router.post("/partnerCashier/getMerchantPenaltyRule", jwtTokenAuth, function (
	req,
	res
) {
	const jwtusername = req.sign_creds.username;
	const merchant_id = req.body.merchant_id;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantSettings.findOne({ merchant_id: merchant_id }, function (
					err,
					setting
				) {
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
							rule: setting.penalty_rule,
						});
					}
				});
			}
		}
	);
});

router.post("/partnerCashier/sendMoneyToWallet", jwtTokenAuth, function (
	req,
	res
) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	var now = new Date().getTime();

	const {
		givenname,
		familyname,
		note,
		senderIdentificationCountry,
		senderIdentificationType,
		senderIdentificationNumber,
		senderIdentificationValidTill,
		address1,
		state,
		zip,
		ccode,
		country,
		email,
		mobile,
		requireOTP,
		receiverMobile,
		receiverIdentificationAmount,
		isInclusive,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Partner.findOne({ _id: cashier.partner_id }, (err, partner) => {
					User.findOne(
						{
							mobile: receiverMobile,
						},
						function (err, receiver) {
							let result = errorMessage(err, receiver, "Receiver Not Found");
							if (result.status == 0) {
								res.status(200).json(result);
							} else {
								PartnerBranch.findOne(
									{
										_id: cashier.branch_id,
									},
									function (err, branch) {
										let result = errorMessage(err, branch, "Branch Not Found");
										if (result.status == 0) {
											res.status(200).json(result);
										} else {
											Bank.findOne(
												{
													_id: partner.bank_id,
												},
												function (err, bank) {
													let result = errorMessage(
														err,
														bank,
														"Bank Not Found"
													);
													if (result.status == 0) {
														res.status(200).json(result);
													} else {
														Infra.findOne(
															{
																_id: bank.user_id,
															},
															function (err, infra) {
																let result = errorMessage(
																	err,
																	infra,
																	"Infra Not Found"
																);
																if (result.status == 0) {
																	res.status(200).json(result);
																} else {
																	let data = new CashierSend();
																	let temp = {
																		ccode: ccode,
																		mobile: mobile,
																		givenname: givenname,
																		familyname: familyname,
																		address1: address1,
																		state: state,
																		zip: zip,
																		country: country,
																		email: email,
																		note: note,
																	};
																	data.sender_info = JSON.stringify(temp);
																	temp = {
																		country: senderIdentificationCountry,
																		type: senderIdentificationType,
																		number: senderIdentificationNumber,
																		valid: senderIdentificationValidTill,
																	};
																	data.sender_id = JSON.stringify(temp);
																	temp = {
																		mobile: receiverMobile,
																	};
																	data.receiver_info = JSON.stringify(temp);
																	data.amount = receiverIdentificationAmount;
																	data.is_inclusive = isInclusive;
																	data.cashier_id = cashier._id;
																	data.rule_type = "Non Wallet to Wallet";

																	var mns = branch.mobile.slice(-2);
																	var mnr = bank.mobile.slice(-2);
																	var master_code = mns + "" + mnr + "" + now;
																	var child_code = mns + "" + mnr + "" + now;
																	data.master_code = master_code;
																	data.child_code = child_code;

																	//send transaction sms after actual transaction

																	if (requireOTP) {
																		data.require_otp = 1;
																		data.otp = makeotp(6);
																		content =
																			data.otp +
																			" - Send this OTP to the Receiver";
																		if (mobile && mobile != null) {
																			sendSMS(content, mobile);
																		}
																		if (email && email != null) {
																			sendMail(
																				content,
																				"Transaction OTP",
																				email
																			);
																		}
																	}

																	data.save((err, d) => {
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
																			const branchOpWallet =
																				branch.wallet_ids.operational;
																			const receiverWallet = receiver.wallet_id;
																			const bankOpWallet =
																				bank.wallet_ids.operational;
																			const infraOpWallet =
																				bank.wallet_ids.infra_operational;

																			const find = {
																				bank_id: bank._id,
																				trans_type: "Non Wallet to Wallet",
																				status: 1,
																				active: "Active",
																			};

																			const amount = receiverIdentificationAmount;
																			Fee.findOne(find, function (err, fe) {
																				let result = errorMessage(
																					err,
																					fe,
																					"Revenue Rule Not Found"
																				);
																				if (result.status == 0) {
																					res.status(200).json(result);
																				} else {
																					var fee = 0;
																					fe.ranges.map((range) => {
																						if (
																							amount >= range.trans_from &&
																							amount <= range.trans_to
																						) {
																							var temp =
																								(amount * range.percentage) /
																								100;
																							fee = temp + range.fixed;

																							oamount = Number(amount);

																							if (isInclusive) {
																								oamount = oamount - fee;
																							}
																							console.log(fe);
																							const {
																								infra_share,
																								partner_share,
																								specific_partner_share,
																							} = fe.revenue_sharing_rule;

																							var infraShare = 0;
																							var infraShare =
																								(fee *
																									Number(
																										infra_share.percentage
																									)) /
																								100;

																							var bankShare = fee - infraShare;
																							let feeObject = partner_share;
																							let sendFee = 0;
																							if (bankShare > 0) {
																								var spFeeObject;
																								if (
																									specific_partner_share.length >
																									0
																								) {
																									spFeeObject = specific_partner_share.filter(
																										(bwsf) =>
																											bwsf.partner_code ==
																											partner.code
																									)[0];
																								}
																								if (spFeeObject) {
																									feeObject = spFeeObject;
																								}
																								const { send } = feeObject;
																								sendFee =
																									(send * bankShare) / 100;
																							}

																							blockchain
																								.getBalance(branchOpWallet)
																								.then(function (bal) {
																									if (
																										Number(bal) +
																											Number(
																												branch.credit_limit
																											) >=
																										oamount + fee
																									) {
																										var transArr = [];

																										let trans1 = {};
																										trans1.from = branchOpWallet;
																										trans1.to = receiverWallet;
																										trans1.amount = oamount;
																										trans1.note =
																											"Cashier Send Money";
																										trans1.email1 =
																											branch.email;
																										trans1.email2 =
																											receiver.email;
																										trans1.mobile1 =
																											branch.mobile;
																										trans1.mobile2 =
																											receiver.mobile;
																										trans1.from_name =
																											branch.name;
																										trans1.to_name =
																											receiver.name;
																										trans1.user_id =
																											cashier._id;
																										trans1.master_code = master_code;
																										trans1.child_code =
																											child_code + "1";
																										transArr.push(trans1);

																										let trans2 = {};
																										if (fee > 0) {
																											trans2.from = branchOpWallet;
																											trans2.to = bankOpWallet;
																											trans2.amount = fee;
																											trans2.note =
																												"Cashier Send Money Fee";
																											trans2.email1 =
																												branch.email;
																											trans2.email2 =
																												bank.email;
																											trans2.mobile1 =
																												branch.mobile;
																											trans2.mobile2 =
																												bank.mobile;
																											trans2.from_name =
																												branch.name;
																											trans2.to_name =
																												bank.name;
																											trans2.user_id =
																												cashier._id;
																											trans2.master_code = master_code;
																											now = new Date().getTime();
																											child_code =
																												mns +
																												"" +
																												mnr +
																												"" +
																												now;
																											trans2.child_code =
																												child_code + "2";
																											transArr.push(trans2);
																										}

																										let trans31 = {};
																										if (infraShare > 0) {
																											trans31.from = bankOpWallet;
																											trans31.to = infraOpWallet;
																											trans31.amount = infraShare;
																											trans31.note =
																												"Cashier Send Money Infra Fee";
																											trans31.email1 =
																												bank.email;
																											trans31.email2 =
																												infra.email;
																											trans31.mobile1 =
																												bank.mobile;
																											trans31.mobile2 =
																												infra.mobile;
																											trans31.from_name =
																												bank.name;
																											trans31.to_name =
																												infra.name;
																											trans31.user_id = "";
																											trans31.master_code = master_code;
																											mns = bank.mobile.slice(
																												-2
																											);
																											mnr = infra.mobile.slice(
																												-2
																											);
																											now = new Date().getTime();
																											child_code =
																												mns +
																												"" +
																												mnr +
																												"" +
																												now +
																												"3";
																											trans31.child_code = child_code;
																											transArr.push(trans31);
																										}

																										let trans32 = {};
																										if (infra_share.fixed > 0) {
																											trans32.from = bankOpWallet;
																											trans32.to = infraOpWallet;
																											trans32.amount =
																												infra_share.fixed;
																											trans32.note =
																												"Cashier Send Money Infra Fee";
																											trans32.email1 =
																												bank.email;
																											trans32.email2 =
																												infra.email;
																											trans32.mobile1 =
																												bank.mobile;
																											trans32.mobile2 =
																												infra.mobile;
																											trans32.from_name =
																												bank.name;
																											trans32.to_name =
																												infra.name;
																											trans32.user_id = "";
																											trans32.master_code = master_code;
																											mns = bank.mobile.slice(
																												-2
																											);
																											mnr = infra.mobile.slice(
																												-2
																											);
																											now = new Date().getTime();
																											child_code =
																												mns +
																												"" +
																												mnr +
																												"" +
																												now +
																												"3";
																											trans32.child_code = child_code;
																											transArr.push(trans32);
																										}

																										let trans4 = {};
																										if (bankShare > 0) {
																											trans4.from = bankOpWallet;
																											trans4.to = branchOpWallet;
																											//calculate the revenue here and replace with fee below.
																											trans4.amount = Number(
																												Number(sendFee).toFixed(
																													2
																												)
																											);
																											// trans4.amount = 1 ;
																											trans4.note =
																												"Bank Send Revenue Branch for Sending money";
																											trans4.email1 =
																												bank.email;
																											trans4.email2 =
																												branch.email;
																											trans4.mobile1 =
																												branch.mobile;
																											trans4.mobile2 =
																												bank.mobile;
																											trans4.from_name =
																												bank.name;
																											trans4.to_name =
																												branch.name;
																											trans4.user_id = "";
																											trans4.master_code = master_code;
																											now = new Date().getTime();
																											child_code =
																												mns +
																												"" +
																												mnr +
																												"" +
																												now;
																											trans4.child_code =
																												child_code + "4";
																											transArr.push(trans4);
																										}
																										//End
																										console.log(
																											sendFee,
																											feeObject,
																											partner_share,
																											specific_partner_share,
																											branch.code
																										);

																										blockchain
																											.transferThis(...transArr)
																											.then(function (result) {
																												console.log(
																													"Result: " + result
																												);
																												if (
																													result.length <= 0
																												) {
																													CashierSend.findByIdAndUpdate(
																														d._id,
																														{
																															status: 1,
																															fee: fee,
																														},
																														(err) => {
																															if (err) {
																																console.log(
																																	err
																																);
																																var message = err;
																																if (
																																	err.message
																																) {
																																	message =
																																		err.message;
																																}
																																res
																																	.status(200)
																																	.json({
																																		status: 0,
																																		message: message,
																																	});
																															} else {
																																PartnerCashier.findByIdAndUpdate(
																																	cashier._id,
																																	{
																																		cash_received:
																																			Number(
																																				cashier.cash_received
																																			) +
																																			Number(
																																				oamount
																																			) +
																																			Number(
																																				fee
																																			),
																																		cash_in_hand:
																																			Number(
																																				cashier.cash_in_hand
																																			) +
																																			Number(
																																				oamount
																																			) +
																																			Number(
																																				fee
																																			),
																																		fee_generated:
																																			Number(
																																				sendFee
																																			) +
																																			Number(
																																				cashier.fee_generated
																																			),

																																		total_trans:
																																			Number(
																																				cashier.total_trans
																																			) + 1,
																																	},
																																	function (
																																		e,
																																		v
																																	) {}
																																);

																																CashierLedger.findOne(
																																	{
																																		cashier_id:
																																			cashier._id,
																																		trans_type:
																																			"CR",
																																		created_at: {
																																			$gte: new Date(
																																				start
																																			),
																																			$lte: new Date(
																																				end
																																			),
																																		},
																																	},
																																	function (
																																		err,
																																		c
																																	) {
																																		if (
																																			err ||
																																			c == null
																																		) {
																																			let data = new CashierLedger();
																																			data.amount =
																																				Number(
																																					oamount
																																				) +
																																				Number(
																																					fee
																																				);
																																			data.trans_type =
																																				"CR";
																																			data.transaction_details = JSON.stringify(
																																				{
																																					fee: fee,
																																				}
																																			);
																																			data.cashier_id =
																																				cashier._id;
																																			data.save(
																																				function (
																																					err,
																																					c
																																				) {}
																																			);
																																		} else {
																																			var amt =
																																				Number(
																																					c.amount
																																				) +
																																				Number(
																																					oamount
																																				) +
																																				Number(
																																					fee
																																				);
																																			CashierLedger.findByIdAndUpdate(
																																				c._id,
																																				{
																																					amount: amt,
																																				},
																																				function (
																																					err,
																																					c
																																				) {}
																																			);
																																		}
																																	}
																																);
																																res
																																	.status(200)
																																	.json({
																																		status: 1,
																																		message:
																																			receiverIdentificationAmount +
																																			"XOF amount is Transferred",
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
																											.catch((err) => {
																												console.log(
																													err.toString()
																												);
																												res.status(200).json({
																													status: 0,
																													message: err.message,
																												});
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
																			});
																		}
																	});
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
				});
			}
		}
	);
});

router.post("/partnerCashier/sendMoney", jwtTokenAuth, function (req, res) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	var now = new Date().getTime();

	const {
		givenname,
		familyname,
		note,
		senderIdentificationCountry,
		senderIdentificationType,
		senderIdentificationNumber,
		senderIdentificationValidTill,
		address1,
		state,
		zip,
		ccode,
		country,
		email,
		mobile,
		withoutID,
		requireOTP,
		receiverMobile,
		receiverccode,
		receiverGivenName,
		receiverFamilyName,
		receiverCountry,
		receiverEmail,
		receiverIdentificationCountry,
		receiverIdentificationType,
		receiverIdentificationNumber,
		receiverIdentificationValidTill,
		receiverIdentificationAmount,
		isInclusive,
	} = req.body;

	const transactionCode = makeid(8);

	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Partner.findOne({ _id: cashier.partner_id }, (err, partner) => {
					let result = errorMessage(err, partner, "Partner not found");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						PartnerBranch.findOne(
							{
								_id: cashier.branch_id,
							},
							function (err, branch) {
								let result = errorMessage(err, branch, "Branch Not Found");
								if (result.status == 0) {
									res.status(200).json(result);
								} else {
									Bank.findOne(
										{
											_id: partner.bank_id,
										},
										function (err, bank) {
											let result = errorMessage(err, bank, "Bank Not Found");
											if (result.status == 0) {
												res.status(200).json(result);
											} else {
												Infra.findOne(
													{
														_id: bank.user_id,
													},
													function (err, infra) {
														let result = errorMessage(
															err,
															infra,
															"Infra Not Found"
														);
														if (result.status == 0) {
															res.status(200).json(result);
														} else {
															let data = new CashierSend();
															let temp = {
																ccode: ccode,
																mobile: mobile,
																givenname: givenname,
																familyname: familyname,
																address1: address1,
																state: state,
																zip: zip,
																country: country,
																email: email,
																note: note,
															};
															data.sender_info = JSON.stringify(temp);
															temp = {
																country: senderIdentificationCountry,
																type: senderIdentificationType,
																number: senderIdentificationNumber,
																valid: senderIdentificationValidTill,
															};
															data.sender_id = JSON.stringify(temp);
															temp = {
																mobile: receiverMobile,
																ccode: receiverccode,
																givenname: receiverGivenName,
																familyname: receiverFamilyName,
																country: receiverCountry,
																email: receiverEmail,
															};
															data.receiver_info = JSON.stringify(temp);
															temp = {
																country: receiverIdentificationCountry,
																type: receiverIdentificationType,
																number: receiverIdentificationNumber,
																valid: receiverIdentificationValidTill,
															};
															data.receiver_id = JSON.stringify(temp);
															data.amount = receiverIdentificationAmount;
															data.is_inclusive = isInclusive;
															data.cashier_id = cashier._id;
															data.transaction_code = transactionCode;
															data.rule_type = "Non Wallet to Non Wallet";

															var mns = branch.mobile.slice(-2);
															var mnr = bank.mobile.slice(-2);
															var master_code = mns + "" + mnr + "" + now;
															var child_code = mns + "" + mnr + "" + now;
															data.master_code = master_code;
															data.child_code = child_code;

															//send transaction sms after actual transaction

															data.without_id = withoutID ? 1 : 0;
															if (requireOTP) {
																data.require_otp = 1;
																data.otp = makeotp(6);
																content =
																	data.otp + " - Send this OTP to the Receiver";
																if (mobile && mobile != null) {
																	sendSMS(content, mobile);
																}
																if (email && email != null) {
																	sendMail(content, "Transaction OTP", email);
																}
															}

															data.save((err, d) => {
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
																	const branchOpWallet =
																		branch.wallet_ids.operational;
																	const bankEsWallet = bank.wallet_ids.escrow;
																	const bankOpWallet =
																		bank.wallet_ids.operational;
																	const infraOpWallet =
																		bank.wallet_ids.infra_operational;

																	const find = {
																		bank_id: bank._id,
																		trans_type: "Non Wallet to Non Wallet",
																		status: 1,
																		active: "Active",
																	};

																	const amount = receiverIdentificationAmount;
																	Fee.findOne(find, function (err, fe) {
																		let result = errorMessage(
																			err,
																			fe,
																			"Revenue Rule Not Found"
																		);
																		if (result.status == 0) {
																			res.status(200).json(result);
																		} else {
																			var fee = 0;
																			fe.ranges.map((range) => {
																				if (
																					amount >= range.trans_from &&
																					amount <= range.trans_to
																				) {
																					var temp =
																						(amount * range.percentage) / 100;
																					fee = temp + range.fixed;

																					oamount = Number(amount);

																					if (isInclusive) {
																						oamount = oamount - fee;
																					}
																					console.log(fe);
																					const {
																						infra_share,
																						partner_share,
																						specific_partner_share,
																					} = fe.revenue_sharing_rule;

																					var infraShare = 0;
																					infraShare =
																						(fee *
																							Number(infra_share.percentage)) /
																						100;

																					let bankShare = fee - infraShare;
																					let feeObject = partner_share;
																					let sendFee = 0;
																					if (bankShare > 0) {
																						var spFeeObject;
																						if (
																							specific_partner_share.length > 0
																						) {
																							spFeeObject = specific_partner_share.filter(
																								(bwsf) =>
																									bwsf.partner_code ==
																									partner.code
																							)[0];
																						}
																						if (spFeeObject) {
																							feeObject = spFeeObject;
																						}
																						const { send } = feeObject;
																						sendFee = (send * bankShare) / 100;
																					}
																					blockchain
																						.getBalance(branchOpWallet)
																						.then(function (bal) {
																							if (
																								Number(bal) +
																									Number(branch.credit_limit) >=
																								oamount + fee
																							) {
																								var transArr = [];
																								let trans1 = {};
																								trans1.from = branchOpWallet;
																								trans1.to = bankEsWallet;
																								trans1.amount = oamount;
																								trans1.note =
																									"Cashier Send Money";
																								trans1.email1 = branch.email;
																								trans1.email2 = bank.email;
																								trans1.mobile1 = branch.mobile;
																								trans1.mobile2 = bank.mobile;
																								trans1.from_name = branch.name;
																								trans1.to_name = bank.name;
																								trans1.user_id = cashier._id;
																								trans1.master_code = master_code;
																								trans1.child_code =
																									child_code + "1";
																								transArr.push(trans1);

																								let trans2 = {};
																								if (bankShare > 0) {
																									trans2.from = branchOpWallet;
																									trans2.to = bankOpWallet;
																									trans2.amount = fee;
																									trans2.note =
																										"Cashier Send Money Fee";
																									trans2.email1 = branch.email;
																									trans2.email2 = bank.email;
																									trans2.mobile1 =
																										branch.mobile;
																									trans2.mobile2 = bank.mobile;
																									trans2.from_name =
																										branch.name;
																									trans2.to_name = bank.name;
																									trans2.user_id = cashier._id;
																									trans2.master_code = master_code;
																									now = new Date().getTime();
																									child_code =
																										mns + "" + mnr + "" + now;
																									trans2.child_code =
																										child_code + "2";
																									transArr.push(trans2);
																								}

																								let trans31 = {};
																								if (infraShare > 0) {
																									trans31.from = bankOpWallet;
																									trans31.to = infraOpWallet;
																									trans31.amount = infraShare;
																									trans31.note =
																										"Cashier Send Money Infra Fee";
																									trans31.email1 = bank.email;
																									trans31.email2 = infra.email;
																									trans31.mobile1 = bank.mobile;
																									trans31.mobile2 =
																										infra.mobile;
																									trans31.from_name = bank.name;
																									trans31.to_name = infra.name;
																									trans31.user_id = "";
																									trans31.master_code = master_code;
																									mns = bank.mobile.slice(-2);
																									mnr = infra.mobile.slice(-2);
																									now = new Date().getTime();
																									child_code =
																										mns +
																										"" +
																										mnr +
																										"" +
																										now +
																										"3.1";
																									trans31.child_code = child_code;
																									transArr.push(trans31);
																								}

																								let trans32 = {};
																								if (infra_share.fixed > 0) {
																									trans32.from = bankOpWallet;
																									trans32.to = infraOpWallet;
																									trans32.amount =
																										infra_share.fixed;
																									trans32.note =
																										"Cashier Send Money Infra Fee";
																									trans32.email1 = bank.email;
																									trans32.email2 = infra.email;
																									trans32.mobile1 = bank.mobile;
																									trans32.mobile2 =
																										infra.mobile;
																									trans32.from_name = bank.name;
																									trans32.to_name = infra.name;
																									trans32.user_id = "";
																									trans32.master_code = master_code;
																									mns = bank.mobile.slice(-2);
																									mnr = infra.mobile.slice(-2);
																									now = new Date().getTime();
																									child_code =
																										mns +
																										"" +
																										mnr +
																										"" +
																										now +
																										"3.2";
																									trans32.child_code = child_code;
																									transArr.push(trans32);
																								}

																								let trans4 = {};
																								if (bankShare > 0) {
																									trans4.from = bankOpWallet;
																									trans4.to = branchOpWallet;
																									trans4.amount = Number(
																										Number(sendFee).toFixed(2)
																									);
																									trans4.note =
																										"Bank Send Revenue Branch for Sending money";
																									trans4.email1 = bank.email;
																									trans4.email2 = branch.email;
																									trans4.mobile1 = bank.mobile;
																									trans4.mobile2 =
																										branch.mobile;
																									trans4.from_name = bank.name;
																									trans4.to_name = branch.name;
																									trans4.user_id = "";
																									trans4.master_code = master_code;
																									now = new Date().getTime();
																									child_code =
																										mns + "" + mnr + "" + now;
																									trans4.child_code =
																										child_code + "4";
																									transArr.push(trans4);
																								}
																								//End
																								console.log(
																									sendFee,
																									feeObject,
																									partner_share,
																									specific_partner_share,
																									branch.code
																								);

																								blockchain
																									.transferThis(...transArr)
																									.then(function (result) {
																										console.log(
																											"Result: " + result
																										);
																										if (result.length <= 0) {
																											let content =
																												"Your Transaction Code is " +
																												transactionCode;
																											if (
																												receiverMobile &&
																												receiverMobile != null
																											) {
																												sendSMS(
																													content,
																													receiverMobile
																												);
																											}
																											if (
																												receiverEmail &&
																												receiverEmail != null
																											) {
																												sendMail(
																													content,
																													"Transaction Code",
																													receiverEmail
																												);
																											}

																											CashierSend.findByIdAndUpdate(
																												d._id,
																												{
																													status: 1,
																													fee: fee,
																												},
																												(err) => {
																													if (err) {
																														console.log(err);
																														var message = err;
																														if (err.message) {
																															message =
																																err.message;
																														}
																														res
																															.status(200)
																															.json({
																																status: 0,
																																message: message,
																															});
																													} else {
																														PartnerCashier.findByIdAndUpdate(
																															cashier._id,
																															{
																																cash_received:
																																	Number(
																																		cashier.cash_received
																																	) +
																																	Number(
																																		oamount
																																	) +
																																	Number(fee),
																																cash_in_hand:
																																	Number(
																																		cashier.cash_in_hand
																																	) +
																																	Number(
																																		oamount
																																	) +
																																	Number(fee),
																																fee_generated:
																																	Number(
																																		sendFee
																																	) +
																																	Number(
																																		cashier.fee_generated
																																	),

																																total_trans:
																																	Number(
																																		cashier.total_trans
																																	) + 1,
																															},
																															function (e, v) {}
																														);
																													}

																													CashierLedger.findOne(
																														{
																															cashier_id:
																																cashier._id,
																															trans_type: "CR",
																															created_at: {
																																$gte: new Date(
																																	start
																																),
																																$lte: new Date(
																																	end
																																),
																															},
																														},
																														function (err, c) {
																															if (
																																err ||
																																c == null
																															) {
																																let data = new CashierLedger();
																																data.amount =
																																	Number(
																																		oamount
																																	) +
																																	Number(fee);
																																data.trans_type =
																																	"CR";
																																data.transaction_details = JSON.stringify(
																																	{
																																		fee: fee,
																																	}
																																);
																																data.cashier_id =
																																	cashier._id;
																																data.save(
																																	function (
																																		err,
																																		c
																																	) {}
																																);
																															} else {
																																var amt =
																																	Number(
																																		c.amount
																																	) +
																																	Number(
																																		oamount
																																	) +
																																	Number(fee);
																																CashierLedger.findByIdAndUpdate(
																																	c._id,
																																	{
																																		amount: amt,
																																	},
																																	function (
																																		err,
																																		c
																																	) {}
																																);
																															}
																														}
																													);
																													res.status(200).json({
																														status: 1,
																														message: "success",
																													});
																												}
																											);
																										} else {
																											res.status(200).json({
																												status: 0,
																												message: result.toString(),
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
																	});
																}
															});
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
				});
			}
		}
	);
});

router.post("/partnerCashier/claimMoney", jwtTokenAuth, function (req, res) {
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
		mobile,
	} = req.body;
	const jwtusername = req.sign_creds.username;

	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Partner.findOne({ _id: cashier.partner_id }, (err, partner) => {
					let result = errorMessage(err, partner, "Partner Cashier not found.");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						CashierClaim.findOne(
							{
								transaction_code: transferCode,
								status: 1,
							},
							(err, cc) => {
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
								} else if (cc) {
									res.status(200).json({
										status: 0,
										message: "Money is already claimed",
									});
								} else {
									CashierSend.findOne(
										{
											transaction_code: transferCode,
										},
										function (err, otpd) {
											let result = errorMessage(
												err,
												otpd,
												"Transaction Not Found"
											);
											if (result.status == 0) {
												res.status(200).json(result);
											} else {
												PartnerBranch.findOne(
													{
														_id: cashier.branch_id,
													},
													function (err, branch) {
														let result = errorMessage(
															err,
															branch,
															"Branch Not Found"
														);
														if (result.status == 0) {
															res.status(200).json(result);
														} else {
															Bank.findOne(
																{
																	_id: partner.bank_id,
																},
																function (err, bank) {
																	let result = errorMessage(
																		err,
																		bank,
																		"Bank Not Found"
																	);
																	if (result.status == 0) {
																		res.status(200).json(result);
																	} else {
																		Infra.findOne(
																			{
																				_id: bank.user_id,
																			},
																			function (err, infra) {
																				let result = errorMessage(
																					err,
																					infra,
																					"Infra Not Found"
																				);
																				if (result.status == 0) {
																					res.status(200).json(result);
																				} else {
																					var oamount = (amount = otpd.amount);
																					if (otpd.is_inclusive) {
																						amount = otpd.amount - otpd.fee;
																					}
																					let data = new CashierClaim();
																					data.transaction_code = transferCode;
																					data.proof = proof;
																					data.cashier_id = cashier._id;
																					data.amount = otpd.amount;
																					data.fee = otpd.fee;
																					data.is_inclusive = otpd.is_inclusive;
																					data.sender_name =
																						givenname + " " + familyname;
																					data.sender_mobile = mobile;
																					data.receiver_name =
																						receiverGivenName +
																						" " +
																						receiverFamilyName;
																					var mns = bank.mobile.slice(-2);
																					var mnr = branch.mobile.slice(-2);
																					var now = new Date().getTime();
																					var child_code =
																						mns + "" + mnr + "" + now;
																					var master_code = otpd.master_code;
																					data.master_code = master_code;
																					data.child_code = child_code + "1";

																					data.save((err, cashierClaimObj) => {
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
																							const find = {
																								bank_id: partner.bank_id,
																								trans_type: otpd.rule_type,
																								status: 1,
																								active: "Active",
																							};
																							Fee.findOne(find, function (
																								err,
																								fe
																							) {
																								let result = errorMessage(
																									err,
																									fe,
																									"Revenue Rule Not Found"
																								);
																								if (result.status == 0) {
																									res.status(200).json(result);
																								} else {
																									let fee = 0;
																									fe.ranges.map((range) => {
																										if (
																											oamount >=
																												range.trans_from &&
																											oamount <= range.trans_to
																										) {
																											var temp =
																												(oamount *
																													range.percentage) /
																												100;
																											fee = temp + range.fixed;
																										}

																										const {
																											infra_share,
																											partner_share,
																											specific_partner_share,
																										} = fe.revenue_sharing_rule;
																										var infraShare = 0;
																										infraShare =
																											(fee *
																												Number(
																													infra_share.percentage
																												)) /
																											100;

																										let bankShare =
																											fee - infraShare;

																										let feeObject = partner_share;
																										let claimFee = 0;
																										if (bankShare > 0) {
																											var spFeeObject;
																											if (
																												specific_partner_share.length >
																												0
																											) {
																												spFeeObject = specific_partner_share.filter(
																													(bwsf) =>
																														bwsf.partner_code ==
																														partner.code
																												)[0];
																											}
																											if (spFeeObject) {
																												feeObject = spFeeObject;
																											}
																											console.log("feeObject:");
																											console.log(feeObject);
																											const {
																												claim,
																											} = feeObject;
																											claimFee =
																												(claim * bankShare) /
																												100;
																										}

																										const branchOpWallet =
																											branch.wallet_ids
																												.operational;
																										const bankEsWallet =
																											bank.wallet_ids.escrow;
																										const bankOpWallet =
																											bank.wallet_ids
																												.operational;

																										var transArr = [];

																										let trans1 = {};
																										trans1.from = bankEsWallet;
																										trans1.to = branchOpWallet;
																										trans1.amount = amount;
																										trans1.note =
																											"Cashier claim Money";
																										trans1.email1 = bank.email;
																										trans1.email2 =
																											branch.email;
																										trans1.mobile1 =
																											bank.mobile;
																										trans1.mobile2 =
																											branch.mobile;
																										trans1.from_name =
																											bank.name;
																										trans1.to_name =
																											branch.name;
																										trans1.user_id = "";
																										trans1.master_code = master_code;
																										trans1.child_code = child_code;
																										transArr.push(trans1);

																										let trans2 = {};
																										console.log(
																											"bankShare: ",
																											bankShare
																										);
																										if (bankShare > 0) {
																											console.log(
																												"PC: claim transaction initiated"
																											);
																											trans2.from = bankOpWallet;
																											trans2.to = branchOpWallet;
																											//Replace the amount with the Claim Revenue below
																											trans2.amount = claimFee;
																											trans2.note =
																												"Revenue for claim Money";
																											trans2.email1 =
																												bank.email;
																											trans2.email2 =
																												branch.email;
																											trans2.mobile1 =
																												bank.mobile;
																											trans2.mobile2 =
																												branch.mobile;
																											trans2.from_name =
																												bank.name;
																											trans2.to_name =
																												branch.name;
																											trans2.user_id = "";
																											trans2.master_code = master_code;
																											trans2.child_code =
																												data.child_code + "2";
																											transArr.push(trans2);
																										}

																										//End of hatim Code

																										blockchain
																											.transferThis(...transArr)
																											.then(function (result) {
																												if (
																													result.length <= 0
																												) {
																													CashierClaim.findByIdAndUpdate(
																														cashierClaimObj._id,
																														{
																															status: 1,
																														},
																														(err) => {
																															if (err) {
																																console.log(
																																	err
																																);
																																var message = err;
																																if (
																																	err.message
																																) {
																																	message =
																																		err.message;
																																}
																																res
																																	.status(200)
																																	.json({
																																		status: 0,
																																		message: message,
																																	});
																															} else {
																																PartnerCashier.findByIdAndUpdate(
																																	cashier._id,
																																	{
																																		cash_paid:
																																			Number(
																																				cashier.cash_paid
																																			) +
																																			Number(
																																				amount
																																			),
																																		cash_in_hand:
																																			Number(
																																				cashier.cash_in_hand
																																			) -
																																			Number(
																																				amount
																																			),
																																		fee_generated:
																																			Number(
																																				cashier.fee_generated
																																			) +
																																			Number(
																																				claimFee
																																			),

																																		total_trans:
																																			Number(
																																				cashier.total_trans
																																			) + 1,
																																	},
																																	function (
																																		e,
																																		v
																																	) {}
																																);
																																CashierLedger.findOne(
																																	{
																																		cashier_id:
																																			cashier._id,
																																		trans_type:
																																			"DR",
																																		created_at: {
																																			$gte: new Date(
																																				start
																																			),
																																			$lte: new Date(
																																				end
																																			),
																																		},
																																	},
																																	function (
																																		err,
																																		c
																																	) {
																																		if (
																																			err ||
																																			c == null
																																		) {
																																			let data = new CashierLedger();
																																			data.amount = Number(
																																				amount
																																			);
																																			data.trans_type =
																																				"DR";
																																			data.cashier_id =
																																				cashier._id;
																																			data.save(
																																				function (
																																					err,
																																					c
																																				) {
																																					res
																																						.status(
																																							200
																																						)
																																						.json(
																																							{
																																								status: 1,
																																								message:
																																									"Cashier claimed money",
																																							}
																																						);
																																				}
																																			);
																																		} else {
																																			var amt =
																																				Number(
																																					c.amount
																																				) +
																																				Number(
																																					amount
																																				);
																																			CashierLedger.findByIdAndUpdate(
																																				c._id,
																																				{
																																					amount: amt,
																																				},
																																				function (
																																					err,
																																					c
																																				) {
																																					res
																																						.status(
																																							200
																																						)
																																						.json(
																																							{
																																								status: 1,
																																								message:
																																									"Cashier claimed money",
																																							}
																																						);
																																				}
																																			);
																																		}
																																	}
																																);
																															}
																														}
																													);
																												} else {
																													console.log(
																														result.toString()
																													);
																													res.status(200).json({
																														status: 0,
																														message:
																															"Something went wrong, please try again",
																													});
																												}
																											})
																											.catch((err) => {
																												console.log(
																													err.toString()
																												);
																												res.status(200).json({
																													status: 0,
																													message: err.message,
																												});
																											});
																									});
																								}
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
					}
				});
			}
		}
	);
});

router.post("/partnerCashier/listMerchants", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Merchant.find({ status: 1 }, "-password", (err, merchants) => {
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
							message: "Merchants List",
							list: merchants,
						});
					}
				});
			}
		}
	);
});

router.post("/partnerCashier/addClosingBalance", jwtTokenAuth, (req, res) => {
	const { denomination, total, note } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				let data = new CashierLedger();
				data.amount = total;
				data.cashier_id = cashier._id;
				data.trans_type = "CB";
				let td = {
					denomination,
					note,
				};
				data.transaction_details = JSON.stringify(td);

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
						PartnerCashier.findByIdAndUpdate(
							cashier._id,
							{
								closing_balance: total,
								closing_time: new Date(),
								is_closed: true,
							},
							function (e, v) {}
						);

						return res
							.status(200)
							.json({ status: 1, message: "Added closing balance" });
					}
				});
			}
		}
	);
});

router.post("/partnerCashier/getClosingBalance", jwtTokenAuth, function (
	req,
	res
) {
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				let cb = 0,
					c = cashier;
				cb = c.closing_balance;
				da = c.closing_time;
				var diff = Number(cb) - Number(cashier.cash_in_hand);
				res.status(200).json({
					cashInHand: cashier.cash_in_hand,
					balance1: cb,
					balance2: diff,
					lastdate: da,
					transactionStarted: c.transaction_started,
					isClosed: c.is_closed,
				});
			}
		}
	);
});

router.post("/partnerCashier/getIncomingTransfer", jwtTokenAuth, function (
	req,
	res
) {
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				CashierTransfer.find(
					{
						receiver_id: cashier._id,
						status: 0,
					},
					(e, data) => {
						res.status(200).json({
							status: 1,
							result: data,
						});
					}
				);
			}
		}
	);
});

router.post("/partnerCashier/getTransfers", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				CashierTransfer.find({
					$or: [{ sender_id: cashier._id }, { receiver_id: cashier._id }],
				}).exec(function (err, b) {
					res.status(200).json({
						status: 1,
						history: b,
					});
				});
			}
		}
	);
});

router.post("/partnerCashier/transferMoney", jwtTokenAuth, function (req, res) {
	const { otpId, otp, amount, receiver_id, receiver_name } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
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
					function (err, otpd) {
						let result = errorMessage(err, otpd, "OTP Missmatch");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							let data = new CashierTransfer();
							data.amount = amount;
							data.sender_id = cashier._id;
							data.receiver_id = receiver_id;
							data.sender_name = cashier.name;
							data.receiver_name = receiver_name;
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
									PartnerCashier.findByIdAndUpdate(
										cashier._id,
										{
											$inc: { cash_in_hand: -Number(amount) },
											cash_transferred: amount,
										},
										function (e, d) {
											if (e) {
												return res.status(200).json({
													status: 0,
													message: e.toString(),
												});
											} else {
												res.status(200).json({
													status: 1,
													message: "Money transferred record saved",
												});
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
	); //branch
});

router.post("/partnerCashier/acceptIncoming", jwtTokenAuth, function (
	req,
	res
) {
	const { receiver_id, amount, transfer_id } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				PartnerCashier.findByIdAndUpdate(
					{
						_id: receiver_id,
					},
					{
						$inc: { cash_in_hand: Number(amount) },
					},
					function (err, u) {
						let result = errorMessage(
							err,
							u,
							"Receiving partner cashier not found."
						);
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							CashierTransfer.findByIdAndUpdate(
								transfer_id,
								{
									status: 1,
								},
								(err, data) => {
									let result = errorMessage(
										err,
										data,
										"Cashier transfer record not found"
									);
									if (result.status == 0) {
										res.status(200).json(result);
									} else {
										res.status(200).json({
											status: 1,
											message: "Accepted incoming cash",
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

router.post("/partnerCashier/cancelTransfer", jwtTokenAuth, function (
	req,
	res
) {
	const { otpId, otp, transfer_id } = req.body;

	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
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
					function (err, otpd) {
						let result = errorMessage(err, otpd, "OTP Missmatch");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							CashierTransfer.findOneAndUpdate(
								{
									_id: transfer_id,
								},
								{ status: -1 },
								function (err, item) {
									let result = errorMessage(
										err,
										item,
										"No record of cashier transfer found"
									);
									if (result.status == 0) {
										res.status(200).json(result);
									} else {
										PartnerCashier.findOne(
											{
												_id: item.sender_id,
											},
											{
												$inc: { cash_in_hand: Number(item.amount) },
											},
											function (err, u) {
												let result = errorMessage(
													err,
													u,
													"Sending cashier not found"
												);
												if (result.status == 0) {
													res.status(200).json(result);
												} else {
													res.status(200).json({
														status: 1,
														message: "Cancelled transfer",
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
		}
	); //branch
});

router.post("/partnerCashier/getPartnerUserByMobile", jwtTokenAuth, function (
	req,
	res
) {
	const { mobile } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				PartnerUser.findOne({ mobile }, "-password", function (err, user) {
					let result = errorMessage(err, user, "User not found");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						res.status(200).json({
							status: 1,
							data: user,
						});
					}
				});
			}
		}
	);
});

router.post("/partnerCashier/checkFee", jwtTokenAuth, function (req, res) {
	var { trans_type, amount } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const find = {
					bank_id: cashier.bank_id,
					trans_type: trans_type,
					status: 1,
					active: "Active",
				};
				Fee.findOne(find, function (err, fe) {
					let result = errorMessage(
						err,
						fe,
						"Transaction cannot be done at this time"
					);
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						amount = Number(amount);
						var temp;
						fe.ranges.map((range) => {
							console.log(range);
							if (amount >= range.trans_from && amount <= range.trans_to) {
								temp = (amount * range.percentage) / 100;
								fee = temp + range.fixed;
								res.status(200).json({
									status: 1,
									fee: fee,
								});
							}
						});
					}
				});
			}
		}
	);
});

router.post("/partnerCashier/getCashierTransLimit", jwtTokenAuth, function (
	req,
	res
) {
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				let limit =
					Number(cashier.max_trans_amt) -
					(Number(cashier.cash_received) + Number(cashier.cash_paid));
				limit = limit < 0 ? 0 : limit;
				res.status(200).json({
					limit: limit,
					closingTime: cashier.closing_time,
					transactionStarted: cashier.transaction_started,
					cashInHand: cashier.cash_in_hand,
					isClosed: cashier.is_closed,
				});
			}
		}
	);
});

router.post("/partnerCashier/verifyOTPClaim", jwtTokenAuth, function (
	req,
	res
) {
	const { transferCode, otp } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				CashierSend.findOne(
					{
						transaction_code: transferCode,
						otp: otp,
					},
					function (err, otpd) {
						let result = errorMessage(err, otpd, "OTP Missmatch");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							res.status(200).json({
								status: 1,
								message: "Claim OTP verified",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/partnerCashier/verifyClaim", jwtTokenAuth, function (req, res) {
	const { otpId, otp } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
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
					function (err, otpd) {
						let result = errorMessage(err, otpd, "OTP Missmatch");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							res.status(200).json({
								status: 1,
								message: "Cashier verify claim success",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/partnerCashier/sendMoneyPending", jwtTokenAuth, function (
	req,
	res
) {
	const {
		givenname,
		familyname,
		note,
		senderIdentificationCountry,
		senderIdentificationType,
		senderIdentificationNumber,
		senderIdentificationValidTill,
		address1,
		state,
		zip,
		ccode,
		country,
		email,
		mobile,
		livefee,
		withoutID,
		requireOTP,
		receiverMobile,
		receiverccode,
		receiverGivenName,
		receiverFamilyName,
		receiverCountry,
		receiverEmail,
		receiverIdentificationCountry,
		receiverIdentificationType,
		receiverIdentificationNumber,
		receiverIdentificationValidTill,
		receiverIdentificationAmount,
	} = req.body;

	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				let data = new CashierPending();
				let temp = {
					givenname,
					familyname,
					note,
					senderIdentificationCountry,
					senderIdentificationType,
					senderIdentificationNumber,
					senderIdentificationValidTill,
					address1,
					state,
					zip,
					ccode,
					country,
					email,
					mobile,
					livefee,
					withoutID,
					requireOTP,
					receiverMobile,
					receiverccode,
					receiverGivenName,
					receiverFamilyName,
					receiverCountry,
					receiverEmail,
					receiverIdentificationCountry,
					receiverIdentificationType,
					receiverIdentificationNumber,
					receiverIdentificationValidTill,
					receiverIdentificationAmount,
				};
				data.sender_name = givenname + " " + familyname;
				data.receiver_name = receiverGivenName + " " + receiverFamilyName;
				data.amount = receiverIdentificationAmount;
				data.transaction_details = JSON.stringify(temp);
				data.cashier_id = cashier._id;

				let pending = Number(cashier.pending_trans) + 1;

				data.save((err, d) => {
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
						PartnerCashier.findByIdAndUpdate(
							cashier._id,
							{ pending_trans: pending },
							function (e, d) {
								if (e && d == null) {
									res.status(200).json({
										status: 0,
										message: e.toString(),
									});
								} else {
									res.status(200).json({
										status: 1,
										message: "Pending to send money record saved.",
									});
								}
							}
						);
					}
				}); //save
			}
		}
	);
});

router.post("/partnerCashier/getClaimMoney", jwtTokenAuth, function (req, res) {
	const { transferCode } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				CashierClaim.findOne(
					{
						transaction_code: transferCode,
						status: 1,
					},
					function (err, cs) {
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
						} else if (cs == null) {
							CashierSend.findOne(
								{
									transaction_code: transferCode,
								},
								function (err, cs) {
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
									} else if (cs == null) {
										res.status(200).json({
											status: 0,
											message: "Record Not Found",
										});
									} else {
										res.status(200).json({
											row: cs,
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

router.post("/partnerCashier/getHistory", jwtTokenAuth, function (req, res) {
	const { from } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				PartnerBranch.findOne({ _id: cashier.branch_id }, (err, branch) => {
					const wallet = branch.wallet_ids[from];
					blockchain
						.getStatement(wallet)
						.then(function (history) {
							FailedTX.find({ wallet_id: wallet }, (err, failed) => {
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
										history: history,
										failed: failed,
									});
								}
							});
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

router.post("/partnerCashier/getBranchByName", jwtTokenAuth, function (
	req,
	res
) {
	const { name } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				PartnerBranch.findOne(
					{
						name: name,
					},
					function (err, branch) {
						let result = errorMessage(err, branch, "Not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							Partner.findOne(
								{
									_id: branch.partner_id,
								},
								function (err, partner) {
									let result = errorMessage(err, partner, "Not found");
									if (result.status == 0) {
										res.status(200).json(result);
									} else {
										var obj = {};
										obj["logo"] = partner.logo;
										obj["partnerName"] = partner.name;
										obj["name"] = branch.name;
										obj["mobile"] = branch.mobile;
										obj["_id"] = branch._id;
										obj["partnerCode"] = partner.code;

										res.status(200).json({
											status: 1,
											branch: obj,
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

router.post("/partnerCashier/getDashStats", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
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
				res.status(200).json({
					openingBalance: user.opening_balance,
					closingBalance: user.closing_balance,
					cashPaid: user.cash_paid,
					cashReceived: user.cash_received,
					cashInHand: user.cash_in_hand,
					feeGenerated: user.fee_generated,
					commissionGenerated: user.commission_generated,
					closingTime: user.closing_time,
					transactionStarted: user.transaction_started,
					branchId: user.branch_id,
					isClosed: user.is_closed,
				});
			}
		}
	);
});

router.post("/partnerCashier/openBalance", jwtTokenAuth, (req, res) => {
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				var bal =
					Number(cashier.closing_balance) > 0
						? cashier.closing_balance
						: cashier.opening_balance;
				upd = {
					opening_balance: bal,
					cash_received: 0,
					fee_generated: 0,
					cash_paid: 0,
					closing_balance: 0,
					closing_time: null,
					transaction_started: true,
					is_closed: false,
				};

				PartnerCashier.findByIdAndUpdate(cashier._id, upd, (err) => {
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
							message: "Partner Cashier account is open now",
						});
					}
				});
			}
		}
	);
});

module.exports = router;
