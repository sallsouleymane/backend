//services
const blockchain = require("../../../services/Blockchain.js");
const {
	getTransactionCode,
	calculateShare,
} = require("../../../routes/utils/calculateShare");

// transaction services
const txstate = require("../services/states");

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

		let master_code = transfer.master_code;
		let amount = Number(transfer.amount);
		let bankFee = calculateShare("bank", amount, fee);

		transfer.bankFee = bankFee;

		// check branch operational wallet balance
		let balance = await blockchain.getBalance(userWallet);
		if (Number(balance) < amount + bankFee) {
			return {
				status: 0,
				message: "Not enough balance. Recharge Your wallet.",
			};
		}

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
			child_code: master_code + "-p1",
			created_at: new Date(),
		};

		var res = await blockchain.initiateTransfer(trans1);

		// return response
		if (res.status == 0) {
			return {
				status: 0,
				message: "Transaction failed!",
				blockchain_message: res.message,
			};
		}

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
				child_code: master_code + "-p2",
				created_at: new Date(),
			};

			res = await blockchain.initiateTransfer(trans2);
			if (res.status == 0) {
				return {
					status: 0,
					message: "Transaction failed!",
					blockchain_message: res.message,
				};
			}
		}

		//fourth transaction
		bankComm = calculateShare("bank", amount, comm);
		transfer.bankComm = bankComm;
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
				child_code: master_code + "-p5",
				created_at: new Date(),
			};

			let res = await blockchain.initiateTransfer(trans5);
			if (res.status == 0) {
				return {
					status: 0,
					message: "Transaction failed!",
					blockchain_message: res.message,
				};
			}
		}

		distributeRevenue(transfer, infra, bank, fee, comm);

		return {
			status: 1,
			message: "Transaction success!",
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, infra, bank, fee, comm) {
	const bankOpWallet = bank.wallet_ids.operational;
	const infraOpWallet = bank.wallet_ids.infra_operational;

	let amount = transfer.amount;
	let master_code = transfer.master_code;
	let allTxSuccess = true;

	infraShare = calculateShare("infra", amount, fee);
	transfer.infraFeeShare = infraShare;
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
			child_code: master_code + "-p3",
			created_at: new Date(),
		};

		let res = await blockchain.initiateTransfer(trans31);
		if (res.status == 0) {
			allTxSuccess = false;
		}
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
			child_code: master_code + "-p4",
			created_at: new Date(),
		};

		let res = await blockchain.initiateTransfer(trans32);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}

	//fifth transaction
	infraShare = calculateShare("infra", amount, comm);
	transfer.infraCommShare = infraShare;
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
			child_code: master_code + "-p6",
			created_at: new Date(),
		};

		let res = await blockchain.initiateTransfer(trans6);
		if (res.status == 0) {
			allTxSuccess = false;
		}
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
			child_code: master_code + "-p7",
			created_at: new Date(),
		};

		let res = await blockchain.initiateTransfer(trans6);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}

	if (allTxSuccess) {
		txstate.nearCompletion(master_code);
		let res = await transferToMasterWallets(transfer, infra, bank);

		if (res.status == 1) {
			txstate.completed(master_code);
		}
		return res;
	} else {
		txstate.failed(transfer.master_code);
		return {
			status: 0,
			message: "Not all transactions are success, please check",
		};
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

		let txStatus = 1;

		let trans = {
			from: bankOpWallet,
			to: bankMasterWallet,
			amount: bankPart,
			note: "Bank share to its Master Wallet",
			email1: bank.email,
			mobile1: bank.mobile,
			from_name: bank.name,
			to_name: bank.name,
			user_id: "",
			master_code: master_code,
			child_code: master_code + "-m1",
			created_at: new Date(),
		};
		let result = await blockchain.initiateTransfer(trans);
		if (result.status == 0) {
			txStatus = 0;
		}

		trans = {
			from: infraOpWallet,
			to: infraMasterWallet,
			amount: infraPart,
			note: "Infra share to its Master Wallet",
			email1: infra.email,
			mobile1: infra.mobile,
			from_name: infra.name,
			to_name: infra.name,
			user_id: "",
			master_code: master_code,
			child_code: master_code + "-m2",
			created_at: new Date(),
		};
		result = await blockchain.initiateTransfer(trans);
		if (result.status == 0) {
			txStatus = 0;
		}

		if (txStatus == 0) {
			txstate.failed(transfer.master_code);
			return {
				status: 0,
				message: "Not all master wallet transfer is success",
			};
		} else {
			return { status: 1 };
		}
	} catch (err) {
		throw err;
	}
}
