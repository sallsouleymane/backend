//services
const blockchain = require("../../../services/Blockchain.js");
const {
	getTransactionCode,
	calculateShare,
} = require("../../../routes/utils/calculateShare");

// transaction services
const txstate = require("../services/states");
const execute = require("../services/execute.js");
const queueName = require("../constants/queueName.js");

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
		transfer = getAllShares(transfer, rule);

		var balance = await blockchain.getBalance(senderWallet);

		//Check balance first
		if (Number(balance) < transfer.exclusiveAmount + transfer.fee) {
			throw new Error("Not enough balance in your wallet");
		}

		let trans = [
			{
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
				child_code: transfer.master_code + "-s1",
				created_at: new Date(),
			},
		];

		if (transfer.fee > 0) {
			trans.push([
				{
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
					child_code: transfer.master_code + "-s2",
					created_at: new Date(),
				},
			]);
		}

		let res = await execute(trans);

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
			amount: transfer.exclusiveAmount,
			fee: transfer.fee,
			balance: balance,
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, infra, bank) {
	const bankOpWallet = bank.wallet_ids.operational;
	const infraOpWallet = bank.wallet_ids.infra_operational;

	let allTxSuccess = true;

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
				child_code: transfer.master_code + "-s3",
				created_at: new Date(),
			},
		];
		let res = await execute(trans21, queueName.infra_percent);
		if (res.status == 0) {
			allTxSuccess = false;
		}
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
				child_code: transfer.master_code + "-s4",
				created_at: new Date(),
			},
		];
		let res = await execute(trans22, queueName.infra_fixed);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}

	if (allTxSuccess) {
		transferToMasterWallets(transfer, infra, bank);
	}
}

async function transferToMasterWallets(transfer, infra, bank) {
	const bankOpWallet = bank.wallet_ids.operational;
	const bankMasterWallet = bank.wallet_ids.master;
	const infraOpWallet = bank.wallet_ids.infra_operational;
	const infraMasterWallet = bank.wallet_ids.infra_master;

	let master_code = transfer.master_code;

	let infraPart =
		transfer.infraShare.percentage_amount + transfer.infraShare.fixed_amount;
	let bankPart = transfer.fee - transfer.infraShare.percentage_amount;

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
			child_code: master_code + "-m1",
			created_at: new Date(),
		},
	];
	execute(trans, queueName.bank_master);

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
			child_code: master_code + "-m2",
			created_at: new Date(),
		},
	];
	execute(trans, queueName.infra_master);
}

function getAllShares(transfer, rule) {
	let amount = transfer.amount;
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
