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
	user,
	merchant,
	fee,
	comm
) {
	try {
		// receiver's wallet names
		const userWallet = user.wallet_id;
		const merchantOpWallet = merchant.wallet_ids.operational;
		const bankOpWallet = bank.wallet_ids.operational;

		transfer = getAllShares(transfer, fee, comm);

		// check branch operational wallet balance
		let balance = await blockchain.getBalance(userWallet);
		if (
			Number(balance) <
			transfer.amount + transfer.bankFee + transfer.bankComm
		) {
			return {
				status: 0,
				message: "Not enough balance. Recharge Your wallet.",
			};
		}

		let trans = [
			{
				transaction_type: "Wallet to Merchant",
				from: userWallet,
				to: merchantOpWallet,
				amount: transfer.amount,
				note: "Bill amount",
				email1: user.email,
				email2: merchant.email,
				mobile1: user.mobile,
				mobile2: merchant.mobile,
				from_name: user.name,
				to_name: merchant.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + childType.AMOUNT,
				created_at: new Date(),
			},
		];

		if (transfer.bankFee > 0) {
			trans.push({
				from: userWallet,
				to: bankOpWallet,
				amount: transfer.bankFee,
				note: "Bank fee on paid bill",
				email1: user.email,
				email2: bank.email,
				mobile1: user.mobile,
				mobile2: bank.mobile,
				from_name: user.name,
				to_name: bank.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + childType.REVENUE + "1",
				created_at: new Date(),
			});
		}

		if (transfer.bankComm > 0) {
			trans.push({
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
				child_code: transfer.master_code + childType.REVENUE + "2",
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

		if (transfer.infraFeeShare.percentage_amount) {
			let trans31 = [
				{
					from: bankOpWallet,
					to: infraOpWallet,
					amount: transfer.infraFeeShare.percentage_amount,
					note: "Percentage Fee on paid bill",
					email1: bank.email,
					email2: infra.email,
					mobile1: bank.mobile,
					mobile2: infra.mobile,
					from_name: bank.name,
					to_name: infra.name,
					sender_id: "",
					receiver_id: "",
					master_code: transfer.master_code,
					child_code: transfer.master_code + childType.INFRA_PERCENT + "1",
					created_at: new Date(),
				},
			];

			promise = execute(trans31, categoryConst.DISTRIBUTE, qname.INFRA_PERCENT);
			transPromises.push(promise);
		}

		if (transfer.infraFeeShare.fixed_amount > 0) {
			let trans32 = [
				{
					from: bankOpWallet,
					to: infraOpWallet,
					amount: transfer.infraFeeShare.fixed_amount,
					note: "Fixed Fee on paid bill",
					email1: bank.email,
					email2: infra.email,
					mobile1: bank.mobile,
					mobile2: infra.mobile,
					from_name: bank.name,
					to_name: infra.name,
					sender_id: "",
					receiver_id: "",
					master_code: transfer.master_code,
					child_code: transfer.master_code + childType.INFRA_FIXED + "1",
					created_at: new Date(),
				},
			];

			promise = execute(trans32, categoryConst.DISTRIBUTE, qname.INFRA_FIXED);
			transPromises.push(promise);
		}

		if (transfer.infraCommShare.percentage_amount > 0) {
			let trans6 = [
				{
					from: bankOpWallet,
					to: infraOpWallet,
					amount: transfer.infraCommShare.percentage_amount,
					note: "Percentage Commission share on paid bill",
					email1: bank.email,
					email2: infra.email,
					mobile1: bank.mobile,
					mobile2: infra.mobile,
					from_name: bank.name,
					to_name: infra.name,
					sender_id: "",
					receiver_id: "",
					master_code: transfer.master_code,
					child_code: transfer.master_code + childType.INFRA_PERCENT + "2",
					created_at: new Date(),
				},
			];

			promise = execute(trans6, categoryConst.DISTRIBUTE, qname.INFRA_PERCENT);
			transPromises.push(promise);
		}
		if (transfer.infraCommShare.fixed_amount > 0) {
			let trans6 = [
				{
					from: bankOpWallet,
					to: infraOpWallet,
					amount: transfer.infraCommShare.fixed_amount,
					note: "Fixed Commission on paid bill",
					email1: bank.email,
					email2: infra.email,
					mobile1: bank.mobile,
					mobile2: infra.mobile,
					from_name: bank.name,
					to_name: infra.name,
					sender_id: "",
					receiver_id: "",
					master_code: transfer.master_code,
					child_code: transfer.master_code + childType.INFRA_FIXED + "2",
					created_at: new Date(),
				},
			];

			promise = execute(trans6, categoryConst.DISTRIBUTE, qname.INFRA_FIXED);
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
				transferToMasterWallets(transfer, infra, bank);
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
		const bankOpWallet = bank.wallet_ids.operational;
		const bankMasterWallet = bank.wallet_ids.master;
		const infraOpWallet = bank.wallet_ids.infra_operational;
		const infraMasterWallet = bank.wallet_ids.infra_master;

		let master_code = transfer.master_code;

		let infraPart =
			transfer.infraFeeShare.percentage_amount +
			transfer.infraFeeShare.fixed_amount +
			transfer.infraCommShare.percentage_amount +
			transfer.infraCommShare.fixed_amount;
		let bankPart =
			transfer.bankFee +
			transfer.bankComm -
			transfer.infraFeeShare.percentage_amount -
			transfer.infraCommShare.percentage_amount;

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

function getAllShares(transfer, feeRule, commRule) {
	let amount = transfer.amount;
	let bankFee = calculateShare("bank", amount, feeRule);
	let bankComm = calculateShare("bank", amount, commRule);
	let infraFeeShare = calculateShare("infra", amount, feeRule);
	let infraCommShare = calculateShare("infra", amount, commRule);

	transfer.bankFee = bankFee;
	transfer.bankComm = bankComm;
	transfer.infraFeeShare = infraFeeShare;
	transfer.infraCommShare = infraCommShare;
	return transfer;
}
