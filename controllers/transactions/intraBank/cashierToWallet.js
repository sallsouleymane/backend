//services
const blockchain = require("../../../services/Blockchain.js");
const { calculateShare } = require("../../../routes/utils/calculateShare");

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
	branch,
	receiver,
	rule
) {
	try {
		const bankOpWallet = bank.wallet_ids.operational;
		const branchOpWallet = branch.wallet_ids.operational;
		const receiverWallet = receiver.wallet_id;

		transfer = getAllShares(transfer, rule);

		//Check balance first
		var balance = await blockchain.getBalance(branchOpWallet);
		if (Number(balance) < transfer.exclusiveAmount + transfer.fee) {
			throw new Error("Not enough balance in branch operational wallet");
		}

		// amount and fee transfer is a synchronous transaction
		let trans = [
			{
				transaction_type: "Non Wallet to Wallet",
				from: branchOpWallet,
				to: receiverWallet,
				amount: transfer.exclusiveAmount,
				note: "Cashier Send Money",
				email1: branch.email,
				email2: receiver.email,
				mobile1: branch.mobile,
				mobile2: receiver.mobile,
				from_name: branch.name,
				to_name: receiver.name,
				sender_id: transfer.cashierId,
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + childType.AMOUNT,
			},
		];

		if (transfer.fee > 0) {
			trans.push({
				from: branchOpWallet,
				to: bankOpWallet,
				amount: transfer.fee,
				note: "Cashier Send Bank Fee",
				email1: branch.email,
				email2: bank.email,
				mobile1: branch.mobile,
				mobile2: bank.mobile,
				from_name: branch.name,
				to_name: bank.name,
				sender_id: transfer.cashierId,
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + childType.REVENUE,
			});
		}

		let res = await execute(trans, categoryConst.MAIN);

		// return response
		if (res.status == 0) {
			return {
				status: 0,
				message: "Transaction failed - " + res.message,
			};
		}

		distributeRevenue(transfer, infra, bank, branch);

		return {
			status: 1,
			message: "Transaction success!",
			amount: transfer.exclusiveAmount,
			fee: transfer.fee,
			sendFee: transfer.senderShare,
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, infra, bank, branch) {
	try {
		txstate.initiateSubTx(categoryConst.DISTRIBUTE, transfer.master_code);
		const branchOpWallet = branch.wallet_ids.operational;
		const bankOpWallet = bank.wallet_ids.operational;
		const infraOpWallet = bank.wallet_ids.infra_operational;

		let transPromises = [];
		var promise;

		if (transfer.infraShare.percentage_amount > 0) {
			let trans21 = [
				{
					from: bankOpWallet,
					to: infraOpWallet,
					amount: transfer.infraShare.percentage_amount,
					note: "Cashier Send percentage Infra Fee",
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
					note: "Cashier Send fixed Infra Fee",
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
				},
			];
			promise = execute(trans22, categoryConst.DISTRIBUTE, qname.INFRA_FIXED);
			transPromises.push(promise);
		}
		if (transfer.fee > 0) {
			let trans4 = [
				{
					from: bankOpWallet,
					to: branchOpWallet,
					amount: transfer.senderShare,
					note: "Bank Send Revenue Branch for Sending money",
					email1: bank.email,
					email2: branch.email,
					mobile1: bank.mobile,
					mobile2: branch.mobile,
					from_name: bank.name,
					to_name: branch.name,
					sender_id: "",
					receiver_id: transfer.cashierId,
					master_code: transfer.master_code,
					child_code: transfer.master_code + childType.SENDER,
				},
			];

			promise = execute(trans4, categoryConst.DISTRIBUTE, qname.SEND_FEE);
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

async function transferToMasterWallets(transfer, infra, bank, branch) {
	try {
		txstate.initiateSubTx(categoryConst.MASTER, transfer.master_code);
		const bankOpWallet = bank.wallet_ids.operational;
		const bankMasterWallet = bank.wallet_ids.master;
		const infraOpWallet = bank.wallet_ids.infra_operational;
		const infraMasterWallet = bank.wallet_ids.infra_master;
		const branchOpWallet = branch.wallet_ids.operational;
		const branchMasterWallet = branch.wallet_ids.master;

		let master_code = transfer.master_code;

		let infraPart =
			transfer.infraShare.percentage_amount + transfer.infraShare.fixed_amount;
		let sendBranchPart = transfer.senderShare;
		let bankPart =
			transfer.fee - transfer.infraShare.percentage_amount - sendBranchPart;

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
			},
		];
		promise = execute(trans, categoryConst.MASTER, qname.INFRA_MASTER);
		transPromises.push(promise);

		trans = [
			{
				from: branchOpWallet,
				to: branchMasterWallet,
				amount: sendBranchPart,
				note: "Sending Branch share to its Master Wallet",
				email1: branch.email,
				mobile1: branch.mobile,
				from_name: branch.name,
				to_name: branch.name,
				sender_id: "",
				receiver_id: "",
				master_code: master_code,
				child_code: master_code + childType.SEND_MASTER,
			},
		];
		promise = execute(trans, categoryConst.MASTER, qname.SEND_MASTER);
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
	let senderShare = 0;
	if (fee > 0) {
		senderShare = calculateShare(
			transfer.senderType,
			amount,
			rule,
			{},
			transfer.senderCode
		);
	}

	transfer.exclusiveAmount = exclusiveAmount;
	transfer.fee = fee;
	transfer.infraShare = infraShare;
	transfer.senderShare = senderShare;
	return transfer;
}
