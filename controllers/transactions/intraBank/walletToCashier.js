//services
const blockchain = require("../../../services/Blockchain.js");
const {
	getTransactionCode,
	calculateShare,
} = require("../../../routes/utils/calculateShare");
const execute = require("../services/execute.js");
const queueName = require("../constants/queueName.js");

module.exports = async function (transfer, infra, bank, sender, rule) {
	try {
		const senderWallet = sender.wallet_id;
		const bankEsWallet = bank.wallet_ids.escrow;
		const bankOpWallet = bank.wallet_ids.operational;

		transfer = getAllShares(transfer, rule);

		var balance = await blockchain.getBalance(senderWallet);

		//Check balance first
		if (Number(balance) < transfer.exclusiveAmount + transfer.fee) {
			throw new Error("Not enough balance in user's wallet");
		}

		let trans = [
			{
				from: senderWallet,
				to: bankEsWallet,
				amount: transfer.amount,
				note: "Transferred Money to " + transfer.receiverFamilyName,
				email1: sender.email,
				email2: bank.email,
				mobile1: sender.mobile,
				mobile2: bank.mobile,
				from_name: sender.name,
				to_name: bank.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + "-s1",
				created_at: new Date(),
			},
		];

		if (transfer.fee > 0) {
			trans.push([
				{
					from: senderWallet,
					to: bankOpWallet,
					amount: transfer.fee,
					note: "Bank Fee",
					email1: sender.email,
					email2: bank.email,
					mobile1: sender.mobile,
					mobile2: bank.mobile,
					from_name: sender.name,
					to_name: bank.name,
					sender_id: "",
					receiver_id: "",
					master_code: transfer.master_code,
					child_code: transfer.master_code + "-s2",
					created_at: new Date(),
				},
			]);
		}

		var result = await execute(trans);

		// return response
		if (result.status == 0) {
			return {
				status: 0,
				message: "Transaction failed!",
				blockchain_message: result.message,
			};
		}

		distributeRevenue(transfer, infra, bank);
		return {
			status: 1,
			message: "Transaction success!",
			balance: balance,
			amount: transfer.exclusiveAmount,
			fee: transfer.fee,
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, infra, bank) {
	const bankOpWallet = bank.wallet_ids.operational;
	const infraOpWallet = bank.wallet_ids.infra_operational;

	if (transfer.infraShare.percentage_amount > 0) {
		let trans21 = [
			{
				from: bankOpWallet,
				to: infraOpWallet,
				amount: transfer.infraShare.percentage_amount,
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
				child_code: transfer.master_code + "-s3",
				created_at: new Date(),
			},
		];
		execute(trans21, queueName.infra_percent);
	}

	if (transfer.infraShare.fixed_amount > 0) {
		let trans22 = [
			{
				from: bankOpWallet,
				to: infraOpWallet,
				amount: transfer.infraShare.fixed_amount,
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
				child_code: transfer.master_code + "-s4",
				created_at: new Date(),
			},
		];
		execute(trans22, queueName.infra_fixed);
	}
}

function getAllShares(transfer, rule) {
	let amount = transfer.amount;
	let exclusiveAmount = amount;
	var fee = calculateShare("bank", amount, rule);
	if (transfer.isInclusive) {
		exclusiveAmount = amount - fee;
	}
	let infraShare = calculateShare("infra", amount, rule);

	transfer.exclusiveAmount = exclusiveAmount;
	transfer.fee = fee;
	transfer.infraShare = infraShare;
	return transfer;
}
