//models
const TxState = require("../../../models/TxState.js");
const Infra = require("../../../models/Infra");

//services
const blockchain = require("../../../services/Blockchain.js");
const { calculateShare } = require("../../utils/calculateShare");
const txstate = require("../states");

module.exports = async function (transfer, bank, branch, sendBranch, rule1) {
	try {
		const bankEsWallet = bank.wallet_ids.escrow;
		const branchOpWallet = branch.wallet_ids.operational;

		var amount = Number(transfer.amount);
		var fee = calculateShare("bank", transfer.amount, rule1);
		if (transfer.isInclusive) {
			amount = amount - fee;
		}

		let master_code = transfer.master_code;
		let childId = 1;

		let trans = {
			from: bankEsWallet,
			to: branchOpWallet,
			amount: amount,
			note: "Cashier claim Money",
			email1: bank.email,
			email2: branch.email,
			mobile1: bank.mobile,
			mobile2: branch.mobile,
			from_name: bank.name,
			to_name: branch.name,
			user_id: "",
			master_code: master_code,
			child_code: master_code + "-c" + childId++,
			master: true,
		};

		let result = await blockchain.initiateTransfer(trans);

		// return response
		if (result.status == 0) {
			return {
				status: 0,
				message: "Transaction failed!",
				blockchain_message: result.message,
			};
		}

		var claimerBranchShare = 0;
		if (fee > 0) {
			claimerBranchShare = calculateShare(
				"claimBranch",
				transfer.amount,
				rule1,
				{},
				branch.bcode
			);
		}
		transfer.fee = fee;
		transfer.claimerBranchShare = claimerBranchShare;
		transfer.master_code = master_code;
		transfer.childId = childId;
		let res = await distributeRevenue(transfer, bank, branch, sendBranch);

		return res;
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, bank, branch, sendBranch) {
	try {
		const branchOpWallet = branch.wallet_ids.operational;
		const bankOpWallet = bank.wallet_ids.operational;

		let fee = transfer.fee;
		let master_code = transfer.master_code;

		if (fee > 0) {
			let trans3 = {
				from: bankOpWallet,
				to: branchOpWallet,
				amount: transfer.claimerBranchShare,
				note: "Claim Revenue",
				email1: bank.email,
				email2: branch.email,
				mobile1: bank.mobile,
				mobile2: branch.mobile,
				from_name: bank.name,
				to_name: branch.name,
				user_id: "",
				master_code: master_code,
				child_code: master_code + "-c" + transfer.childId++,
			};
			let result = await blockchain.initiateTransfer(trans3);
			if (result.status == 0) {
				txstate.failed(transfer.master_code);
				return {
					status: 0,
					message: "Fee transfer failed",
				};
			}
		}
		txstate.nearCompletion(master_code);
		let txInfo = await TxState.findById(master_code);
		let alltxsuccess = allTxSuccess(txInfo);
		if (alltxsuccess) {
			let res = await transferToMasterWallets(
				transfer,
				bank,
				branch,
				sendBranch,
				txInfo
			);

			if (res.status == 1) {
				txstate.completed(master_code);
			}
			return res;
		} else {
			return {
				status: 0,
				message: "Not all transactions are success, please check",
			};
		}
	} catch (err) {
		throw err;
	}
}

async function transferToMasterWallets(
	transfer,
	bank,
	branch,
	sendBranch,
	txInfo
) {
	try {
		const bankOpWallet = bank.wallet_ids.operational;
		const bankMasterWallet = bank.wallet_ids.master;
		const infraOpWallet = bank.wallet_ids.infra_operational;
		const infraMasterWallet = bank.wallet_ids.infra_master;
		const branchOpWallet = branch.wallet_ids.operational;
		const branchMasterWallet = branch.wallet_ids.master;
		const sendBranchOpWallet = sendBranch.wallet_ids.operational;
		const sendBranchMasterWallet = sendBranch.wallet_ids.master;

		let infraPart = getPart(txInfo, infraOpWallet, 0);
		let branchPart = getPart(txInfo, branchOpWallet, 0);
		let sendBranchPart = getPart(txInfo, sendBranchOpWallet, 0);
		let othersPart = infraPart + branchPart + sendBranchPart;
		let bankPart = getPart(txInfo, bankOpWallet, othersPart);

		let master_code = transfer.master_code;
		var childId = 1;
		let txStatus = 1;

		let infra = await Infra.findOne({ _id: bank.user_id });

		let trans = {
			from: bankOpWallet,
			to: bankMasterWallet,
			amount: bankPart,
			note: "Bank share",
			email1: bank.email,
			mobile1: bank.mobile,
			from_name: bank.name,
			to_name: bank.name,
			user_id: "",
			master_code: master_code,
			child_code: master_code + "-m" + childId++,
		};
		let result = await blockchain.initiateTransfer(trans);
		if (result.status == 0) {
			txStatus = 0;
		}

		trans = {
			from: infraOpWallet,
			to: infraMasterWallet,
			amount: infraPart,
			note: "Infra share",
			email1: infra.email,
			mobile1: infra.mobile,
			from_name: infra.name,
			to_name: infra.name,
			user_id: "",
			master_code: master_code,
			child_code: master_code + "-m" + childId++,
		};
		result = await blockchain.initiateTransfer(trans);
		if (result.status == 0) {
			txStatus = 0;
		}

		trans = {
			from: sendBranchOpWallet,
			to: sendBranchMasterWallet,
			amount: sendBranchPart,
			note: "Sending Branch share",
			email1: sendBranch.email,
			mobile1: sendBranch.mobile,
			from_name: sendBranch.name,
			to_name: sendBranch.name,
			user_id: "",
			master_code: master_code,
			child_code: master_code + "-m" + childId++,
		};
		result = await blockchain.initiateTransfer(trans);
		if (result.status == 0) {
			txStatus = 0;
		}

		trans = {
			from: branchOpWallet,
			to: branchMasterWallet,
			amount: branchPart,
			note: "Claiming Branch share",
			email1: branch.email,
			mobile1: branch.mobile,
			from_name: branch.name,
			to_name: branch.name,
			user_id: "",
			master_code: master_code,
			child_code: master_code + "-m" + childId++,
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
			return { status: 1, message: "Transaction success!!" };
		}
	} catch (err) {
		throw err;
	}
}

function allTxSuccess(txInfo) {
	try {
		for (childtx of txInfo.childTx) {
			if (childtx.state == 0) {
				return false;
			}
		}
		return true;
	} catch (err) {
		throw err;
	}
}

function getPart(txInfo, wallet, otherPart) {
	let myPart = 0;
	for (childtx of txInfo.childTx) {
		if (childtx.transaction.to == wallet && !childtx.transaction.master) {
			myPart += childtx.transaction.amount;
		}
	}

	return myPart - otherPart;
}
