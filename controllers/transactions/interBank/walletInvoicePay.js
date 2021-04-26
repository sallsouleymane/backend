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
	merchantBank,
	user,
	merchant,
	rule1
) {
	try {
		// receiver's wallet names
		const userWallet = user.wallet_id;
		const merchantOpWallet = merchant.wallet_ids.operational;
		const bankOpWallet = bank.wallet_ids.operational;
		const merBankOpWallet = merchantBank.wallet_ids.operational;

		transfer = getAllShares(transfer, rule1);

		// check branch operational wallet balance
		var balance = await blockchain.getBalance(userWallet);
		if (
			Number(balance) <
			transfer.amount + transfer.bankFee + transfer.bankComm
		) {
			throw new Error("Not enough balance. Recharge Your wallet.");
		}

		let trans1 = [
			{
				from: userWallet,
				to: bankOpWallet,
				amount: transfer.amount,
				note: "Pay Bill amount",
				email1: user.email,
				email2: bank.email,
				mobile1: user.mobile,
				mobile2: bank.mobile,
				from_name: user.name,
				to_name: bank.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + childType.AMOUNT + "1",
			},
		];

		trans1.push({
			from: bankOpWallet,
			to: merBankOpWallet,
			amount: transfer.amount,
			note: "Pay Bill amount",
			email1: bank.email,
			email2: merchantBank.email,
			mobile1: bank.mobile,
			mobile2: merchantBank.mobile,
			from_name: bank.name,
			to_name: merchantBank.name,
			sender_id: "",
			receiver_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + childType.AMOUNT + "2",
		});

		trans1.push({
			from: merBankOpWallet,
			to: merchantOpWallet,
			amount: transfer.amount,
			note: "Pay Bill amount",
			email1: merchantBank.email,
			email2: merchant.email,
			mobile1: merchantBank.mobile,
			mobile2: merchant.mobile,
			from_name: merchantBank.name,
			to_name: merchant.name,
			sender_id: "",
			receiver_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + childType.AMOUNT + "3",
		});

		if (transfer.bankFee > 0) {
			trans1.push({
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
			});
		}

		if (transfer.bankComm > 0) {
			trans1.push({
				from: merchantOpWallet,
				to: merBankOpWallet,
				amount: transfer.bankComm,
				note: "Bank commission on paid bill",
				email1: merchant.email,
				email2: merchantBank.email,
				mobile1: merchant.mobile,
				mobile2: merchantBank.mobile,
				from_name: merchant.name,
				to_name: merchantBank.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + childType.REVENUE + "2",
			});

			trans1.push({
				from: merBankOpWallet,
				to: bankOpWallet,
				amount: transfer.bankComm,
				note: "Bank commission on paid bill",
				email1: merchantBank.email,
				email2: bank.email,
				mobile1: merchantBank.mobile,
				mobile2: bank.mobile,
				from_name: merchantBank.name,
				to_name: bank.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + childType.REVENUE + "3",
			});
		}

		result = await execute(trans1, categoryConst.MAIN);

		// return response
		if (result.status == 0) {
			result = {
				status: 0,
				message: "Transaction failed! - " + result.message,
			};
		} else {
			distributeRevenue(transfer, infra, bank, merchantBank);
			return {
				status: 1,
				transaction_code: transfer.master_code,
				message: "Transaction success!",
			};
		}
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, infra, bank, merchantBank) {
	try {
		const merBankOpWallet = merchantBank.wallet_ids.operational;
		const bankOpWallet = bank.wallet_ids.operational;
		const infraOpWallet = bank.wallet_ids.infra_operational;

		let transPromises = [];
		var promise;

		//first transaction
		if (transfer.infraShare.percentage_amount) {
			let trans31 = [
				{
					from: bankOpWallet,
					to: infraOpWallet,
					amount: transfer.infraShare.percentage_amount,
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
				},
			];

			promise = execute(trans31, categoryConst.DISTRIBUTE, qname.INFRA_PERCENT);
			transPromises.push(promise);
		}

		if (transfer.infraShare.fixed_amount > 0) {
			let trans = [
				{
					from: bankOpWallet,
					to: infraOpWallet,
					amount: transfer.infraShare.fixed_amount,
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
				},
			];

			promise = execute(trans, categoryConst.DISTRIBUTE, qname.INFRA_FIXED);
			transPromises.push(promise);
		}

		if (transfer.interBankFeeShare.percentage_amount > 0) {
			let trans = [
				{
					from: bankOpWallet,
					to: merBankOpWallet,
					amount: transfer.interBankFeeShare.percentage_amount,
					note: "Claiming Bank's percentage Share for Inter Bank transaction",
					email1: bank.email,
					email2: merchantBank.email,
					mobile1: bank.mobile,
					mobile2: merchantBank.mobile,
					from_name: bank.name,
					to_name: merchantBank.name,
					sender_id: "",
					receiver_id: "",
					master_code: transfer.master_code,
					child_code: transfer.master_code + childType.INTER_BANK_PERCENT + "1",
				},
			];

			promise = execute(
				trans,
				categoryConst.DISTRIBUTE,
				qname.INTER_BANK_PERCENT
			);
			transPromises.push(promise);
		}

		if (transfer.interBankFeeShare.fixed_amount > 0) {
			let trans = [
				{
					from: bankOpWallet,
					to: merBankOpWallet,
					amount: transfer.interBankFeeShare.fixed_amount,
					note: "Claiming Bank's fixed Share for Inter Bank transaction",
					email1: bank.email,
					email2: merchantBank.email,
					mobile1: bank.mobile,
					mobile2: merchantBank.mobile,
					from_name: bank.name,
					to_name: merchantBank.name,
					sender_id: "",
					receiver_id: "",
					master_code: transfer.master_code,
					child_code: transfer.master_code + childType.INTER_BANK_FIXED + "1",
				},
			];

			promise = execute(
				trans,
				categoryConst.DISTRIBUTE,
				qname.INTER_BANK_FIXED
			);
			transPromises.push(promise);
		}

		if (transfer.infraShare.percentage_amount > 0) {
			let trans = [
				{
					from: bankOpWallet,
					to: infraOpWallet,
					amount: transfer.infraShare.percentage_amount,
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
				},
			];

			promise = execute(trans, categoryConst.DISTRIBUTE, qname.INFRA_PERCENT);
			transPromises.push(promise);
		}
		if (transfer.infraShare.fixed_amount > 0) {
			let trans = [
				{
					from: bankOpWallet,
					to: infraOpWallet,
					amount: transfer.infraShare.fixed_amount,
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
				},
			];

			promise = execute(trans, categoryConst.DISTRIBUTE, qname.INFRA_FIXED);
			transPromises.push(promise);
		}

		if (transfer.interBankCommShare.percentage_amount > 0) {
			let trans = [
				{
					from: bankOpWallet,
					to: merBankOpWallet,
					amount: transfer.interBankCommShare.percentage_amount,
					note: "Claiming Bank's percentage Share for Inter Bank transaction",
					email1: bank.email,
					email2: merchantBank.email,
					mobile1: bank.mobile,
					mobile2: merchantBank.mobile,
					from_name: bank.name,
					to_name: merchantBank.name,
					sender_id: "",
					receiver_id: "",
					master_code: transfer.master_code,
					child_code: transfer.master_code + childType.INTER_BANK_PERCENT + "2",
				},
			];

			promise = execute(
				trans,
				categoryConst.DISTRIBUTE,
				qname.INTER_BANK_PERCENT
			);
			transPromises.push(promise);
		}

		if (transfer.interBankCommShare.fixed_amount > 0) {
			let trans = [
				{
					from: bankOpWallet,
					to: merBankOpWallet,
					amount: transfer.interBankCommShare.fixed_amount,
					note: "Claiming Bank's fixed Share for Inter Bank transaction",
					email1: bank.email,
					email2: merchantBank.email,
					mobile1: bank.mobile,
					mobile2: merchantBank.mobile,
					from_name: bank.name,
					to_name: merchantBank.name,
					sender_id: "",
					receiver_id: "",
					master_code: transfer.master_code,
					child_code: transfer.master_code + childType.INTER_BANK_FIXED + "2",
				},
			];

			promise = execute(
				trans,
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
				transferToMasterWallets(transfer, infra, bank, merchantBank);
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
		const bankBOpWallet = bank.wallet_ids.operational;
		const bankBMasterWallet = bank.wallet_ids.master;
		const infraOpWallet = bank.wallet_ids.infra_operational;
		const infraMasterWallet = bank.wallet_ids.infra_master;

		let infraPart =
			transfer.infraFeeShare.percentage_amount +
			transfer.infraFeeShare.fixed_amount +
			transfer.infraCommShare.percentage_amount +
			transfer.infraCommShare.fixed_amount;
		let interBankPart =
			transfer.interBankFeeShare.percentage_amount +
			transfer.interBankFeeShare.fixed_amount +
			transfer.interBankCommShare.percentage_amount +
			transfer.interBankCommShare.fixed_amount;
		let bankPart =
			transfer.bankFee +
			transfer.bankComm -
			transfer.infraFeeShare.percentage_amount -
			transfer.infraCommShare.percentage_amount -
			transfer.interBankFeeShare.percentage_amount -
			transfer.interBankCommShare.percentage_amount;

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
				master_code: transfer.master_code,
				child_code: transfer.master_code + childType.BANK_MASTER,
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
				master_code: transfer.master_code,
				child_code: transfer.master_code + childType.INFRA_MASTER,
				created_at: new Date(),
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
				master_code: transfer.master_code,
				child_code: transfer.master_code + childType.INTER_BANK_MASTER,
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
	let bankFee = calculateShare("bank", amount, rule1.fee);
	let bankComm = calculateShare("bank", amount, rule1.comm);
	let interBankFeeShare = calculateShare(
		"claimBank",
		transfer.amount,
		rule1.fee
	);
	let interBankCommShare = calculateShare(
		"claimBank",
		transfer.amount,
		rule1.comm
	);
	let infraFeeShare = calculateShare("infra", amount, rule1.fee);
	let infraCommShare = calculateShare("infra", amount, rule1.comm);

	transfer.bankFee = bankFee;
	transfer.bankComm = bankComm;
	transfer.interBankFeeShare = interBankFeeShare;
	transfer.interBankCommShare = interBankCommShare;
	transfer.infraFeeShare = infraFeeShare;
	transfer.infraCommShare = infraCommShare;
	return transfer;
}
