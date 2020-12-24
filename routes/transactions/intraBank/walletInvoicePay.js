//services
const blockchain = require("../../../services/Blockchain.js");
const {
	getTransactionCode,
	calculateShare,
} = require("../../utils/calculateShare");

module.exports = async function (
	amount,
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

		let master_code = getTransactionCode(user.mobile, merchant.mobile);

		// first transaction
		amount = Number(amount);

		let trans1 = {
			from: userWallet,
			to: merchantOpWallet,
			amount: amount,
			note: "Bill amount",
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
			result = {
				status: 1,
				message: "Transaction success!",
				blockchain_message: result.message,
			};
		}
		distributeRevenue(
			amount,
			infra,
			bank,
			user,
			merchant,
			fee,
			comm,
			master_code
		);
		return result;
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(
	amount,
	infra,
	bank,
	user,
	merchant,
	fee,
	comm,
	master_code
) {
	const userWallet = user.wallet_id;
	const merchantOpWallet = merchant.wallet_ids.operational;
	const bankOpWallet = bank.wallet_ids.operational;
	const infraOpWallet = bank.wallet_ids.infra_operational;

	//second transaction
	bankFee = calculateShare("bank", amount, fee);
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
			master_code: master_code,
			child_code: getTransactionCode(user.mobile, bank.mobile) + "2",
		};

		await blockchain.initiateTransfer(trans2);
	}

	//third transaction
	infraShare = calculateShare("infra", amount, fee);
	console.log("Infra Share: ", infraShare);
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
			master_code: master_code,
			child_code: getTransactionCode(bank.mobile, infra.mobile) + "3.1",
		};

		await blockchain.initiateTransfer(trans31);
	}

	if (infraShare.fixed_amount > 0) {
		let trans32 = {
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
			master_code: master_code,
			child_code: getTransactionCode(bank.mobile, infra.mobile) + "3.2",
		};

		await blockchain.initiateTransfer(trans32);
	}

	//fourth transaction
	bankComm = calculateShare("bank", amount, comm);
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
			master_code: master_code,
			child_code: getTransactionCode(merchant.mobile, bank.mobile) + "5",
		};

		await blockchain.initiateTransfer(trans5);
	}

	//fifth transaction
	infraShare = calculateShare("infra", amount, comm);
	if (infraShare.percentage_amount > 0) {
		let trans6 = {
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
			master_code: master_code,
			child_code: getTransactionCode(bank.mobile, infra.mobile) + "6.1",
		};

		await blockchain.initiateTransfer(trans6);
	}
	if (infraShare.fixed_amount > 0) {
		let trans6 = {
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
			master_code: master_code,
			child_code: getTransactionCode(bank.mobile, infra.mobile) + "6.2",
		};

		await blockchain.initiateTransfer(trans6);
	}
}
