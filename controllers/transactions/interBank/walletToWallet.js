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
	receiverBank,
	sender,
	receiver,
	rule1
) {
	try {
		const senderWallet = sender.wallet_id;
		const receiverWallet = receiver.wallet_id;
		const bankOpWallet = bank.wallet_ids.operational;
		const receiverBankOpWallet = receiverBank.wallet_ids.operational;

		transfer = getAllShares(transfer, rule1);

		var balance = await blockchain.getBalance(senderWallet);

		//Check balance first
		if (Number(balance) < transfer.exclusiveAmount + transfer.fee) {
			throw new Error("Not enough balance in your wallet");
		}

		let trans1 = [
			{
				from: senderWallet,
				to: bankOpWallet,
				amount: transfer.exclusiveAmount,
				note: "Transfer from " + sender.name + " to " + receiver.name,
				email1: sender.email,
				email2: bank.email,
				mobile1: sender.mobile,
				mobile2: bank.mobile,
				from_name: sender.name,
				to_name: bank.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + childType.AMOUNT,
			},
		];

		trans1.push({
			from: bankOpWallet,
			to: receiverBankOpWallet,
			amount: transfer.exclusiveAmount,
			note: "Transfer from " + sender.name + " to " + receiver.name,
			email1: bank.email,
			email2: receiverBank.email,
			mobile1: bank.mobile,
			mobile2: receiverBank.mobile,
			from_name: bank.name,
			to_name: receiverBank.name,
			sender_id: "",
			receiver_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + childType.AMOUNT,
		});

		trans1.push({
			from: receiverBankOpWallet,
			to: receiverWallet,
			amount: transfer.exclusiveAmount,
			note: "Transfer from " + sender.name + " to " + receiver.name,
			email1: receiverBank.email,
			email2: receiver.email,
			mobile1: receiverBank.mobile,
			mobile2: receiver.mobile,
			from_name: receiverBank.name,
			to_name: receiver.name,
			sender_id: "",
			receiver_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + childType.AMOUNT,
		});

		if (transfer.fee > 0) {
			trans1.push({
				from: senderWallet,
				to: bankOpWallet,
				amount: transfer.fee,
				note: "Bank Inter Bank Fee",
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
			});
		}

		result = await execute(trans1, categoryConst.MAIN);

		// return response
		if (result.status == 0) {
			return {
				status: 0,
				message: "Transaction failed!",
				blockchain_message: result.message,
			};
		}

		distributeRevenue(transfer, infra, bank, receiverBank);
		return {
			status: 1,
			message: "Transaction success!",
			transaction_code: transfer.master_code,
			amount: transfer.amount,
			fee: transfer.fee,
			balance: balance,
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, infra, bank, receiverBank) {
	try {
		const bankOpWallet = bank.wallet_ids.operational;
		const infraOpWallet = bank.wallet_ids.infra_operational;
		const receiverBankOpWallet = receiverBank.wallet_ids.operational;

		let transPromises = [];
		var promise;

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
				},
			];
			promise = execute(trans22, categoryConst.DISTRIBUTE, qname.INFRA_FIXED);
			transPromises.push(promise);
		}

		if (transfer.interBankShare.percentage_amount > 0) {
			let trans2 = [
				{
					from: bankOpWallet,
					to: receiverBankOpWallet,
					amount: transfer.interBankShare.percentage_amount,
					note: "Claiming Bank's Percentage Share for Inter Bank transaction",
					email1: bank.email,
					email2: receiverBank.email,
					mobile1: bank.mobile,
					mobile2: receiverBank.mobile,
					from_name: bank.name,
					to_name: receiverBank.name,
					sender_id: "",
					receiver_id: "",
					master_code: transfer.master_code,
					child_code: transfer.master_code + childType.INTER_BANK_PERCENT,
				},
			];

			promise = execute(
				trans2,
				categoryConst.DISTRIBUTE,
				qname.INTER_BANK_PERCENT
			);
			transPromises.push(promise);
		}

		if (transfer.interBankShare.fixed_amount > 0) {
			let trans2 = [
				{
					from: bankOpWallet,
					to: receiverBankOpWallet,
					amount: transfer.interBankShare.fixed_amount,
					note: "Claiming Bank's Fixed Share for Inter Bank transaction",
					email1: bank.email,
					email2: receiverBank.email,
					mobile1: bank.mobile,
					mobile2: receiverBank.mobile,
					from_name: bank.name,
					to_name: receiverBank.name,
					sender_id: "",
					receiver_id: "",
					master_code: transfer.master_code,
					child_code: transfer.master_code + childType.INTER_BANK_FIXED,
				},
			];

			promise = execute(
				trans2,
				categoryConst.DISTRIBUTE,
				childType.INTER_BANK_FIXED
			);
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
				transferToMasterWallets(transfer, infra, bank, receiverBank, branch);
			} else {
				txstate.failed(categoryConst.DISTRIBUTE, transfer.master_code);
			}
		});
	} catch (err) {
		txstate.failed(categoryConst.DISTRIBUTE, transfer.master_code);
	}
}

async function transferToMasterWallets(transfer, infra, bank, bankB) {
	try {
		txstate.initiateSubTx(categoryConst.MASTER, transfer.master_code);
		const bankOpWallet = bank.wallet_ids.operational;
		const bankMasterWallet = bank.wallet_ids.master;
		const infraOpWallet = bank.wallet_ids.infra_operational;
		const infraMasterWallet = bank.wallet_ids.infra_master;
		const bankBOpWallet = bankB.wallet_ids.operational;
		const bankBMasterWallet = bankB.wallet_ids.master;

		let master_code = transfer.master_code;

		let infraPart =
			transfer.infraShare.percentage_amount + transfer.infraShare.fixed_amount;
		let interBankPart =
			transfer.interBankShare.percentage_amount -
			transfer.interBankShare.fixed_amount;
		let bankPart =
			transfer.fee -
			transfer.infraShare.percentage_amount -
			transfer.interBankShare.percentage_amount;

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
				from: bankBOpWallet,
				to: bankBMasterWallet,
				amount: interBankPart,
				note: "Inter Bank share to its Master Wallet",
				email1: bankB.email,
				mobile1: bankB.mobile,
				from_name: bankB.name,
				to_name: bankB.name,
				sender_id: "",
				receiver_id: "",
				master_code: master_code,
				child_code: master_code + childType.INTER_BANK_MASTER,
				created_at: new Date(),
			},
		];
		promise = execute(trans, categoryConst.MASTER, qname.INTER_BANK_MASTER);
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

function getAllShares(transfer, rule1) {
	let amount = Number(transfer.amount);
	let exclusiveAmount = amount;
	var fee = calculateShare("bank", amount, rule1);
	if (transfer.isInclusive) {
		exclusiveAmount = amount - fee;
	}
	let infraShare = calculateShare("infra", amount, rule1);
	let interBankShare = calculateShare("claimBank", transfer.amount, rule1);

	transfer.exclusiveAmount = exclusiveAmount;
	transfer.fee = fee;
	transfer.infraShare = infraShare;
	transfer.interBankShare = interBankShare;
	return transfer;
}
