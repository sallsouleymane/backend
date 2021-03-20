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

//constants
const qname = require("../constants/queueName");
const categoryConst = require("../constants/category");
const childType = require("../constants/childType");

module.exports = async function (transfer, infra, bank, merchant, comm) {
	try {
		const merchantOpWallet = merchant.wallet_ids.operational;
		const bankOpWallet = bank.wallet_ids.operational;

		transfer = getAllShares(transfer, comm);

		// check branch operational wallet balance
		let balance = await blockchain.getBalance(merchantOpWallet);
		if (Number(balance) < transfer.bankComm) {
			return {
				status: 0,
				message: "Not enough balance in Merchant operational Wallet.",
			};
		}

		// first transaction
		if (transfer.bankComm > 0) {
			let trans1 = [
				{
					from: merchantOpWallet,
					to: bankOpWallet,
					amount: transfer.bankComm,
					note: "Bank commission on paid bill",
					email1: merchant.email,
					email2: bank.email,
					mobile1: merchant.mobile,
					mobile2: bank.mobile,
					from_name: merchant.name,
					to_name: bank.name,
					sender_id: "",
					receiver_id: "",
					master_code: transfer.master_code,
					child_code: transfer.master_code + childType.REVENUE,
				},
			];

			let res = await execute(trans1, categoryConst.MAIN);
			// return response
			if (res.status == 0) {
				return {
					status: 0,
					message: "Transaction failed!",
					blockchain_message: res.message,
					transactionCode: transfer.master_code,
				};
			}
		}
		distributeRevenue(transfer, infra, bank);

		return {
			status: 1,
			message: "Transaction success!",
			transactionCode: transfer.master_code,
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, infra, bank) {
	const bankOpWallet = bank.wallet_ids.operational;
	const infraOpWallet = bank.wallet_ids.infra_operational;

	let allTxSuccess = true;

	if (transfer.infraCommShare.percentage_amount > 0) {
		let trans21 = [
			{
				from: bankOpWallet,
				to: infraOpWallet,
				amount: transfer.infraCommShare.percentage_amount,
				note: "Infra percentage commission on paid bill",
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

		let res = await execute(trans21, categoryConst.DI);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}
	if (transfer.infraCommShare.fixed_amount > 0) {
		let trans22 = [
			{
				from: bankOpWallet,
				to: infraOpWallet,
				amount: transfer.infraShare.fixed_amount,
				note: "Infra fixed commission on paid bill",
				email1: bank.email,
				email2: infra.email,
				mobile1: bank.mobile,
				mobile2: infra.mobile,
				from_name: bank.name,
				to_name: infra.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + "-p3",
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
	const infraMasterWallet = bank.wallet_ids;

	let infraPart =
		transfer.infraCommShare.percentage_amount +
		transfer.infraCommShare.fixed_amount;
	let bankPart = transfer.bankComm - transfer.infraCommShare.percentage_amount;

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
			master_code: transfer.master_code,
			child_code: transfer.master_code + "-m1",
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
			master_code: transfer.master_code,
			child_code: transfer.master_code + "-m2",
			created_at: new Date(),
		},
	];
	execute(trans, queueName.infra_master);
}

function getAllShares(transfer, commRule) {
	let amount = transfer.amount;
	let bankComm = calculateShare("bank", amount, commRule);
	let infraCommShare = calculateShare("infra", amount, commRule);
	transfer.bankComm = bankComm;
	transfer.infraCommShare = infraCommShare;
	return transfer;
}
