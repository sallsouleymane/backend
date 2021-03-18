//services
const blockchain = require("../../../services/Blockchain.js");
const { calculateShare } = require("../../../routes/utils/calculateShare");

// transaction services
const txstate = require("../services/states");
const execute = require("../services/execute.js");
const qname = require("../constants/queueName");

module.exports = async function (
	transfer,
	infra,
	bank,
	branch,
	receiver,
	rule1
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
				child_code: transfer.master_code + "-s1",
			},
		];

		if (transfer.fee > 0) {
			trans.push([
				{
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
					child_code: transfer.master_code + "-s2",
				},
			]);
		}

		let res = await execute(trans);

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
			amount: amount,
			fee: fee,
			sendFee: sendFee,
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, infra, bank, branch) {
	const branchOpWallet = branch.wallet_ids.operational;
	const bankOpWallet = bank.wallet_ids.operational;
	const infraOpWallet = bank.wallet_ids.infra_operational;

	let allTxSuccess = true;
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
				child_code: transfer.master_code + "-s3",
			},
		];
		let res = await execute(trans21, qname.INFRA_PERCENT);
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
				child_code: transfer.master_code + "-s4",
			},
		];
		let res = await execute(trans22, qname.INFRA_FIXED);
		if (res.status == 0) {
			allTxSuccess = false;
		}
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
				child_code: transfer.master_code + "-s5",
			},
		];

		let res = await execute(trans4, qname.SEND_FEE);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}
	if (allTxSuccess) {
		transferToMasterWallets(transfer, infra, bank, branch);
	}
}

async function transferToMasterWallets(transfer, infra, bank, branch) {
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
		},
	];
	execute(trans, qname.BANK_MASTER);

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
		},
	];
	execute(trans, qname.INFRA_MASTER);

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
			child_code: master_code + "-m3",
		},
	];
	execute(trans, qname.SEND_MASTER);
}

function getAllShares(transfer, rule) {
	let amount = transfer.amount;
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
