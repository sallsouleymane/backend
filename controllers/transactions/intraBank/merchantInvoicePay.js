//services
const blockchain = require("../../../services/Blockchain.js");
const {
	getTransactionCode,
	calculateShare,
} = require("../../../routes/utils/calculateShare");

// transaction services
const txstate = require("../services/states");
const execute = require("../services/execute.js");

module.exports = async function (transfer, infra, bank, merchant, comm) {
	try {
		const merchantOpWallet = merchant.wallet_ids.operational;
		const bankOpWallet = bank.wallet_ids.operational;

		const amount = transfer.amount;
		const master_code = transfer.master_code;
		const bankComm = calculateShare("bank", amount, comm);

		// check branch operational wallet balance
		let balance = await blockchain.getBalance(merchantOpWallet);
		if (Number(balance) < bankComm) {
			return {
				status: 0,
				message: "Not enough balance in Merchant operational Wallet.",
			};
		}

		// first transaction
		if (bankComm > 0) {
			let trans1 = [
				{
					from: merchantOpWallet,
					to: bankOpWallet,
					amount: bankComm,
					note: "Bank commission on paid bill",
					email1: merchant.email,
					email2: bank.email,
					mobile1: merchant.mobile,
					mobile2: bank.mobile,
					from_name: merchant.name,
					to_name: bank.name,
					sender_id: "",
					receiver_id: "",
					master_code: master_code,
					child_code: master_code + "-p1",
				},
			];

			let res = await execute(trans1);
			// return response
			if (res.status == 0) {
				return {
					status: 0,
					message: "Transaction failed!",
					blockchain_message: res.message,
					transactionCode: master_code,
				};
			}
		}
		distributeRevenue(transfer, infra, bank, comm);

		return {
			status: 1,
			message: "Transaction success!",
			transactionCode: master_code,
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, infra, bank, comm) {
	const bankOpWallet = bank.wallet_ids.operational;
	const infraOpWallet = bank.wallet_ids.infra_operational;

	let allTxSuccess = true;
	let master_code = transfer.master_code;

	//second transaction
	infraShare = calculateShare("infra", amount, comm);
	transfer.infraCommShare = infraShare;
	if (infraShare.percentage_amount > 0) {
		let trans21 = [
			{
				from: bankOpWallet,
				to: infraOpWallet,
				amount: infraShare.percentage_amount,
				note: "Infra percentage commission on paid bill",
				email1: bank.email,
				email2: infra.email,
				mobile1: bank.mobile,
				mobile2: infra.mobile,
				from_name: bank.name,
				to_name: infra.name,
				sender_id: "",
				receiver_id: "",
				master_code: master_code,
				child_code: master_code + "-p2",
			},
		];

		let res = await execute(trans21);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}
	if (infraShare.fixed_amount > 0) {
		let trans22 = [
			{
				from: bankOpWallet,
				to: infraOpWallet,
				amount: infraShare.fixed_amount,
				note: "Infra fixed commission on paid bill",
				email1: bank.email,
				email2: infra.email,
				mobile1: bank.mobile,
				mobile2: infra.mobile,
				from_name: bank.name,
				to_name: infra.name,
				sender_id: "",
				receiver_id: "",
				master_code: master_code,
				child_code: master_code + "-p3",
			},
		];

		let res = await execute(trans22);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}

	if (allTxSuccess) {
		txstate.nearCompletion(master_code);
		transferToMasterWallets(transfer, infra, bank);
	} else {
		txstate.failed(master_code);
	}
}

async function transferToMasterWallets(transfer, infra, bank) {
	const bankOpWallet = bank.wallet_ids.operational;
	const bankMasterWallet = bank.wallet_ids.master;
	const infraOpWallet = bank.wallet_ids.infra_operational;
	const infraMasterWallet = bank.wallet_ids.infra_master;

	let master_code = transfer.master_code;

	let infraPart =
		transfer.infraCommShare.percentage_amount +
		transfer.infraCommShare.fixed_amount;
	let bankPart = transfer.bankComm - transfer.infraCommShare.percentage_amount;

	let txStatus = 1;

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
	let result = await execute(trans);
	if (result.status == 0) {
		txStatus = 0;
	}

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
	result = await execute(trans);
	if (result.status == 0) {
		txStatus = 0;
	}

	if (txStatus == 0) {
		txstate.failed(transfer.master_code);
	} else {
		txstate.completed(master_code);
	}
}
