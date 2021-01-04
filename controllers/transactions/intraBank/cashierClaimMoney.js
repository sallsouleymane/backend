//models
const TxState = require("../../../models/TxState.js");
const Infra = require("../../../models/Infra");

//services
const blockchain = require("../../../services/Blockchain.js");
const { calculateShare } = require("../../../routes/utils/calculateShare");
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
			child_code: master_code + "-c1",
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

		var claimFee = 0;
		if (fee > 0) {
			claimFee = calculateShare(
				transfer.claimerType,
				transfer.amount,
				rule1,
				{},
				transfer.claimerCode
			);
		}
		transfer.fee = fee;
		transfer.claimFee = claimFee;
		transfer.master_code = master_code;
		transfer.childId = childId;
		let res = await distributeRevenue(transfer, bank, branch, sendBranch);

		if (res.status == 0) {
			return res;
		} else {
			return {
				status: 1,
				message: "Transaction success!",
				amount: amount,
				claimFee: claimFee,
			};
		}
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
				amount: transfer.claimFee,
				note: "Claim Revenue",
				email1: bank.email,
				email2: branch.email,
				mobile1: bank.mobile,
				mobile2: branch.mobile,
				from_name: bank.name,
				to_name: branch.name,
				user_id: "",
				master_code: master_code,
				child_code: master_code + "-c2",
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

		let master_code = transfer.master_code;

		let infraPart = getPart(txInfo, master_code, ["s3", "s4"], []);
		let sendBranchPart = getPart(txInfo, master_code, ["s5"], []);
		let claimBranchPart = getPart(txInfo, master_code, ["c2"], []);
		let bankPart = getPart(txInfo, master_code, ["s2"], ["s3", "s5", "c2"]);

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
			child_code: master_code + "-m1",
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
			child_code: master_code + "-m2",
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
			child_code: master_code + "-m3",
		};
		result = await blockchain.initiateTransfer(trans);
		if (result.status == 0) {
			txStatus = 0;
		}

		trans = {
			from: branchOpWallet,
			to: branchMasterWallet,
			amount: claimBranchPart,
			note: "Claiming Branch share",
			email1: branch.email,
			mobile1: branch.mobile,
			from_name: branch.name,
			to_name: branch.name,
			user_id: "",
			master_code: master_code,
			child_code: master_code + "-m4",
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

function getPart(txInfo, masterId, childIds, otherIds) {
	let myPart = 0;
	let othersPart = 0;
	for (childtx of txInfo.childTx) {
		for (childId of childIds) {
			if (childtx.transaction.child_code == masterId + "-" + childId) {
				myPart += childtx.transaction.amount;
			}
		}
	}

	if (otherIds.length > 0) {
		for (childtx of txInfo.childTx) {
			for (otherId of otherIds) {
				if (childtx.transaction.child_code == masterId + "-" + otherId) {
					othersPart += childtx.transaction.amount;
				}
			}
		}
	}

	return myPart - othersPart;
}
