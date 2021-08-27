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

module.exports = async function (transfer, infra, bank, branch, rule1, rule2) {
	try {
		const branchOpWallet = branch.wallet_ids.operational;
		const bankEsWallet = bank.wallet_ids.escrow;
		const bankOpWallet = bank.wallet_ids.operational;

		transfer = getAllShares(transfer, rule1, rule2);

		var balance = await blockchain.getBalance(branchOpWallet);

		//Check balance first
		console.log("Balance: ", balance);
		console.log(transfer);
		if (Number(balance) < transfer.exclusiveAmount + transfer.fee) {
			return {
				status: 0,
				message: "Not enough balance in branch operational wallet",
			};
		}

		let trans1 = [
			{
				from: branchOpWallet,
				to: bankEsWallet,
				amount: transfer.exclusiveAmount,
				note: "Cashier Send Money to Non Wallet of Inter Bank",
				email1: branch.email,
				email2: bank.email,
				mobile1: branch.mobile,
				mobile2: bank.mobile,
				from_name: branch.name,
				to_name: bank.name,
				sender_id: transfer.cashierId,
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + childType.AMOUNT,
			},
		];

		if (fee > 0) {
			trans1.push({
				from: branchOpWallet,
				to: bankOpWallet,
				amount: transfer.fee,
				note:
					"Cashier Send Fee for Inter Bank Non Wallet to Non Wallet Transaction",
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

		let result = await execute(trans1, categoryConst.MAIN);
		// return response
		if (result.status == 0) {
			return {
				status: 0,
				message: "Transaction failed!",
				blockchain_message: result.message,
			};
		}

		distributeRevenue(transfer, infra, bank, branch);
		return {
			status: 1,
			message: "Transaction success!",
			blockchain_message: result.message,
			amount: transfer.exclusiveAmount,
			fee: transfer.fee,
			sendFee: transfer.senderShare,
			infraFee: transfer.infraShare,
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, infra, bank, branch) {
	try {
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
					note:
						"Bank Send Infra Percentage amount for Inter Bank Non Wallet to Non Wallet transaction",
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
					note:
						"Bank Send Infra Fixed amount for Inter Bank Wallet to Non Wallet transaction",
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
					note:
						"Bank Send Revenue Share for Sending Money for Inter Bank Non Wallet to Non Wallet transaction",
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
				}
			});
			if (allTxSuccess) {
				txstate.waitingForCompletion(
					categoryConst.DISTRIBUTE,
					transfer.master_code
				);
			} else {
				txstate.failed(categoryConst.DISTRIBUTE, transfer.master_code);
			}
		});
	} catch (err) {
		txstate.failed(categoryConst.DISTRIBUTE, transfer.master_code);
	}
}

function getAllShares(transfer, rule1, rule2) {
	let amount = Number(transfer.amount);
	let exclusiveAmount = amount;
	var fee = calculateShare("bank", amount, rule1);
	if (transfer.isInclusive) {
		exclusiveAmount = amount - fee;
	}
	let infraShare = calculateShare("infra", amount, rule1);
	let senderShare = 0;
	if (fee > 0) {
		senderShare = calculateShare(
			transfer.senderType,
			amount,
			rule1,
			rule2,
			transfer.senderCode
		);
	}

	transfer.exclusiveAmount = exclusiveAmount;
	transfer.fee = fee;
	transfer.infraShare = infraShare;
	transfer.senderShare = senderShare;
	return transfer;
}
