//utils
const sendSMS = require("../../routes/utils/sendSMS");
const sendMail = require("../../routes/utils/sendMail");
const makeid = require("../../routes/utils/idGenerator");
const makeotp = require("../../routes/utils/makeotp");
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");

const addCashierSendRecord = require("../utils/addSendRecord");

//models
const User = require("../../models/User");
const NWUser = require("../../models/NonWalletUsers");
const OTP = require("../../models/OTP");
const Bank = require("../../models/Bank");
const Infra = require("../../models/Infra");
const Fee = require("../../models/Fee");
const CashierSend = require("../../models/CashierSend");
const Merchant = require("../../models/merchant/Merchant");
const MerchantSettings = require("../../models/merchant/MerchantSettings");
const Invoice = require("../../models/merchant/Invoice");

// transactions
const txstate = require("../transactions/services/states");
const walletToWallet = require("../transactions/intraBank/walletToWallet");
const walletToCashier = require("../transactions/intraBank/walletToCashier");

//constants
const categoryConst = require("../transactions/constants/category");

module.exports.sendMoneyToNonWallet = async function (req, res) {
	const username = req.sign_creds.username;
	const transactionCode = makeid(8);

	const {
		receiverMobile,
		receiverGivenName,
		receiverFamilyName,
		receiverCountry,
		receiverEmail,
		receiverIdentificationAmount,
		isInclusive,
	} = req.body;

	User.findOneAndUpdate(
		{
			username,
			status: 1,
		},
		{
			$addToSet: {
				contact_list: receiverMobile,
			},
		},
		async function (err45, sender) {
			let result45 = errorMessage(err45, sender, "Sender not found");
			if (result45.status == 0) {
				res.status(200).json(result45);
			} else {
				// Initiate transaction state
				const master_code = await txstate.initiate(
					categoryConst.MAIN,
					sender.bank_id,
					"Wallet To Non Wallet"
				);
				let receiver = {
					name: receiverGivenName,
					last_name: receiverFamilyName,
					mobile: receiverMobile,
					email: receiverEmail,
					country: receiverCountry,
				};
				NWUser.create(receiver, function (err1) {
					Bank.findOne(
						{
							_id: sender.bank_id,
						},
						function (err2, bank) {
							let result2 = errorMessage(err2, bank, "Bank Not Found");
							if (result2.status == 0) {
								res.status(200).json(result2);
							} else {
								Infra.findOne(
									{
										_id: bank.user_id,
									},
									function (err3, infra) {
										let result3 = errorMessage(err3, infra, "Infra Not Found");
										if (result3.status == 0) {
											res.status(200).json(result3);
										} else {
											const find = {
												bank_id: bank._id,
												trans_type: "Wallet to Non Wallet",
												status: 1,
												active: "Active",
											};
											Fee.findOne(find, function (err4, rule) {
												let result4 = errorMessage(
													err4,
													rule,
													"Revenue Rule Not Found"
												);
												if (result4.status == 0) {
													res.status(200).json(result4);
												} else {
													req.body.givenname = sender.name;
													req.body.familyname = sender.last_name;
													req.body.senderIdentificationCountry = "";
													req.body.senderIdentificationType = sender.id_type;
													req.body.senderIdentificationNumber =
														sender.id_number;
													req.body.senderIdentificationValidTill =
														sender.valid_till;
													req.body.address1 = sender.address;
													req.body.state = sender.state;
													req.body.zip = "";
													req.body.ccode = "";
													req.body.country = sender.country;
													req.body.email = sender.email;
													req.body.mobile = sender.mobile;
													req.body.receiverccode = "";
													req.body.receiverIdentificationCountry = "";

													var otherInfo = {
														cashierId: "",
														userId: sender._id,
														transactionCode: transactionCode,
														ruleType: "Wallet to Non Wallet",
														masterCode: master_code,
													};
													addCashierSendRecord(
														req.body,
														otherInfo,
														(err5, cs) => {
															if (err5) {
																res.status(200).json(catchError(err5));
															} else {
																const transfer = {
																	amount: receiverIdentificationAmount,
																	is_inclusive: isInclusive,
																	master_code: master_code,
																	receiverFamilyName: receiverFamilyName,
																};
																walletToCashier(
																	transfer,
																	infra,
																	bank,
																	sender,
																	rule
																)
																	.then(function (result) {
																		console.log("Result: " + result);
																		if (result.status == 1) {
																			let content =
																				"Your Transaction Code is " +
																				transactionCode;
																			if (
																				receiverMobile &&
																				receiverMobile != null
																			) {
																				sendSMS(content, receiverMobile);
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
																				cs._id,
																				{
																					status: 1,
																					fee: result.fee,
																				},
																				(err6) => {
																					if (err6) {
																						res
																							.status(200)
																							.json(catchError(err6));
																					} else {
																						txstate.waitingForCompletion(
																							categoryConst.MAIN,
																							master_code,
																							{
																								infra_fee:result.infraFee,
																								bank_fee: result.fee,
																							}
																						);
																						res.status(200).json({
																							status: 1,
																							message:
																								receiverIdentificationAmount +
																								" XOF is transferred to branch",
																							balance:
																								result.balance -
																								(result.amount + result.fee),
																							transaction_code:master_code,
																						});
																					}
																				}
																			);
																		} else {
																			txstate.failed(
																				categoryConst.MAIN,
																				master_code
																			);
																			res.status(200).json(result);
																		}
																	})
																	.catch((err7) => {
																		txstate.failed(
																			categoryConst.MAIN,
																			master_code
																		);
																		console.log(err7);
																		res.status(200).json({
																			status: 0,
																			message: err7.message,
																		});
																	});
															}
														}
													);
												}
												//infra
											});
										}
									}
								);
							}
						}
					); //branch
				});
			}
		}
	);
};

module.exports.sendMoneyToWallet = async function (req, res) {
	const username = req.sign_creds.username;

	const { receiverMobile, sending_amount, isInclusive } = req.body;

	User.findOneAndUpdate(
		{
			username,
			status: 1,
		},
		{
			$addToSet: {
				contact_list: receiverMobile,
			},
		},
		async function (err45, sender) {
			let result45 = errorMessage(
				err45,
				sender,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result45.status == 0) {
				res.status(200).json(result45);
			} else {
				// Initiate transaction state
				const master_code = await txstate.initiate(
					categoryConst.MAIN,
					sender.bank_id,
					"Wallet to Wallet"
				);
				User.findOne(
					{
						mobile: receiverMobile,
					},
					(err1, receiver) => {
						let result1 = errorMessage(
							err1,
							receiver,
							"Receiver's wallet do not exist"
						);
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							Bank.findOne(
								{
									_id: sender.bank_id,
								},
								function (err2, bank) {
									let result2 = errorMessage(err2, bank, "Bank Not Found");
									if (result2.status == 0) {
										res.status(200).json(result2);
									} else {
										Infra.findOne(
											{
												_id: bank.user_id,
											},
											function (err3, infra) {
												let result3 = errorMessage(
													err3,
													infra,
													"Infra Not Found"
												);
												if (result3.status == 0) {
													res.status(200).json(result3);
												} else {
													const find = {
														bank_id: bank._id,
														trans_type: "Wallet to Wallet",
														status: 1,
														active: "Active",
													};
													Fee.findOne(find, function (err4, rule) {
														let result4 = errorMessage(
															err4,
															rule,
															"Revenue Rule Not Found"
														);
														if (result4.status == 0) {
															res.status(200).json(result4);
														} else {
															let transfer = {
																amount: sending_amount,
																isInclusive: isInclusive,
																master_code: master_code,
															};

															walletToWallet(
																transfer,
																infra,
																bank,
																sender,
																receiver,
																rule
															)
																.then(function (result) {
																	console.log("Result: " + result);
																	if (result.status == 1) {
																		txstate.completed(
																			categoryConst.MAIN,
																			master_code,
																			{
																				infra_fee:result.infraFee,
																				bank_fee: result.fee,
																			}
																		);
																		res.status(200).json({
																			status: 1,
																			message:
																				sending_amount +
																				" XOF is transferred to " +
																				receiver.name,
																			balance:
																				result.balance -
																				(result.amount + result.fee),
																			transaction_code:master_code,
																		});
																	} else {
																		txstate.failed(
																			categoryConst.MAIN,
																			master_code
																		);
																		res.status(200).json(result);
																	}
																})
																.catch((err5) => {
																	txstate.failed(
																		categoryConst.MAIN,
																		master_code
																	);
																	res.status(200).json(catchError(err5));
																});
														}
														//infra
													});
												}
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
};
