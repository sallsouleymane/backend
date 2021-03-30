//services
const blockchain = require("../../../services/Blockchain.js");
const { calculateShare } = require("../../../routes/utils/calculateShare");
const execute = require("../../../controllers/transactions/services/execute");

//constants
const qname = require("../constants/queueName");
const categoryConst = require("../constants/category");
const childType = require("../constants/childType");

module.exports = async function (
	transfer,
	infra,
	bank,
	receiverBank,
	sender,
	receiver,
	rule1
) {
	try {
		const senderWallet = sender.wallet_id;
		const receiverWallet = receiver.wallet_id;
		const bankOpWallet = bank.wallet_ids.operational;
		const receiverBankOpWallet = receiverBank.wallet_ids.operational;

		// first transaction
		var amount = Number(transfer.amount);

		var fee = calculateShare("bank", transfer.amount, rule1);
		if (transfer.isInclusive) {
			amount = amount - fee;
		}

		var balance = await blockchain.getBalance(senderWallet);

		//Check balance first
		if (Number(balance) < amount + fee) {
			throw new Error("Not enough balance in your wallet");
		}

		let master_code = transfer.master_code;

		let trans1 = [
			{
				from: senderWallet,
				to: bankOpWallet,
				amount: amount,
				note: "Transfer from " + sender.name + " to " + receiver.name,
				email1: sender.email,
				email2: bank.email,
				mobile1: sender.mobile,
				mobile2: bank.mobile,
				from_name: sender.name,
				to_name: bank.name,
				sender_id: "",
				receiver_id: "",
				master_code: master_code,
				child_code: master_code + "1",
			},
		];

		trans1.push({
			from: bankOpWallet,
			to: receiverBankOpWallet,
			amount: amount,
			note: "Transfer from " + sender.name + " to " + receiver.name,
			email1: bank.email,
			email2: receiverBank.email,
			mobile1: bank.mobile,
			mobile2: receiverBank.mobile,
			from_name: bank.name,
			to_name: receiverBank.name,
			sender_id: "",
			receiver_id: "",
			master_code: master_code,
			child_code: master_code + "1",
		});

		trans1.push({
			from: receiverBankOpWallet,
			to: receiverWallet,
			amount: amount,
			note: "Transfer from " + sender.name + " to " + receiver.name,
			email1: receiverBank.email,
			email2: receiver.email,
			mobile1: receiverBank.mobile,
			mobile2: receiver.mobile,
			from_name: receiverBank.name,
			to_name: receiver.name,
			sender_id: "",
			receiver_id: "",
			master_code: master_code,
			child_code: master_code + "1",
		});

		result = await execute(trans1, categoryConst.MAIN);

		// return response
		if (result.status == 0) {
			return {
				status: 0,
				message: "Transaction failed!",
				blockchain_message: result.message,
			};
		}

		transfer.fee = fee;
		transfer.master_code = master_code;
		distributeRevenue(transfer, infra, bank, receiverBank, sender, rule1);
		return {
			status: 1,
			message: "Transaction success!",
			blockchain_message: result.message,
			amount: amount,
			fee: fee,
			balance: balance,
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(
	transfer,
	infra,
	bank,
	receiverBank,
	sender,
	rule1
) {
	const senderWallet = sender.wallet_id;
	const bankOpWallet = bank.wallet_ids.operational;
	const infraOpWallet = bank.wallet_ids.infra_operational;
	const receiverBankOpWallet = receiverBank.wallet_ids.operational;

	if (transfer.fee > 0) {
		let trans2 = [
			{
				from: senderWallet,
				to: bankOpWallet,
				amount: transfer.fee,
				note: "Bank Inter Bank Fee",
				email1: sender.email,
				email2: bank.email,
				mobile1: sender.mobile,
				mobile2: bank.mobile,
				from_name: sender.name,
				to_name: bank.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + "2",
			},
		];

		await execute(trans2);
	}

	var infraShare = calculateShare("infra", transfer.amount, rule1);

	if (infraShare.percentage_amount > 0) {
		let trans21 = [
			{
				from: bankOpWallet,
				to: infraOpWallet,
				amount: infraShare.percentage_amount,
				note: "Infra Percentage Fee for Inter Bank transaction",
				email1: bank.email,
				email2: infra.email,
				mobile1: bank.mobile,
				mobile2: infra.mobile,
				from_name: bank.name,
				to_name: infra.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + "3.1",
			},
		];
		await execute(trans21);
	}

	if (infraShare.fixed_amount > 0) {
		let trans22 = [
			{
				from: bankOpWallet,
				to: infraOpWallet,
				amount: infraShare.fixed_amount,
				note: "Infra Fixed Fee for Inter Bank transaction",
				email1: bank.email,
				email2: infra.email,
				mobile1: bank.mobile,
				mobile2: infra.mobile,
				from_name: bank.name,
				to_name: infra.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + "3.2",
			},
		];
		await execute(trans22);
	}
	claimerBankShare = calculateShare("claimBank", transfer.amount, rule1);
	if (claimerBankShare.percentage_amount > 0) {
		let trans2 = [
			{
				from: bankOpWallet,
				to: receiverBankOpWallet,
				amount: claimerBankShare.percentage_amount,
				note: "Claiming Bank's Percentage Share for Inter Bank transaction",
				email1: bank.email,
				email2: receiverBank.email,
				mobile1: bank.mobile,
				mobile2: receiverBank.mobile,
				from_name: bank.name,
				to_name: receiverBank.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + "4.1",
			},
		];

		await execute(trans2);
	}

	if (claimerBankShare.fixed_amount > 0) {
		let trans2 = [
			{
				from: bankOpWallet,
				to: receiverBankOpWallet,
				amount: claimerBankShare.fixed_amount,
				note: "Claiming Bank's Fixed Share for Inter Bank transaction",
				email1: bank.email,
				email2: receiverBank.email,
				mobile1: bank.mobile,
				mobile2: receiverBank.mobile,
				from_name: bank.name,
				to_name: receiverBank.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + "4.2",
			},
		];

		await execute(trans2);
	}
}
