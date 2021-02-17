//services
// const state = require("./transactions/state");
const blockchain = require("../../../services/Blockchain.js");
const { calculateShare } = require("../../../routes/utils/calculateShare");
const execute = require("../services/execute.js");
const qname = require("../queueName");

module.exports = async function (transfer, infra, bank, branch, rule1) {
	try {
		const branchOpWallet = branch.wallet_ids.operational;
		const bankEsWallet = bank.wallet_ids.escrow;

		// calculate amount to transfer
		var amount = Number(transfer.amount);
		var fee = calculateShare("bank", transfer.amount, rule1);
		transfer.fee = fee;
		if (transfer.isInclusive) {
			amount = amount - fee;
		}

		// Check balance
		var balance = await blockchain.getBalance(branchOpWallet);

		// Check balance first
		if (Number(balance) < amount + fee) {
			return {
				status: 0,
				message: "Not enough balance in branch operational wallet",
			};
		}

		master_code = transfer.master_code;

		let trans = {
			from: branchOpWallet,
			to: bankEsWallet,
			amount: amount,
			note: "Cashier Send Money to Non Wallet",
			email1: branch.email,
			email2: bank.email,
			mobile1: branch.mobile,
			mobile2: bank.mobile,
			from_name: branch.name,
			to_name: bank.name,
			sender_id: transfer.cashierId,
			receiver_id: bank._id,
			master_code: master_code,
			child_code: master_code + "-s1",
			created_at: new Date(),
		};

		let res = await execute(trans);

		// return response
		if (res.status == 0) {
			return {
				status: 0,
				message: "Transaction failed! - " + res.message,
			};
		}

		var sendFee = 0;
		if (fee > 0) {
			sendFee = calculateShare(
				transfer.senderType,
				transfer.amount,
				rule1,
				{},
				transfer.senderCode
			);
			transfer.sendFee = sendFee;
		}

		distributeRevenue(transfer, infra, bank, branch, rule1);
		return {
			status: 1,
			message: "Transaction success!",
			amount: amount,
			fee: fee,
			sendFee: sendFee,
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, infra, bank, branch, rule1) {
	const branchOpWallet = branch.wallet_ids.operational;
	const bankOpWallet = bank.wallet_ids.operational;
	const infraOpWallet = bank.wallet_ids.infra_operational;

	fee = transfer.fee;

	if (fee > 0) {
		let trans = {
			from: branchOpWallet,
			to: bankOpWallet,
			amount: fee,
			note: "Cashier Send Fee for Non Wallet to Non Wallet Transaction",
			email1: branch.email,
			email2: bank.email,
			mobile1: branch.mobile,
			mobile2: bank.mobile,
			from_name: branch.name,
			to_name: bank.name,
			sender_id: transfer.cashierId,
			receiver_id: bank._id,
			master_code: transfer.master_code,
			child_code: transfer.master_code + "-s2",
			created_at: new Date(),
		};

		execute(trans, qname.fee);
	}

	var infraShare = calculateShare("infra", transfer.amount, rule1);

	if (infraShare.percentage_amount > 0) {
		trans = {
			from: bankOpWallet,
			to: infraOpWallet,
			amount: infraShare.percentage_amount,
			note:
				"Bank Send Infra Percentage amount for Non Wallet to Non Wallet transaction",
			email1: bank.email,
			email2: infra.email,
			mobile1: bank.mobile,
			mobile2: infra.mobile,
			from_name: bank.name,
			to_name: infra.name,
			sender_id: bank._id,
			receiver_id: infra._id,
			master_code: transfer.master_code,
			child_code: transfer.master_code + "-s3",
			created_at: new Date(),
		};
		execute(trans, qname.infra_percent);
	}

	if (infraShare.fixed_amount > 0) {
		trans = {
			from: bankOpWallet,
			to: infraOpWallet,
			amount: infraShare.fixed_amount,
			note:
				"Bank Send Infra Fixed amount for Inter Bank Wallet to Non Wallet transaction",
			email1: bank.email,
			email2: infra.email,
			mobile1: bank.mobile,
			mobile2: infra.mobile,
			from_name: bank.name,
			to_name: infra.name,
			sender_id: bank._id,
			receiver_id: infra._id,
			master_code: transfer.master_code,
			child_code: transfer.master_code + "-s4",
			created_at: new Date(),
		};
		execute(trans, qname.infra_fixed);
	}

	if (fee > 0) {
		trans = {
			from: bankOpWallet,
			to: branchOpWallet,
			amount: transfer.sendFee,
			note:
				"Bank Send Revenue Share for Sending Money for Inter Bank Non Wallet to Non Wallet transaction",
			email1: bank.email,
			email2: branch.email,
			mobile1: bank.mobile,
			mobile2: branch.mobile,
			from_name: bank.name,
			to_name: branch.name,
			sender_id: bank._id,
			receiver_id: transfer.cashierId,
			master_code: transfer.master_code,
			child_code: transfer.master_code + "-s5",
			created_at: new Date(),
		};

		execute(trans, qname.send_fee);
	}
}
