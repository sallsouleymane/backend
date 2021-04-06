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
const Bank = require("../../models/Bank");
const Infra = require("../../models/Infra");
const Fee = require("../../models/Fee");
const CashierSend = require("../../models/CashierSend");

// transactions
const txstate = require("../transactions/services/states");
const walletToWallet = require("../transactions/interBank/walletToWallet");
const walletToCashier = require("../transactions/interBank/walletToCashier");

//constants
const categoryConst = require("../transactions/constants/category");

module.exports.sendMoneyToNonWallet = function (req, res) {
	const username = req.sign_creds.username;

	const {
		receiverMobile,
		receiverGivenName,
		receiverFamilyName,
		receiverCountry,
		receiverEmail,
		receiverIdentificationAmount,
		isInclusive,
	} = req.body;

	var master_code;

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
			let result1 = errorMessage(err, sender, "Sender not found");
			if (result1.status == 0) {
				res.status(200).json(result1);
			} else {
				// Initiate transaction
				master_code = await txstate.initiate(
					categoryConst.MAIN,
					sender.bank_id,
					"Inter Bank Wallet To Non Wallet"
				);
				var receiver = {
					name: receiverGivenName,
					last_name: receiverFamilyName,
					mobile: receiverMobile,
					email: receiverEmail,
					country: receiverCountry,
				};
				try {
					const bank = await Bank.findOne({
						_id: sender.bank_id,
					});
					if (bank == null) {
						throw new Error("Bank not found");
					}

					const infra = await Infra.findOne({
						_id: bank.user_id,
					});
					if (infra == null) {
						throw new Error("Infra not found");
					}
					const find = {
						bank_id: bank._id,
						type: "IBWNW",
						status: 1,
						active: 1,
					};
					const rule = await InterBankRule.findOne(find);
					if (rule == null) {
						throw new Error("Rule not found");
					}

					req.body.givenname = sender.name;
					req.body.familyname = sender.last_name;
					req.body.senderIdentificationCountry = "";
					req.body.senderIdentificationType = sender.id_type;
					req.body.senderIdentificationNumber = sender.id_number;
					req.body.senderIdentificationValidTill = sender.valid_till;
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
					addCashierSendRecord(req.body, otherInfo, async (err, cs) => {
						if (err) {
							res.status(200).json(catchError(err));
						} else {
							var transfer = {
								master_code: master_code,
								amount: receiverIdentificationAmount,
								isInclusive: isInclusive,
								receiverFamilyName: receiverFamilyName,
							};
							var result = await walletToCashier(
								transfer,
								infra,
								bank,
								sender,
								rule
							);
							console.log("Result: " + result);
							if (result.status != 0) {
								let content = "Your Transaction Code is " + transactionCode;
								if (receiverMobile && receiverMobile != null) {
									sendSMS(content, receiverMobile);
								}
								if (receiverEmail && receiverEmail != null) {
									sendMail(content, "Transaction Code", receiverEmail);
								}

								const caSend = await CashierSend.findByIdAndUpdate(cs._id, {
									status: 1,
									fee: result.fee,
								});
								if (caSend == null) {
									throw new Error("Cashier send record not found");
								}

								NWUser.create(receiver);
								await txstate.waitingForCompletion(
									categoryConst.MAIN,
									master_code
								);
								res.status(200).json({
									status: 1,
									message:
										receiverIdentificationAmount +
										" XOF is transferred to branch",
									balance: result.balance - (result.amount + result.fee),
								});
							} else {
								txstate.failed(categoryConst.MAIN, master_code);
								res.status(200).json({
									status: 0,
									message: result.toString(),
								});
							}
						}
					});
				} catch (err) {
					txstate.failed(categoryConst.MAIN, master_code);
					console.log(err);
					var message = err.toString();
					if (err.message) {
						message = err.message;
					}
					res.status(200).json({ status: 0, message: message });
				}
			}
		}
	);
};

module.exports.sendMoneyToWallet = async function (req, res) {
	const username = req.sign_creds.username;

	const { receiverMobile, note, sending_amount, isInclusive } = req.body;
	var master_code;

	try {
		const sender = await User.findOneAndUpdate(
			{
				username,
				status: 1,
			},
			{
				$addToSet: {
					contact_list: receiverMobile,
				},
			}
		);
		if (sender == null) {
			throw new Error(
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
		}

		// Initiate transaction
		master_code = await txstate.initiate(
			categoryConst.MAIN,
			sender.bank_id,
			"Inter Bank Wallet To Wallet"
		);

		const receiver = await User.findOne({
			mobile: receiverMobile,
		});
		if (receiver == null) {
			throw new Error("Receiver's wallet do not exist");
		}

		const bank = await Bank.findOne({
			_id: sender.bank_id,
		});
		if (bank == null) {
			throw new Error("Bank Not Found");
		}

		const receiverBank = await Bank.findOne({ _id: receiver.bank_id });
		if (receiverBank == null) {
			throw new Error("Receiver Bank Not Found");
		}

		const infra = await Infra.findOne({
			_id: bank.user_id,
		});
		if (infra == null) {
			throw new Error("Infra Not Found");
		}
		const find = {
			bank_id: bank._id,
			type: "IBWW",
			status: 1,
			active: 1,
		};
		const rule1 = await InterBankRule.findOne(find);
		if (rule1 == null) {
			throw new Error("Inter Bank Rule Not Found");
		}

		const transfer = {
			master_code: master_code,
			amount: sending_amount,
			isInclusive: isInclusive,
			note: note,
		};
		const result1 = await walletToWallet(
			transfer,
			infra,
			bank,
			receiverBank,
			sender,
			receiver,
			rule1
		);
		console.log("Result: " + result1);
		if (result1.status == 1) {
			await txstate.completed(categoryConst.MAIN, master_code);
			res.status(200).json({
				status: 1,
				message: sending_amount + " XOF is transferred to " + receiver.name,
				balance: result1.balance - (result1.amount + result1.fee),
			});
		} else {
			res.status(200).json({
				status: 0,
				message: result1.toString(),
			});
		}
	} catch (err) {
		txstate.failed(categoryConst.MAIN, master_code);
		console.log(err);
		var message = err.toString();
		if (err && err.message) {
			message = err.message;
		}
		res.status(200).json({
			status: 0,
			message: message,
		});
	}
};
