//services
const blockchain = require("../../../services/Blockchain.js");
const { calculateShare } = require("../../../routes/utils/calculateShare");
const execute = require("../../../controllers/transactions/services/execute");

//constants
const qname = require("../constants/queueName");
const categoryConst = require("../constants/category");
const childType = require("../constants/childType");

module.exports = async function (transfer, infra, bank, sender, rule1) {
	try {
		const senderWallet = sender.wallet_id;
		const bankEsWallet = bank.wallet_ids.escrow;
		const bankOpWallet = bank.wallet_ids.operational;

		// first transaction
		var amount = Number(transfer.amount);
		var fee = calculateShare("bank", transfer.amount, rule1);
		if (transfer.isInclusive) {
			amount = amount - fee;
		}

		var balance = await blockchain.getBalance(senderWallet);

		//Check balance first
		if (Number(balance) < amount + fee) {
			throw new Error("Not enough balance in user's wallet");
		}

		let master_code = transfer.master_code;

		let trans1 = [
			{
				from: senderWallet,
				to: bankEsWallet,
				amount: amount,
				note: "Transferred Money to " + transfer.receiverFamilyName,
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
		if (fee > 0) {
			trans1.push({
				from: senderWallet,
				to: bankOpWallet,
				amount: fee,
				note: "Bank Fee",
				email1: sender.email,
				email2: bank.email,
				mobile1: sender.mobile,
				mobile2: bank.mobile,
				from_name: sender.name,
				to_name: bank.name,
				sender_id: "",
				receiver_id: "",
				master_code: master_code,
				child_code: master_code + "2",
			});
		}

		result = await execute(trans1, categoryConst.MAIN);

		// return response
		if (result.status == 0) {
			return {
				status: 0,
				message: "Transaction failed!",
				blockchain_message: result.message,
			};
		}

		distributeRevenue(transfer, infra, bank, rule1);
		return {
			status: 1,
			message: "Transaction success!",
			blockchain_message: result.message,
			balance: balance,
			amount: amount,
			fee: fee,
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, infra, bank, rule1) {
	const bankOpWallet = bank.wallet_ids.operational;
	const infraOpWallet = bank.wallet_ids.infra_operational;

	var infraShare = calculateShare("infra", transfer.amount, rule1);

	if (infraShare.percentage_amount > 0) {
		let trans21 = [
			{
				from: bankOpWallet,
				to: infraOpWallet,
				amount: infraShare.percentage_amount,
				note:
					"Bank Send Infra Percentage amount for Inter Bank Wallet to Non Wallet transaction",
				email1: bank.email,
				email2: infra.email,
				mobile1: bank.mobile,
				mobile2: infra.mobile,
				from_name: bank.name,
				to_name: infra.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + "2.1",
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
				note:
					"Bank Send Infra Fixed amount for Inter Bank Non Wallet to Non Wallet transaction",
				email1: bank.email,
				email2: infra.email,
				mobile1: bank.mobile,
				mobile2: infra.mobile,
				from_name: bank.name,
				to_name: infra.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + "2.2",
			},
		];
		await execute(trans22);
	}
}
