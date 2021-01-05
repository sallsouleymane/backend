//services
const blockchain = require("../../../services/Blockchain.js");
const { calculateShare } = require("../../../routes/utils/calculateShare");

// transaction services
const txstate = require("../states");

module.exports = async function (
	transfer,
	infra,
	bank,
	branch,
	receiver,
	rule1
) {
	try {
		const branchOpWallet = branch.wallet_ids.operational;
		const receiverWallet = receiver.wallet_id;

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

		master_code = transfer.master_code;

		let trans = {
			from: branchOpWallet,
			to: receiverWallet,
			amount: amount,
			note: "Cashier Send Money",
			email1: branch.email,
			email2: receiver.email,
			mobile1: branch.mobile,
			mobile2: receiver.mobile,
			from_name: branch.name,
			to_name: receiver.name,
			user_id: "",
			master_code: master_code,
			child_code: master_code + "-s1",
			created_at: Date.now(),
		};

		let result = await blockchain.initiateTransfer(trans);

		// return response
		if (result.status == 0) {
			txstate.failed(transfer.master_code);
			return {
				status: 0,
				message: "Transaction failed!",
				blockchain_message: result.message,
			};
		}

		transfer.fee = fee;
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

		let res = await distributeRevenue(transfer, infra, bank, branch, rule1);
		if (res.status == 0) {
			return res;
		} else {
			return {
				status: 1,
				message: "Transaction success!",
				amount: amount,
				fee: fee,
				sendFee: sendFee,
			};
		}
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, infra, bank, branch, rule1) {
	const branchOpWallet = branch.wallet_ids.operational;
	const bankOpWallet = bank.wallet_ids.operational;
	const infraOpWallet = bank.wallet_ids.infra_operational;

	let fee = transfer.fee;
	let master_code = transfer.master_code;
	let allTxSuccess = true;

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
			user_id: "",
			master_code: master_code,
			child_code: master_code + "-s2",
			created_at: Date.now(),
		};

		let res = await blockchain.initiateTransfer(trans2);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}
	var infraShare = calculateShare("infra", transfer.amount, rule1);
	transfer.infraShare = infraShare;

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
			master_code: master_code,
			child_code: master_code + "-s3",
			created_at: Date.now(),
		};
		let res = await blockchain.initiateTransfer(trans21);
		if (res.status == 0) {
			allTxSuccess = false;
		}
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
			master_code: master_code,
			child_code: master_code + "-s4",
			created_at: Date.now(),
		};
		let res = await blockchain.initiateTransfer(trans22);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}
	if (fee > 0) {
		let trans4 = {
			from: bankOpWallet,
			to: branchOpWallet,
			amount: transfer.sendFee,
			note: "Bank Send Revenue Branch for Sending money",
			email1: bank.email,
			email2: branch.email,
			mobile1: bank.mobile,
			mobile2: branch.mobile,
			from_name: bank.name,
			to_name: branch.name,
			user_id: "",
			master_code: master_code,
			child_code: master_code + "-s5",
			created_at: Date.now(),
		};

		let res = await blockchain.initiateTransfer(trans4);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}
	if (allTxSuccess) {
		txstate.nearCompletion(master_code);
		let res = await transferToMasterWallets(transfer, infra, bank, branch);

		if (res.status == 1) {
			txstate.completed(master_code);
		}
		return res;
	} else {
		txstate.failed(transfer.master_code);
		return {
			status: 0,
			message: "Not all transactions are success, please check",
		};
	}
}

async function transferToMasterWallets(transfer, infra, bank, branch) {
	try {
		const bankOpWallet = bank.wallet_ids.operational;
		const bankMasterWallet = bank.wallet_ids.master;
		const infraOpWallet = bank.wallet_ids.infra_operational;
		const infraMasterWallet = bank.wallet_ids.infra_master;
		const branchOpWallet = branch.wallet_ids.operational;
		const branchMasterWallet = branch.wallet_ids.master;

		let master_code = transfer.master_code;

		let infraPart =
			transfer.infraShare.percentage_amount + transfer.infraShare.fixed_amount;
		let sendBranchPart = transfer.sendFee;
		let bankPart =
			transfer.fee - transfer.infraShare.percentage_amount - sendBranchPart;

		let txStatus = 1;

		let trans = {
			from: bankOpWallet,
			to: bankMasterWallet,
			amount: bankPart,
			note: "Bank share to its Master Wallet",
			email1: bank.email,
			mobile1: bank.mobile,
			from_name: bank.name,
			to_name: bank.name,
			user_id: "",
			master_code: master_code,
			child_code: master_code + "-m1",
			created_at: Date.now(),
		};
		let result = await blockchain.initiateTransfer(trans);
		if (result.status == 0) {
			txStatus = 0;
		}

		trans = {
			from: infraOpWallet,
			to: infraMasterWallet,
			amount: infraPart,
			note: "Infra share to its Master Wallet",
			email1: infra.email,
			mobile1: infra.mobile,
			from_name: infra.name,
			to_name: infra.name,
			user_id: "",
			master_code: master_code,
			child_code: master_code + "-m2",
			created_at: Date.now(),
		};
		result = await blockchain.initiateTransfer(trans);
		if (result.status == 0) {
			txStatus = 0;
		}

		trans = {
			from: branchOpWallet,
			to: branchMasterWallet,
			amount: sendBranchPart,
			note: "Sending Branch share to its Master Wallet",
			email1: branch.email,
			mobile1: branch.mobile,
			from_name: branch.name,
			to_name: branch.name,
			user_id: "",
			master_code: master_code,
			child_code: master_code + "-m3",
			created_at: Date.now(),
		};
		result = await blockchain.initiateTransfer(trans);
		if (result.status == 0) {
			txStatus = 0;
		}

		if (txStatus == 0) {
			txstate.failed(transfer.master_code);
			return {
				status: 0,
				message: "Not all master wallet transfer is success",
			};
		} else {
			return { status: 1 };
		}
	} catch (err) {
		throw err;
	}
}
