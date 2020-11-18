//services
const blockchain = require("../../../services/Blockchain.js");
const {
	getTransactionCode,
	calculateShare,
} = require("../../utils/calculateShare");

module.exports = async function (
	transfer,
	sendingBank,
	bank,
	branch,
	rule1,
	rule2
) {
	try {
		const senderBankEsWallet = sendingBank.wallet_ids.escrow;
		const branchOpWallet = branch.wallet_ids.operational;
		const bankOpWallet = bank.wallet_ids.operational;

		var amount = Number(transfer.amount);
		var fee = calculateShare("bank", transfer.amount, rule1);
		if (transfer.isInclusive) {
			amount = amount - fee;
		}

		let master_code = getTransactionCode(sendingBank.mobile, branch.mobile);

		let trans = {
			from: senderBankEsWallet,
			to: bankOpWallet,
			amount: amount,
			note: "Cashier claim Money for Inter Bank transaction",
			email1: sendingBank.email,
			email2: bank.email,
			mobile1: sendingBank.mobile,
			mobile2: bank.mobile,
			from_name: sendingBank.name,
			to_name: bank.name,
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

		let trans = {
			from: bankOpWallet,
			to: branchOpWallet,
			amount: amount,
			note: "Cashier claim Money for Inter Bank transaction",
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
		claimerBankShare = calculateShare("claimBank", transfer.amount, rule1);
		transfer.claimerBankShare = claimerBankShare;
		transfer.fee = fee;
		distributeRevenue(transfer, sendingBank, bank, branch, rule1, rule2);

		return {
			status: 1,
			message: "Transaction success!",
			blockchain_message: result.message,
			claimFee: claimerBranchShare,
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(
	transfer,
	sendingBank,
	bank,
	branch,
	rule1,
	rule2
) {
	const branchOpWallet = branch.wallet_ids.operational;
	const bankOpWallet = bank.wallet_ids.operational;
	const senderBankOpWallet = sendingBank.wallet_ids.operational;

	let claimerBankShare = transfer.claimerBankShare;
	let fee = transfer.fee;

	if (claimerBankShare.percentage_amount > 0) {
		let trans2 = {
			from: senderBankOpWallet,
			to: bankOpWallet,
			amount: claimerBankShare.percentage_amount,
			note: "Claiming Bank's Share for Inter Bank transaction",
			email1: sendingBank.email,
			email2: bank.email,
			mobile1: sendingBank.mobile,
			mobile2: bank.mobile,
			from_name: sendingBank.name,
			to_name: bank.name,
			user_id: "",
			master_code: master_code,
			child_code: master_code + "1.1",
		};

		await blockchain.initiateTransfer(trans2);
	}

	if (claimerBankShare.fixed_amount > 0) {
		let trans2 = {
			from: senderBankOpWallet,
			to: bankOpWallet,
			amount: claimerBankShare.fixed_amount,
			note: "Claiming Bank's fixed Share for Inter Bank transaction",
			email1: sendingBank.email,
			email2: bank.email,
			mobile1: sendingBank.mobile,
			mobile2: bank.mobile,
			from_name: sendingBank.name,
			to_name: bank.name,
			user_id: "",
			master_code: master_code,
			child_code: master_code + "1.2",
		};

		await blockchain.initiateTransfer(trans2);
	}

	var claimerBranchShare = 0;
	if (fee > 0) {
		claimerBranchShare = calculateShare(
			"claimBranch",
			transfer.amount,
			rule1,
			rule2,
			branch.bcode
		);
		let trans3 = {
			from: bankOpWallet,
			to: branchOpWallet,
			amount: claimerBranchShare,
			note: "Claim Revenue for Inter Bank transaction",
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
