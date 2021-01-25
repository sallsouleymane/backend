//services
const blockchain = require("../../../services/Blockchain.js");
const { calculateShare } = require("../../../routes/utils/calculateShare");

// transaction services
const txstate = require("../states");

module.exports = async function (
	transfer,
	infra,
	bank,
	branch,
	merchant,
	fee,
	comm
) {
	try {
		// receiver's wallet names
		const branchOpWallet = branch.wallet_ids.operational;
		const merchantOpWallet = merchant.wallet_ids.operational;
		const bankOpWallet = bank.wallet_ids.operational;

		let master_code = transfer.master_code;
		// check branch operational wallet balance
		let amount = Number(transfer.amount);
		let bankFee = calculateShare("bank", amount, fee);
		var balance = await blockchain.getBalance(branchOpWallet);
		if (Number(balance) + Number(branch.credit_limit) < amount + bankFee) {
			return {
				status: 0,
				message: "Not enough balance. Recharge Your wallet.",
			};
		}

		let trans1 = {
			from: branchOpWallet,
			to: merchantOpWallet,
			amount: amount,
			note: "Bill amount",
			email1: branch.email,
			email2: merchant.email,
			mobile1: branch.mobile,
			mobile2: merchant.mobile,
			from_name: branch.name,
			to_name: merchant.name,
			master_code: master_code,
			child_code: master_code + "-p1",
			created_at: new Date(),
		};

		let res = await blockchain.initiateTransfer(trans1);

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
				from: branchOpWallet,
				to: bankOpWallet,
				amount: bankFee,
				note: "Bank fee on paid bill",
				email1: branch.email,
				email2: bank.email,
				mobile1: branch.mobile,
				mobile2: bank.mobile,
				from_name: branch.name,
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

		let bankComm = calculateShare("bank", amount, comm);
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
				child_code: master_code + "-p6",
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

		let payerType = transfer.payerType;
		let payerCode = transfer.payerCode;
		let partnerFeeShare = calculateShare(payerType, amount, fee, {}, payerCode);
		let partnerCommShare = calculateShare(
			payerType,
			amount,
			comm,
			{},
			payerCode
		);

		transfer.amount = amount;
		transfer.bankFee = bankFee;
		transfer.bankComm = bankComm;
		transfer.partnerFeeShare = partnerFeeShare;
		transfer.partnerCommShare = partnerCommShare;

		distributeRevenue(transfer, infra, bank, branch, fee, comm);
		return {
			status: 1,
			message: "Transaction success!",
			bankFee: bankFee,
			partnerFeeShare: partnerFeeShare,
			partnerCommShare: partnerCommShare,
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, infra, bank, branch, fee, comm) {
	const branchOpWallet = branch.wallet_ids.operational;
	const bankOpWallet = bank.wallet_ids.operational;
	const infraOpWallet = bank.wallet_ids.infra_operational;

	let master_code = transfer.master_code;
	let amount = transfer.amount;
	let allTxSuccess = true;

	//second transaction
	let bankFee = transfer.bankFee;
	let bankComm = transfer.bankComm;

	//third transaction
	infraShare = calculateShare("infra", amount, fee);
	transfer.infraFeeShare = infraShare;
	if (infraShare.percentage_amount > 0) {
		let trans31 = {
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
			note: "Fixed share on paid bill",
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

	if (bankFee > 0) {
		//fourth transaction
		partnerShare = transfer.partnerFeeShare;
		let trans4 = {
			from: bankOpWallet,
			to: branchOpWallet,
			amount: partnerShare,
			note: "Fee share on paid bill",
			email1: bank.email,
			email2: branch.email,
			mobile1: bank.mobile,
			mobile2: branch.mobile,
			from_name: bank.name,
			to_name: branch.name,
			master_code: master_code,
			child_code: master_code + "-p5",
			created_at: new Date(),
		};

		let res = await blockchain.initiateTransfer(trans4);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}

	//sixth transaction
	infraShare = calculateShare("infra", amount, comm);
	transfer.infraCommShare = infraShare;
	if (infraShare.percentage_amount > 0) {
		let trans61 = {
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
			master_code: master_code,
			child_code: master_code + "-p7",
			created_at: new Date(),
		};

		let res = await blockchain.initiateTransfer(trans61);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}
	if (infraShare.fixed_amount > 0) {
		let trans62 = {
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
			master_code: master_code,
			child_code: master_code + "-p8",
			created_at: new Date(),
		};

		let res = await blockchain.initiateTransfer(trans62);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}

	if (bankComm > 0) {
		//seventh transaction
		partnerShare = transfer.partnerCommShare;
		let trans7 = {
			from: bankOpWallet,
			to: branchOpWallet,
			amount: partnerShare,
			note: "Commission share on paid bill",
			email1: bank.email,
			email2: branch.email,
			mobile1: bank.mobile,
			mobile2: branch.mobile,
			from_name: bank.name,
			to_name: branch.name,
			master_code: master_code,
			child_code: master_code + "-p9",
			created_at: new Date(),
		};

		let res = await blockchain.initiateTransfer(trans7);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}

	if (allTxSuccess) {
		txstate.nearCompletion(master_code);
		transferToMasterWallets(transfer, infra, bank, branch);
	} else {
		txstate.failed(transfer.master_code);
	}
}

async function transferToMasterWallets(transfer, infra, bank, branch) {
	const bankOpWallet = bank.wallet_ids.operational;
	const bankMasterWallet = bank.wallet_ids.master;
	const infraOpWallet = bank.wallet_ids.infra_operational;
	const infraMasterWallet = bank.wallet_ids.infra_master;
	const branchOpWallet = branch.wallet_ids.operational;
	const branchMasterWallet = branch.wallet_ids.master;

	let master_code = transfer.master_code;

	let infraPart =
		transfer.infraFeeShare.percentage_amount +
		transfer.infraFeeShare.fixed_amount +
		transfer.infraCommShare.percentage_amount +
		transfer.infraCommShare.fixed_amount;
	let sendBranchPart = transfer.partnerFeeShare + transfer.partnerCommShare;
	let bankPart =
		transfer.bankFee +
		transfer.bankComm -
		transfer.infraFeeShare.percentage_amount -
		transfer.infraCommShare.percentage_amount -
		sendBranchPart;

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

	trans = {
		from: branchOpWallet,
		to: branchMasterWallet,
		amount: sendBranchPart,
		note: "Sending Branch share to its Master Wallet",
		email1: branch.email,
		mobile1: branch.mobile,
		from_name: branch.name,
		to_name: branch.name,
		user_id: "",
		master_code: master_code,
		child_code: master_code + "-m3",
		created_at: new Date(),
	};
	result = await blockchain.initiateTransfer(trans);
	if (result.status == 0) {
		txStatus = 0;
	}

	if (txStatus == 0) {
		txstate.failed(transfer.master_code);
	} else {
		txstate.completed(master_code);
	}
}
