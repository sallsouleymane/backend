//services
const blockchain = require("../../../services/Blockchain.js");
const {
	getTransactionCode,
	calculateShare,
} = require("../../utils/calculateShare");

module.exports = async function (transfer, bank, branch, rule1) {
	try {
		const bankEsWallet = bank.wallet_ids.escrow;
		const branchOpWallet = branch.wallet_ids.operational;

		var amount = Number(transfer.amount);
		var fee = calculateShare("bank", transfer.amount, rule1);
		if (transfer.isInclusive) {
			amount = amount - fee;
		}

		let master_code = getTransactionCode(bank.mobile, branch.mobile);

		let trans = {
			from: bankEsWallet,
			to: branchOpWallet,
			amount: amount,
			note: "Cashier claim Money",
			email1: bank.email,
			email2: branch.email,
			mobile1: bank.mobile,
			mobile2: branch.mobile,
			from_name: bank.name,
			to_name: branch.name,
			user_id: "",
			master_code: master_code,
			child_code: master_code,
		};

		let result = await blockchain.initiateTransfer(trans);

		// return response
		if (result.status == 0) {
			return {
				status: 0,
				message: "Transaction failed!",
				blockchain_message: result.message,
			};
		}

		var claimerBranchShare = 0;
		if (fee > 0) {
			claimerBranchShare = calculateShare(
				"claimBranch",
				transfer.amount,
				rule1,
				{},
				branch.code
			);
		}
		transfer.fee = fee;
		transfer.claimerBranchShare = claimerBranchShare;
		transfer.master_code = master_code;
		distributeRevenue(transfer, bank, branch);

		return {
			status: 1,
			message: "Transaction success!",
			blockchain_message: result.message,
			amount: amount,
			claimFee: claimerBranchShare,
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, bank, branch) {
	const branchOpWallet = branch.wallet_ids.operational;
	const bankOpWallet = bank.wallet_ids.operational;

	let fee = transfer.fee;
	let master_code = transfer.master_code;

	if (fee > 0) {
		let trans3 = {
			from: bankOpWallet,
			to: branchOpWallet,
			amount: transfer.claimerBranchShare,
			note: "Claim Revenue",
			email1: bank.email,
			email2: branch.email,
			mobile1: bank.mobile,
			mobile2: branch.mobile,
			from_name: bank.name,
			to_name: branch.name,
			user_id: "",
			master_code: master_code,
			child_code: master_code + "2",
		};
		await blockchain.initiateTransfer(trans3);
	}
}
