//services
const blockchain = require("../../../services/Blockchain.js");
const { getTransactionCode, calculateShare } = require("../../utils/calculateShare");

module.exports = async function (
	amount,
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

		// check branch operational wallet balance
		var balance = await blockchain.getBalance(userWallet);
		if (Number(balance) < amount) {
			throw new Error("Not enough balance. Recharge Your wallet.");
		}

		let master_code = getTransactionCode(user.mobile, merchant.mobile);

		// first transaction
		amount = Number(amount);

		let trans1 = {
			from: userWallet,
			to: merchantOpWallet,
			amount: amount,
			note: "Pay Bill amount",
			email1: user.email,
			email2: merchant.email,
			mobile1: user.mobile,
			mobile2: merchant.mobile,
			from_name: user.name,
			to_name: merchant.name,
			master_code: master_code,
			child_code: master_code + "1",
		};

		var result = await blockchain.initiateTransfer(trans1);

		// return response
		if (result.status == 0) {
			result = {
				status: 0,
				message: "Transaction failed!",
				blockchain_message: result.message,
			};
		} else {
			var transfer = {};
			transfer.amount = amount;
			transfer.master_code = master_code;
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
				blockchain_message: result.message,
			};;
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
	const userWallet = user.wallet_id;
	const merchantOpWallet = merchant.wallet_ids.operational;
	const merBankOpWallet = merchantBank.wallet_ids.operational;
	const bankOpWallet = bank.wallet_ids.operational;
	const infraOpWallet = bank.wallet_ids.infra_operational;

	//second transaction
	bankFee = calculateShare("bank", transfer.amount, rule1.fee);
	console.log("Bank Fee: ", bankFee);
	if (bankFee > 0) {
		let trans2 = {
			from: userWallet,
			to: bankOpWallet,
			amount: bankFee,
			note: "Bank fee on paid bill",
			email1: user.email,
			email2: bank.email,
			mobile1: user.mobile,
			mobile2: bank.mobile,
			from_name: user.name,
			to_name: bank.name,
			master_code: transfer.master_code,
			child_code: getTransactionCode(user.mobile, bank.mobile) + "2",
		};

		await blockchain.initiateTransfer(trans2);
	}

	//fourth transaction
	bankComm = calculateShare("bank", transfer.amount, rule1.comm);
	if (bankComm > 0) {
		let trans5 = {
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
			master_code: transfer.master_code,
			child_code: getTransactionCode(merchant.mobile, bank.mobile) + "5",
		};

		await blockchain.initiateTransfer(trans5);
	}

	//third transaction
	infraShare = calculateShare("infra", transfer.amount, rule1.fee);
	if (infraShare.percentage_amount) {
		let trans31 = {
			from: bankOpWallet,
			to: infraOpWallet,
			amount: infraShare.percentage_amount,
			note: "Percentage Fee on paid bill",
			email1: bank.email,
			email2: infra.email,
			mobile1: bank.mobile,
			mobile2: infra.mobile,
			from_name: bank.name,
			to_name: infra.name,
			master_code: transfer.master_code,
			child_code: getTransactionCode(bank.mobile, infra.mobile) + "3.1",
		};

		await blockchain.initiateTransfer(trans31);
	}

	if (infraShare.fixed_amount > 0) {
		let trans = {
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
			master_code: transfer.master_code,
			child_code: getTransactionCode(bank.mobile, infra.mobile) + "3.2",
		};

		await blockchain.initiateTransfer(trans);
	}

	//fifth transaction
	infraShare = calculateShare("infra", transfer.amount, rule1.comm);
	if (infraShare.percentage_amount > 0) {
		let trans = {
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
			master_code: transfer.master_code,
			child_code: getTransactionCode(bank.mobile, infra.mobile) + "6.1",
		};

		await blockchain.initiateTransfer(trans);
	}
	if (infraShare.fixed_amount > 0) {
		let trans = {
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
			master_code: transfer.master_code,
			child_code: getTransactionCode(bank.mobile, infra.mobile) + "6.2",
		};

		await blockchain.initiateTransfer(trans);
	}
	//Other bank shares

	OtherBankFeeShare = calculateShare("claimBank", transfer.amount, rule1.fee);

	if (OtherBankFeeShare.percentage_amount > 0) {
		let trans = {
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
			user_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + "1.1"
		}

		await blockchain.initiateTransfer(trans);
	}

	if (OtherBankFeeShare.fixed_amount > 0) {
		let trans = {
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
			user_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + "1.2"
		}

		await blockchain.initiateTransfer(trans);
	}

	OtherBankCommShare = calculateShare("claimBank", transfer.amount, rule1.comm);

	if (OtherBankCommShare.percentage_amount > 0) {
		let trans = {
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
			user_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + "1.1"
		}

		await blockchain.initiateTransfer(trans);
	}

	if (OtherBankCommShare.fixed_amount > 0) {
		let trans = {
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
			user_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + "1.2"
		}

		await blockchain.initiateTransfer(trans);
	}

}
