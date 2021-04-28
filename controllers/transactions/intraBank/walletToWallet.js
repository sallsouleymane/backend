//services
const blockchain = require("../../../services/Blockchain.js");
const {
	getTransactionCode,
	calculateShare,
} = require("../../../routes/utils/calculateShare");

// transaction services
const txstate = require("../services/states");
const execute = require("../services/execute.js");

//constants
const qname = require("../constants/queueName");
const categoryConst = require("../constants/category");
const childType = require("../constants/childType");

module.exports = async function (
	transfer,
	infra,
	bank,
	sender,
	receiver,
	rule
) {
	try {
		const senderWallet = sender.wallet_id;
		const receiverWallet = receiver.wallet_id;
		const bankOpWallet = bank.wallet_ids.operational;

		// first transaction
		transfer = getAllShares(transfer, rule);

		var balance = await blockchain.getBalance(senderWallet);

		//Check balance first
		if (Number(balance) < transfer.exclusiveAmount + transfer.fee) {
			throw new Error("Not enough balance in your wallet");
		}

		let trans = [
			{
				transaction_type: "Wallet to Wallet",
				from: senderWallet,
				to: receiverWallet,
				amount: transfer.exclusiveAmount,
				note: "Transfer from " + sender.name + " to " + receiver.name,
				email1: sender.email,
				email2: receiver.email,
				mobile1: sender.mobile,
				mobile2: receiver.mobile,
				from_name: sender.name,
				to_name: receiver.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + childType.AMOUNT,
				created_at: new Date(),
			},
		];

		if (transfer.fee > 0) {
			trans.push({
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
				child_code: transfer.master_code + childType.REVENUE,
				created_at: new Date(),
			});
		}

		let res = await execute(trans, categoryConst.MAIN);

		// return response
		if (res.status == 0) {
			return {
				status: 0,
				message: "Transaction failed!",
				blockchain_message: res.message,
			};
		}
		distributeRevenue(transfer, infra, bank);

		return {
			status: 1,
			message: "Transaction success!",
			transaction_code: transfer.master_code,
			amount: transfer.exclusiveAmount,
			fee: transfer.fee,
			balance: balance,
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, infra, bank) {
	try {
		txstate.initiateSubTx(categoryConst.DISTRIBUTE, transfer.master_code);
		const bankOpWallet = bank.wallet_ids.operational;
		const infraOpWallet = bank.wallet_ids.infra_operational;

		let transPromises = [];
		var promise;

		// let allTxSuccess = true;

		if (transfer.infraShare.percentage_amount > 0) {
			let trans21 = [
				{
					from: bankOpWallet,
					to: infraOpWallet,
					amount: transfer.infraShare.percentage_amount,
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
					child_code: transfer.master_code + childType.INFRA_PERCENT,
					created_at: new Date(),
				},
			];
			promise = execute(trans21, categoryConst.DISTRIBUTE, qname.INFRA_PERCENT);
			transPromises.push(promise);
		}

		if (transfer.infraShare.fixed_amount > 0) {
			let trans22 = [
				{
					from: bankOpWallet,
					to: infraOpWallet,
					amount: transfer.infraShare.fixed_amount,
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
					child_code: transfer.master_code + childType.INFRA_FIXED,
					created_at: new Date(),
				},
			];
			promise = execute(trans22, categoryConst.DISTRIBUTE, qname.INFRA_FIXED);
			transPromises.push(promise);
		}

		Promise.all(transPromises).then((results) => {
			let allTxSuccess = results.every((res) => {
				if (res.status == 0) {
					return false;
				} else {
					return true;
				}
			});
			if (allTxSuccess) {
				txstate.completed(categoryConst.DISTRIBUTE, transfer.master_code);
				transferToMasterWallets(transfer, infra, bank, branch);
			} else {
				txstate.failed(categoryConst.DISTRIBUTE, transfer.master_code);
			}
		});
	} catch (err) {
		txstate.failed(categoryConst.DISTRIBUTE, transfer.master_code);
	}
}

async function transferToMasterWallets(transfer, infra, bank) {
	try {
		txstate.initiateSubTx(categoryConst.DISTRIBUTE, transfer.master_code);
		const bankOpWallet = bank.wallet_ids.operational;
		const bankMasterWallet = bank.wallet_ids.master;
		const infraOpWallet = bank.wallet_ids.infra_operational;
		const infraMasterWallet = bank.wallet_ids.infra_master;

		let master_code = transfer.master_code;

		let infraPart =
			transfer.infraShare.percentage_amount + transfer.infraShare.fixed_amount;
		let bankPart = transfer.fee - transfer.infraShare.percentage_amount;

		let transPromises = [];
		var promise;

		let trans = [
			{
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
				child_code: master_code + childType.BANK_MASTER,
				created_at: new Date(),
			},
		];
		promise = execute(trans, categoryConst.MASTER, qname.BANK_MASTER);
		transPromises.push(promise);

		trans = [
			{
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
				child_code: master_code + childType.INFRA_MASTER,
				created_at: new Date(),
			},
		];
		promise = execute(trans, categoryConst.MASTER, qname.INFRA_MASTER);
		transPromises.push(promise);

		Promise.all(transPromises).then((results) => {
			let allTxSuccess = results.every((res) => {
				if (res.status == 0) {
					return false;
				} else {
					return true;
				}
			});
			if (allTxSuccess) {
				txstate.completed(categoryConst.MASTER, transfer.master_code);
			} else {
				txstate.failed(categoryConst.MASTER, transfer.master_code);
			}
		});
	} catch (err) {
		txstate.failed(categoryConst.MASTER, transfer.master_code);
	}
}

function getAllShares(transfer, rule) {
	let amount = Number(transfer.amount);
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
