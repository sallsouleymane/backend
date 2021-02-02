//services
const blockchain = require("../../../services/Blockchain.js");
const {
	getTransactionCode,
	calculateShare,
} = require("../../../routes/utils/calculateShare");

// transaction services
const txstate = require("../services/states");
const execute = require("../services/execute.js");

module.exports = async function (
	transfer,
	infra,
	bank,
	sender,
	receiver,
	rule1
) {
	try {
		const senderWallet = sender.wallet_id;
		const receiverWallet = receiver.wallet_id;
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
			throw new Error("Not enough balance in your wallet");
		}

		let master_code = transfer.master_code;
		let trans1 = {
			from: senderWallet,
			to: receiverWallet,
			amount: amount,
			note:
				"Transfer from " +
				sender.name +
				" to " +
				receiver.name +
				": " +
				transfer.note,
			email1: sender.email,
			email2: receiver.email,
			mobile1: sender.mobile,
			mobile2: receiver.mobile,
			from_name: sender.name,
			to_name: receiver.name,
			sender_id: "",
			receiver_id: "",
			master_code: master_code,
			child_code: master_code + "-s1",
			created_at: new Date(),
		};

		let res = await execute(trans1);

		// return response
		if (res.status == 0) {
			return {
				status: 0,
				message: "Transaction failed!",
				blockchain_message: res.message,
			};
		}

		if (fee > 0) {
			let trans2 = {
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
				master_code: transfer.master_code,
				child_code: transfer.master_code + "-s2",
				created_at: new Date(),
			};

			res = await execute(trans2);
			// return response
			if (res.status == 0) {
				return {
					status: 0,
					message: "Transaction failed!",
					blockchain_message: res.message,
				};
			}
		}

		transfer.master_code = master_code;
		transfer.fee = fee;
		distributeRevenue(transfer, infra, bank, rule1);

		return {
			status: 1,
			message: "Transaction success!",
			amount: amount,
			fee: fee,
			balance: balance,
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, infra, bank, rule1) {
	const bankOpWallet = bank.wallet_ids.operational;
	const infraOpWallet = bank.wallet_ids.infra_operational;

	let allTxSuccess = true;
	var infraShare = calculateShare("infra", transfer.amount, rule1);
	transfer.infraShare = infraShare;
	master_code = transfer.master_code;

	if (infraShare.percentage_amount > 0) {
		let trans21 = {
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
			master_code: master_code,
			child_code: master_code + "-s3",
			created_at: new Date(),
		};
		let res = await execute(trans21);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}

	if (infraShare.fixed_amount > 0) {
		let trans22 = {
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
			master_code: master_code,
			child_code: master_code + "-s4",
			created_at: new Date(),
		};
		let res = await execute(trans22);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}

	if (allTxSuccess) {
		txstate.nearCompletion(master_code);
		let res = await transferToMasterWallets(transfer, infra, bank);

		if (res.status == 1) {
			txstate.completed(master_code);
		}
		return res;
	} else {
		txstate.failed(master_code);
		return {
			status: 0,
			message: "Not all transactions are success, please check",
		};
	}
}

async function transferToMasterWallets(transfer, infra, bank) {
	try {
		const bankOpWallet = bank.wallet_ids.operational;
		const bankMasterWallet = bank.wallet_ids.master;
		const infraOpWallet = bank.wallet_ids.infra_operational;
		const infraMasterWallet = bank.wallet_ids.infra_master;

		let master_code = transfer.master_code;

		let infraPart =
			transfer.infraShare.percentage_amount + transfer.infraShare.fixed_amount;
		let bankPart = transfer.fee - transfer.infraShare.percentage_amount;

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
			sender_id: "",
			receiver_id: "",
			master_code: master_code,
			child_code: master_code + "-m1",
			created_at: new Date(),
		};
		let result = await execute(trans);
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
			sender_id: "",
			receiver_id: "",
			master_code: master_code,
			child_code: master_code + "-m2",
			created_at: new Date(),
		};
		result = await execute(trans);
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
