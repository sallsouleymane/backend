const blockchain = require("../../../services/Blockchain.js");
const {
	getTransactionCode,
	calculateShare,
} = require("../../utils/calculateShare");

module.exports = async function (
	transfer,
	infra,
	bank,
	merchantBank,
	branch,
	merchant,
	rule1,
	rule2
) {
	try {
		// receiver's wallet names
		const branchOpWallet = branch.wallet_ids.operational;
		const merchantOpWallet = merchant.wallet_ids.operational;
		const bankOpWallet = bank.wallet_ids.operational;
		const merBankOpWallet = merchantBank.wallet_ids.operational;

		// check branch operational wallet balance
		var balance = await blockchain.getBalance(branchOpWallet);
		if (Number(balance) < transfer.amount) {
			throw new Error("Not enough balance. Recharge Your wallet.");
		}

		let master_code = getTransactionCode(branch.mobile, merchant.mobile);

		// first transaction
		amount = Number(transfer.amount);

		let trans1 = {
			from: branchOpWallet,
			to: bankOpWallet,
			amount: amount,
			note: "Bill amount",
			email1: branch.email,
			email2: bank.email,
			mobile1: branch.mobile,
			mobile2: bank.mobile,
			from_name: branch.name,
			to_name: bank.name,
			sender_id: transfer.cashierId,
			receiver_id: "",
			master_code: master_code,
			child_code: master_code + "1",
		};

		let result = await blockchain.initiateTransfer(trans1);
		if (result.status == 0) {
			return {
				status: 0,
				message: "Transaction failed!",
				blockchain_message: result.message,
			};
		}

		trans1 = {
			from: bankOpWallet,
			to: merBankOpWallet,
			amount: amount,
			note: "Bill amount",
			email1: bank.email,
			email2: merchantBank.email,
			mobile1: bank.mobile,
			mobile2: merchantBank.mobile,
			from_name: bank.name,
			to_name: merchantBank.name,
			sender_id: "",
			receiver_id: "",
			master_code: master_code,
			child_code: master_code + "1",
		};

		result = await blockchain.initiateTransfer(trans1);

		if (result.status == 0) {
			return {
				status: 0,
				message: "Transaction failed!",
				blockchain_message: result.message,
			};
		}

		trans1 = {
			from: merBankOpWallet,
			to: merchantOpWallet,
			amount: amount,
			note: "Bill amount",
			email1: merchantBank.email,
			email2: merchant.email,
			mobile1: merchantBank.mobile,
			mobile2: merchant.mobile,
			from_name: merchantBank.name,
			to_name: merchant.name,
			sender_id: "",
			receiver_id: "",
			master_code: master_code,
			child_code: master_code + "1",
		};

		result = await blockchain.initiateTransfer(trans1);

		// return response
		if (result.status == 0) {
			return {
				status: 0,
				message: "Transaction failed!",
				blockchain_message: result.message,
			};
		} else {
			const bankFee = calculateShare("bank", amount, rule1.fee);
			const partnerFeeShare = calculateShare(
				"branch",
				amount,
				rule1.fee,
				rule2.fee,
				branch.bcode
			);
			const partnerCommShare = calculateShare(
				"branch",
				amount,
				rule1.comm,
				rule2.comm,
				branch.bcode
			);

			transfer.bankFee = bankFee;
			transfer.partnerFeeShare = partnerFeeShare;
			transfer.partnerCommShare = partnerCommShare;
			transfer.master_code = master_code;

			distributeRevenue(
				transfer,
				infra,
				bank,
				merchantBank,
				branch,
				merchant,
				rule1
			);
			return {
				status: 1,
				message: "Transaction success!",
				blockchain_message: result.message,
				bankFee: bankFee,
				partnerFeeShare: partnerFeeShare,
				partnerCommShare: partnerCommShare,
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
	branch,
	merchant,
	rule1
) {
	const branchOpWallet = branch.wallet_ids.operational;
	const merchantOpWallet = merchant.wallet_ids.operational;
	const bankOpWallet = bank.wallet_ids.operational;
	const merBankOpWallet = merchantBank.wallet_ids.operational;
	const infraOpWallet = bank.wallet_ids.infra_operational;

	if (transfer.bankFee > 0) {
		let trans = {
			from: branchOpWallet,
			to: bankOpWallet,
			amount: transfer.bankFee,
			note: "Bank fee on paid bill",
			email1: branch.email,
			email2: bank.email,
			mobile1: branch.mobile,
			mobile2: bank.mobile,
			from_name: branch.name,
			to_name: bank.name,
			sender_id: transfer.cashierId,
			receiver_id: "",
			master_code: transfer.master_code,
			child_code: getTransactionCode(branch.mobile, bank.mobile) + "2",
		};

		await blockchain.initiateTransfer(trans);
	}

	infraShare = calculateShare("infra", transfer.amount, rule1.fee);
	if (infraShare.percentage_amount > 0) {
		let trans = {
			from: bankOpWallet,
			to: infraOpWallet,
			amount: infraShare.percentage_amount,
			note: "Percentage share on paid bill",
			email1: bank.email,
			email2: infra.email,
			mobile1: bank.mobile,
			mobile2: infra.mobile,
			from_name: bank.name,
			to_name: infra.name,
			sender_id: "",
			receiver_id: "",
			master_code: transfer.master_code,
			child_code: getTransactionCode(bank.mobile, infra.mobile) + "3.1",
		};
		await blockchain.initiateTransfer(trans);
	}

	if (infraShare.fixed_amount > 0) {
		let trans = {
			from: bankOpWallet,
			to: infraOpWallet,
			amount: infraShare.fixed_amount,
			note: "Fixed share on paid bill",
			email1: bank.email,
			email2: infra.email,
			mobile1: bank.mobile,
			mobile2: infra.mobile,
			from_name: bank.name,
			to_name: infra.name,
			sender_id: "",
			receiver_id: "",
			master_code: transfer.master_code,
			child_code: getTransactionCode(bank.mobile, infra.mobile) + "3.2",
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
			note: "Claiming Bank's Share for Inter Bank transaction",
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
		};

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
			sender_id: "",
			receiver_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + "1.2",
		};

		await blockchain.initiateTransfer(trans);
	}

	//Branch sharing
	if (transfer.bankFee > 0) {
		let trans = {
			from: bankOpWallet,
			to: branchOpWallet,
			amount: transfer.partnerFeeShare,
			note: "Fee share on paid bill",
			email1: bank.email,
			email2: branch.email,
			mobile1: bank.mobile,
			mobile2: branch.mobile,
			from_name: bank.name,
			to_name: branch.name,
			sender_id: "",
			receiver_id: transfer.cashierId,
			master_code: transfer.master_code,
			child_code: getTransactionCode(bank.mobile, branch.mobile) + "4",
		};

		await blockchain.initiateTransfer(trans);
	}

	bankComm = calculateShare("bank", transfer.amount, rule1.comm);
	if (bankComm > 0) {
		let trans = {
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
		};

		await blockchain.initiateTransfer(trans);

		trans = {
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
			child_code: getTransactionCode(merchantBank.mobile, bank.mobile) + "5",
		};

		await blockchain.initiateTransfer(trans);
	}

	infraShare = calculateShare("infra", transfer.amount, rule1.comm);
	if (infraShare.percentage_amount > 0) {
		let trans = {
			from: bankOpWallet,
			to: infraOpWallet,
			amount: infraShare.percentage_amount,
			note: "Commission share on paid bill",
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
		};

		await blockchain.initiateTransfer(trans);
	}

	if (infraShare.fixed_amount > 0) {
		let trans = {
			from: bankOpWallet,
			to: infraOpWallet,
			amount: infraShare.fixed_amount,
			note: "Fixed Commission share on paid bill",
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
		};

		await blockchain.initiateTransfer(trans);
	}

	OtherBankCommShare = calculateShare("claimBank", transfer.amount, rule1.comm);

	if (OtherBankCommShare.percentage_amount > 0) {
		let trans = {
			from: bankOpWallet,
			to: merBankOpWallet,
			amount: OtherBankCommShare.percentage_amount,
			note: "Claiming Bank's Share for Inter Bank transaction",
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
		};

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
			sender_id: "",
			receiver_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + "1.2",
		};

		await blockchain.initiateTransfer(trans);
	}

	if (bankComm > 0) {
		let trans = {
			from: bankOpWallet,
			to: branchOpWallet,
			amount: transfer.partnerCommShare,
			note: "Commission share on paid bill",
			email1: bank.email,
			email2: branch.email,
			mobile1: bank.mobile,
			mobile2: branch.mobile,
			from_name: bank.name,
			to_name: branch.name,
			sender_id: "",
			receiver_id: transfer.cashierId,
			master_code: transfer.master_code,
			child_code: getTransactionCode(bank.mobile, branch.mobile) + "7",
		};

		await blockchain.initiateTransfer(trans);
	}
}
