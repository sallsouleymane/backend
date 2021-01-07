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
const txstate = require("../transactions/states");
const walletToWallet = require("../transactions/intraBank/walletToWallet");
const walletToCashier = require("../transactions/intraBank/walletToCashier");

module.exports.sendMoneyToNonWallet = async function (req, res) {
	// Initiate transaction state
	const master_code = await txstate.initiate();

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
		function (err, sender) {
			let result = errorMessage(err, sender, "Sender not found");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				receiver = {
					name: receiverGivenName,
					last_name: receiverFamilyName,
					mobile: receiverMobile,
					email: receiverEmail,
					country: receiverCountry,
				};
				NWUser.create(receiver, function (err) {
					Bank.findOne(
						{
							_id: sender.bank_id,
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
										let result = errorMessage(err, infra, "Infra Not Found");
										if (result.status == 0) {
											res.status(200).json(result);
										} else {
											const find = {
												bank_id: bank._id,
												trans_type: "Wallet to Non Wallet",
												status: 1,
												active: "Active",
											};
											Fee.findOne(find, function (err, rule) {
												let result = errorMessage(
													err,
													rule,
													"Revenue Rule Not Found"
												);
												if (result.status == 0) {
													res.status(200).json(result);
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
														branchId: "",
														branchType: "",
													};
													addCashierSendRecord(
														req.body,
														otherInfo,
														(err, cs) => {
															if (err) {
																res.status(200).json(catchError(err));
															} else {
																const transfer = {
																	amount: receiverIdentificationAmount,
																	is_inclusive: isInclusive,
																	master_code: master_code,
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
																					master_code: result.master_code,
																				},
																				(err) => {
																					if (err) {
																						res
																							.status(200)
																							.json(catchError(err));
																					} else {
																						txstate.waitingForCompletion(
																							master_code
																						);
																						res.status(200).json({
																							status: 1,
																							message:
																								receiverIdentificationAmount +
																								" XOF is transferred to branch",
																							balance:
																								result.balance -
																								(result.amount + result.fee),
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
	// Initiate transaction state
	const master_code = await txstate.initiate();

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
		async function (err, sender) {
			let result = errorMessage(
				err,
				sender,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				User.findOne(
					{
						mobile: receiverMobile,
					},
					(err, receiver) => {
						let result = errorMessage(
							err,
							receiver,
							"Receiver's wallet do not exist"
						);
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							Bank.findOne(
								{
									_id: sender.bank_id,
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
													const find = {
														bank_id: bank._id,
														trans_type: "Wallet to Wallet",
														status: 1,
														active: "Active",
													};
													Fee.findOne(find, function (err, rule) {
														let result = errorMessage(
															err,
															rule,
															"Revenue Rule Not Found"
														);
														if (result.status == 0) {
															res.status(200).json(result);
														} else {
															transfer = {
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
																		txstate.reported(master_code);
																		res.status(200).json({
																			status: 1,
																			message:
																				sending_amount +
																				" XOF is transferred to " +
																				receiver.name,
																			balance:
																				result.balance -
																				(result.amount + result.fee),
																		});
																	} else {
																		res.status(200).json(result);
																	}
																})
																.catch((err) => {
																	res.status(200).json(catchError(err));
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
