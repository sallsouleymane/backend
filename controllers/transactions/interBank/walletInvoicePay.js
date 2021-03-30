//services
const blockchain = require("../../../services/Blockchain.js");
const { calculateShare } = require("../../../routes/utils/calculateShare");
const execute = require("../../../controllers/transactions/services/execute");
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
		if (Number(balance) < transfer.amount) {
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
				child_code: transfer.master_code + childType.REVENUE,
			});
		}

		result = await execute(trans1, categoryConst.MAIN);

		// return response
		if (result.status == 0) {
			result = {
				status: 0,
				message: "Transaction failed! - " + result.message,
				blockchain_message: result.message,
			};
		} else {
			distributeRevenue(
				transfer,
				infra,
				bank,
				merchantBank,
				user,
				merchant,
				rule1
			);
			return {
				status: 1,
				message: "Transaction success!",
			};
		}
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(
	transfer,
	infra,
	bank,
	merchantBank,
	user,
	merchant,
	rule1
) {
	try {
		const merchantOpWallet = merchant.wallet_ids.operational;
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
					child_code: transfer.master_code + childType.INFRA_PERCENT,
				},
			];

			promise = execute(trans31, categoryConst.DISTRIBUTE, qname.INFRA_PERCENT);
			transPromises.push(promise);
		}

		if (infraShare.fixed_amount > 0) {
			let trans = [
				{
					from: bankOpWallet,
					to: infraOpWallet,
					amount: infraShare.fixed_amount,
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
					child_code: transfer.master_code + childType.INFRA_FIXED,
				},
			];

			promise = execute(trans, categoryConst.DISTRIBUTE, qname.INFRA_FIXED);
			transPromises.push(promise);
		}

		OtherBankFeeShare = calculateShare("claimBank", transfer.amount, rule1.fee);

		if (OtherBankFeeShare.percentage_amount > 0) {
			let trans = [
				{
					from: bankOpWallet,
					to: merBankOpWallet,
					amount: OtherBankFeeShare.percentage_amount,
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
					child_code: transfer.master_code + "1.1",
				},
			];

			promise = execute(trans);
			transPromises.push(promise);
		}

		if (OtherBankFeeShare.fixed_amount > 0) {
			let trans = [
				{
					from: bankOpWallet,
					to: merBankOpWallet,
					amount: OtherBankFeeShare.fixed_amount,
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
					child_code: transfer.master_code + "1.2",
				},
			];

			promise = execute(trans);
			transPromises.push(promise);
		}

		//fourth transaction
		bankComm = calculateShare("bank", transfer.amount, rule1.comm);
		if (bankComm > 0) {
			let trans5 = [
				{
					from: merchantOpWallet,
					to: merBankOpWallet,
					amount: bankComm,
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
					child_code:
						getTransactionCode(merchant.mobile, merchantBank.mobile) + "5",
				},
			];

			promise = execute(trans5);
			transPromises.push(promise);

			trans = [
				{
					from: merBankOpWallet,
					to: bankOpWallet,
					amount: bankComm,
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
					child_code:
						getTransactionCode(merchantBank.mobile, bank.mobile) + "5",
				},
			];

			promise = execute(trans);
			transPromises.push(promise);
		}

		//fifth transaction
		infraShare = calculateShare("infra", transfer.amount, rule1.comm);
		if (infraShare.percentage_amount > 0) {
			let trans = [
				{
					from: bankOpWallet,
					to: infraOpWallet,
					amount: infraShare.percentage_amount,
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
					child_code: getTransactionCode(bank.mobile, infra.mobile) + "6.1",
				},
			];

			promise = execute(trans);
		}
		if (infraShare.fixed_amount > 0) {
			let trans = [
				{
					from: bankOpWallet,
					to: infraOpWallet,
					amount: infraShare.fixed_amount,
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
					child_code: getTransactionCode(bank.mobile, infra.mobile) + "6.2",
				},
			];

			promise = execute(trans);
			transPromises.push(promise);
		}
		//Other bank shares

		OtherBankCommShare = calculateShare(
			"claimBank",
			transfer.amount,
			rule1.comm
		);

		if (OtherBankCommShare.percentage_amount > 0) {
			let trans = [
				{
					from: bankOpWallet,
					to: merBankOpWallet,
					amount: OtherBankCommShare.percentage_amount,
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
					child_code: transfer.master_code + "1.1",
				},
			];

			promise = execute(trans);
			transPromises.push(promise);
		}

		if (OtherBankCommShare.fixed_amount > 0) {
			let trans = [
				{
					from: bankOpWallet,
					to: merBankOpWallet,
					amount: OtherBankCommShare.fixed_amount,
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
					child_code: transfer.master_code + "1.2",
				},
			];

			promise = execute(trans);
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

function getAllShares(transfer, rule1) {
	let amount = transfer.amount;
	const bankFee = calculateShare("bank", amount, rule1.fee);
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
	let partnerFeeShare = 0;

	transfer.bankFee = bankFee;
	transfer.bankComm = bankComm;
	transfer.interBankFeeShare = interBankFeeShare;
	transfer.interBankCommShare = interBankCommShare;
	transfer.infraFeeShare = infraFeeShare;
	transfer.infraCommShare = infraCommShare;
	return transfer;
}
