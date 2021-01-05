//services
// const state = require("./transactions/state");
const blockchain = require("../../../services/Blockchain.js");
const { calculateShare } = require("../../utils/calculateShare");
const txstate = require("../states");

module.exports = async function (transfer, infra, bank, branch, rule1) {
	try {
		const branchOpWallet = branch.wallet_ids.operational;
		const bankEsWallet = bank.wallet_ids.escrow;

		// calculate amount to transfer
		var amount = Number(transfer.amount);
		var fee = calculateShare("bank", transfer.amount, rule1);
		if (transfer.isInclusive) {
			amount = amount - fee;
		}

		// Check balance
		var balance = await blockchain.getBalance(branchOpWallet);

		// Check balance first
		if (Number(balance) + Number(branch.credit_limit) < amount + fee) {
			return {
				status: 0,
				message: "Not enough balance in branch operational wallet",
			};
		}

		master_code = transfer.master_code;
		let childId = 1;

		let trans1 = {
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
			user_id: "",
			master_code: master_code,
			child_code: master_code + "-s" + childId++,
			master: true,
		};

		var result = await blockchain.initiateTransfer(trans1);

		// return response
		if (result.status == 0) {
			return {
				status: 0,
				message: "Transaction failed!",
				blockchain_message: result.message,
			};
		}

		transfer.fee = fee;
		var sendingBranchShare = 0;
		if (fee > 0) {
			sendingBranchShare = calculateShare(
				"sendBranch",
				transfer.amount,
				rule1,
				{},
				branch.bcode
			);
			transfer.sendingBranchShare = sendingBranchShare;
		}

		// transfer.master_code = master_code;
		transfer.childId = childId;
		distributeRevenue(transfer, infra, bank, branch, rule1);
		return {
			status: 1,
			message: "Transaction success!",
			blockchain_message: result.message,
			amount: amount,
			fee: fee,
			sendFee: sendingBranchShare,
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, infra, bank, branch, rule1) {
	const branchOpWallet = branch.wallet_ids.operational;
	const bankOpWallet = bank.wallet_ids.operational;
	const infraOpWallet = bank.wallet_ids.infra_operational;

	var childId = transfer.childId;
	var infraShare = calculateShare("infra", transfer.amount, rule1);
	let txStatus = 1;

	let fee = transfer.fee;
	if (fee > 0) {
		let trans2 = {
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
			user_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + "-s" + childId++,
		};

		let result = await blockchain.initiateTransfer(trans2);
		if (result.status == 0) {
			txStatus = 0;
		}
	}

	if (infraShare.percentage_amount > 0) {
		let trans21 = {
			from: bankOpWallet,
			to: infraOpWallet,
			amount: infraShare.percentage_amount,
			note:
				"Bank Send Infra Percentage amount for Inter Bank Non Wallet to Non Wallet transaction",
			email1: bank.email,
			email2: infra.email,
			mobile1: bank.mobile,
			mobile2: infra.mobile,
			from_name: bank.name,
			to_name: infra.name,
			user_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + "-s" + childId++,
		};
		let result = await blockchain.initiateTransfer(trans21);
		if (result.status == 0) {
			txStatus = 0;
		}
	}

	if (infraShare.fixed_amount > 0) {
		let trans22 = {
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
			user_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + "-s" + childId++,
		};
		let result = await blockchain.initiateTransfer(trans22);
		if (result.status == 0) {
			txStatus = 0;
		}
	}

	if (transfer.fee > 0) {
		let trans4 = {
			from: bankOpWallet,
			to: branchOpWallet,
			amount: transfer.sendingBranchShare,
			note:
				"Bank Send Revenue Share for Sending Money for Inter Bank Non Wallet to Non Wallet transaction",
			email1: bank.email,
			email2: branch.email,
			mobile1: bank.mobile,
			mobile2: branch.mobile,
			from_name: bank.name,
			to_name: branch.name,
			user_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + "-s" + childId++,
		};

		let result = await blockchain.initiateTransfer(trans4);
		if (result.status == 0) {
			txStatus = 0;
		}
	}

	if (txStatus == 0) {
		txstate.failed(transfer.master_code);
	}
}
