//services
const blockchain = require("../../../services/Blockchain.js");
const {
	getTransactionCode,
	calculateShare,
} = require("../../utils/calculateShare");

module.exports = async function (
	transfer,
	infra,
	bank,
	receiverBank,
	branch,
	receiver,
	rule1,
	rule2
) {
	try {
		const branchOpWallet = branch.wallet_ids.operational;
		const receiverWallet = receiver.wallet_id;
		const bankOpWallet = bank.wallet_ids.operational;
		const receiverBankOpWallet = receiverBank.wallet_ids.operational;

		// first transaction
		var amount = Number(transfer.amount);
		var fee = calculateShare("bank", transfer.amount, rule1);
		if (transfer.isInclusive) {
			amount = amount - fee;
		}

		var balance = await blockchain.getBalance(branchOpWallet);

		//Check balance first
		if (Number(balance) + Number(branch.credit_limit) < amount + fee) {
			throw new Error("Not enough balance in branch operational wallet");
		}

		let master_code = getTransactionCode(branch.mobile, receiver.mobile);

		let trans = {
			from: branchOpWallet,
			to: bankOpWallet,
			amount: amount,
			note: "Cashier Send Money",
			email1: branch.email,
			email2: bank.email,
			mobile1: branch.mobile,
			mobile2: bank.mobile,
			from_name: branch.name,
			to_name: bank.name,
			user_id: transfer.cashierId,
			master_code: master_code,
			child_code: master_code + "1",
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

		trans = {
			from: bankOpWallet,
			to: receiverBankOpWallet,
			amount: amount,
			note: "Sender's Bank transfer Money",
			email1: bank.email,
			email2: receiverBank.email,
			mobile1: bank.mobile,
			mobile2: receiverBank.mobile,
			from_name: bank.name,
			to_name: receiverBank.name,
			user_id: "",
			master_code: master_code,
			child_code: master_code + "1",
		};

		result = await blockchain.initiateTransfer(trans);

		// return response
		if (result.status == 0) {
			return {
				status: 0,
				message: "Transaction failed!",
				blockchain_message: result.message,
			};
		}

		trans = {
			from: receiverBankOpWallet,
			to: receiverWallet,
			amount: amount,
			note: "Bank Send Money",
			email1: receiverBank.email,
			email2: receiver.email,
			mobile1: receiverBank.mobile,
			mobile2: receiver.mobile,
			from_name: receiverBank.name,
			to_name: receiver.name,
			user_id: "",
			master_code: master_code,
			child_code: master_code + "1",
		};

		result = await blockchain.initiateTransfer(trans);

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
				rule2,
				branch.bcode
			);
			transfer.sendingBranchShare = sendingBranchShare;
		}

		transfer.master_code = master_code;
		distributeRevenue(transfer, infra, bank, receiverBank, branch, rule1);
		return {
			status: 1,
			message: "Transaction success!",
			blockchain_message: result.message,
			amount: amount,
			fee: fee,
			sendFee: sendingBranchShare,
			master_code: master_code,
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
	branch,
	rule1
) {
	const branchOpWallet = branch.wallet_ids.operational;
	const bankOpWallet = bank.wallet_ids.operational;
	const receiverBankOpWallet = receiverBank.wallet_ids.operational;
	const infraOpWallet = bank.wallet_ids.infra_operational;

	let fee = transfer.fee;
	if (fee > 0) {
		let trans2 = {
			from: branchOpWallet,
			to: bankOpWallet,
			amount: fee,
			note: "Cashier Send Bank Fee",
			email1: branch.email,
			email2: bank.email,
			mobile1: branch.mobile,
			mobile2: bank.mobile,
			from_name: branch.name,
			to_name: bank.name,
			user_id: transfer.cashierId,
			master_code: transfer.master_code,
			child_code: transfer.master_code + "2",
		};

		await blockchain.initiateTransfer(trans2);
	}
	var infraShare = calculateShare("infra", transfer.amount, rule1);

	if (infraShare.percentage_amount > 0) {
		let trans21 = {
			from: bankOpWallet,
			to: infraOpWallet,
			amount: infraShare.percentage_amount,
			note: "Cashier Send percentage Infra Fee",
			email1: bank.email,
			email2: infra.email,
			mobile1: bank.mobile,
			mobile2: infra.mobile,
			from_name: bank.name,
			to_name: infra.name,
			user_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + "3.1",
		};
		await blockchain.initiateTransfer(trans21);
	}

	if (infraShare.fixed_amount > 0) {
		let trans22 = {
			from: bankOpWallet,
			to: infraOpWallet,
			amount: infraShare.fixed_amount,
			note: "Cashier Send fixed Infra Fee",
			email1: bank.email,
			email2: infra.email,
			mobile1: bank.mobile,
			mobile2: infra.mobile,
			from_name: bank.name,
			to_name: infra.name,
			user_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + "3.2",
		};
		await blockchain.initiateTransfer(trans22);
	}

	claimerBankShare = calculateShare("claimBank", transfer.amount, rule1);
	if (claimerBankShare.percentage_amount > 0) {
		let trans2 = {
			from: bankOpWallet,
			to: receiverBankOpWallet,
			amount: claimerBankShare.percentage_amount,
			note: "Claiming Bank's Share for Inter Bank transaction",
			email1: bank.email,
			email2: receiverBank.email,
			mobile1: bank.mobile,
			mobile2: receiverBank.mobile,
			from_name: bank.name,
			to_name: receiverBank.name,
			user_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + "4.1",
		};

		await blockchain.initiateTransfer(trans2);
	}

	if (claimerBankShare.fixed_amount > 0) {
		let trans2 = {
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
			user_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + "4.2",
		};

		await blockchain.initiateTransfer(trans2);
	}

	if (fee > 0) {
		let trans4 = {
			from: bankOpWallet,
			to: branchOpWallet,
			amount: transfer.sendingBranchShare,
			note: "Bank Send Revenue Branch for Sending money",
			email1: bank.email,
			email2: branch.email,
			mobile1: bank.mobile,
			mobile2: branch.mobile,
			from_name: bank.name,
			to_name: branch.name,
			user_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + "5",
		};

		await blockchain.initiateTransfer(trans4);
	}
}
