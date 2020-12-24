//services
const blockchain = require("../../../services/Blockchain.js");
const {
	getTransactionCode,
	calculateShare,
} = require("../../utils/calculateShare");

module.exports = async function (amount, infra, bank, merchant, comm) {
	try {
		amount = Number(amount);

		const merchantOpWallet = merchant.wallet_ids.operational;
		const bankOpWallet = bank.wallet_ids.operational;
		const infraOpWallet = bank.wallet_ids.infra_operational;

		let master_code = getTransactionCode(merchant.mobile, bank.mobile);

		// first transaction
		bankComm = calculateShare("bank", amount, comm);
		console.log("Bank Commission: ", bankComm);
		if (bankComm > 0) {
			let trans1 = {
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
				master_code: master_code,
				child_code: master_code,
			};

			await blockchain.initiateTransfer(trans1);
		}

		//second transaction
		infraShare = calculateShare("infra", amount, comm);
		console.log("Infra Share: ", infraShare);
		if (infraShare.percentage_amount > 0) {
			let trans21 = {
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
				master_code: master_code,
				child_code: getTransactionCode(bank.mobile, infra.mobile) + "2.1",
			};

			await blockchain.initiateTransfer(trans21);
		}
		if (infraShare.fixed_amount > 0) {
			let trans22 = {
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
				master_code: master_code,
				child_code: getTransactionCode(bank.mobile, infra.mobile) + "2.2",
			};

			await blockchain.initiateTransfer(trans22);
		}

		result = {
			status: 1,
			message: "Transaction success!",
		};
		return result;
	} catch (err) {
		throw err;
	}
};
