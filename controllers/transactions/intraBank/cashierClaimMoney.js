//models
const TxState = require("../../../models/TxState.js");
const Infra = require("../../../models/Infra");

//services
const blockchain = require("../../../services/Blockchain.js");

//utils
const { calculateShare } = require("../../../routes/utils/calculateShare");
const getTypeClass = require("../../../routes/utils/getTypeClass");

// transaction services
const txstate = require("../services/states");
const execute = require("../services/execute.js");

//constants
const qname = require("../constants/queueName");
const categoryConst = require("../constants/category");
const childType = require("../constants/childType");

module.exports = async function (transfer, bank, branch, rule) {
	try {
		const bankEsWallet = bank.wallet_ids.escrow;
		const branchOpWallet = branch.wallet_ids.operational;
		const bankOpWallet = bank.wallet_ids.operational;

		transfer = getAllShares(transfer, rule);

		// // Check balance
		// var balance = await blockchain.getBalance(bankEsWallet);

		// // Check balance first
		// if (Number(balance) < amount) {
		// 	return {
		// 		status: 0,
		// 		message: "Not enough balance in bank escrow wallet",
		// 	};
		// }

		// // Check balance
		// balance = await blockchain.getBalance(bankOpWallet);

		// // Check balance first
		// if (Number(balance) < fee) {
		// 	return {
		// 		status: 0,
		// 		message: "Not enough balance in bank operational wallet",
		// 	};
		// }

		let trans = [
			{
				from: bankEsWallet,
				to: branchOpWallet,
				amount: transfer.exclusiveAmount,
				note: "Cashier claim Money",
				email1: bank.email,
				email2: branch.email,
				mobile1: bank.mobile,
				mobile2: branch.mobile,
				from_name: bank.name,
				to_name: branch.name,
				sender_id: bank._id,
				receiver_id: transfer.cashierId,
				master_code: transfer.master_code,
				child_code: transfer.master_code + childType.AMOUNT + "2",
				created_at: new Date(),
			},
		];

		if (transfer.fee > 0) {
			trans.push({
				from: bankOpWallet,
				to: branchOpWallet,
				amount: transfer.claimerShare,
				note: "Claim Revenue",
				email1: bank.email,
				email2: branch.email,
				mobile1: bank.mobile,
				mobile2: branch.mobile,
				from_name: bank.name,
				to_name: branch.name,
				sender_id: bank._id,
				receiver_id: transfer.cashierId,
				master_code: transfer.master_code,
				child_code: transfer.master_code + childType.CLAIMER,
				created_at: new Date(),
			});
		}

		let result = await execute(trans, categoryConst.MAIN);

		// return response
		if (result.status == 0) {
			return {
				status: 0,
				message: "Transaction failed! - " + result.message,
			};
		}

		distributeRevenue(transfer, bank, branch);
		return {
			status: 1,
			message: "Transaction success!",
			amount: transfer.exclusiveAmount,
			claimFee: transfer.claimerShare,
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, bank, branch) {
	try {
		let txInfo = await TxState.findById(transfer.master_code);
		let alltxsuccess = allTxSuccess(txInfo);
		if (alltxsuccess) {
			txstate.completed(categoryConst.DISTRIBUTE, transfer.master_code);
			transferToMasterWallets(transfer, bank, branch, txInfo);
		} else {
			txstate.failed(categoryConst.DISTRIBUTE, transfer.master_code);
		}
	} catch (err) {
		txstate.failed(categoryConst.DISTRIBUTE, transfer.master_code);
	}
}

async function transferToMasterWallets(transfer, bank, branch, txInfo) {
	try {
		txstate.initiateSubTx(categoryConst.MASTER, transfer.master_code);
		let master_code = transfer.master_code;
		let infra = await Infra.findOne({ _id: bank.user_id });
		let sendBranchPart = 0;
		let sendBranch = {};
		if (transfer.sendBranchType && transfer.sendBranchType != "") {
			const BranchType = getTypeClass(transfer.sendBranchType);
			sendBranch = await BranchType.findOne({ _id: transfer.sendBranchId });
			sendBranchPart = getPart(txInfo, master_code, [childType.SENDER], []);
		}

		const bankOpWallet = bank.wallet_ids.operational;
		const bankMasterWallet = bank.wallet_ids.master;
		const infraOpWallet = bank.wallet_ids.infra_operational;
		const infraMasterWallet = bank.wallet_ids.infra_master;
		const branchOpWallet = branch.wallet_ids.operational;
		const branchMasterWallet = branch.wallet_ids.master;

		let infraPart = getPart(
			txInfo,
			master_code,
			[childType.INFRA_PERCENT, childType.INFRA_FIXED],
			[]
		);
		let claimBranchPart = getPart(txInfo, master_code, [childType.CLAIMER], []);
		let bankPart = getPart(
			txInfo,
			master_code,
			[childType.REVENUE],
			[childType.INFRA_PERCENT, childType.SENDER, childType.CLAIMER]
		);

		let transPromises = [];
		var promise;

		let trans = [
			{
				from: bankOpWallet,
				to: bankMasterWallet,
				amount: bankPart,
				note: "Bank share",
				email1: bank.email,
				mobile1: bank.mobile,
				from_name: bank.name,
				to_name: bank.name,
				sender_id: bank._id,
				receiver_id: bank._id,
				master_code: master_code,
				child_code: master_code + childType.BANK_MASTER,
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
				note: "Infra share",
				email1: infra.email,
				mobile1: infra.mobile,
				from_name: infra.name,
				to_name: infra.name,
				sender_id: infra._id,
				receiver_id: infra._id,
				master_code: master_code,
				child_code: master_code + childType.INFRA_MASTER,
				created_at: new Date(),
			},
		];
		promise = execute(trans, categoryConst.MASTER, qname.INFRA_MASTER);
		transPromises.push(promise);

		if (sendBranchPart > 0) {
			const sendBranchOpWallet = sendBranch.wallet_ids.operational;
			const sendBranchMasterWallet = sendBranch.wallet_ids.master;
			trans = [
				{
					from: sendBranchOpWallet,
					to: sendBranchMasterWallet,
					amount: sendBranchPart,
					note: "Sending Branch share",
					email1: sendBranch.email,
					mobile1: sendBranch.mobile,
					from_name: sendBranch.name,
					to_name: sendBranch.name,
					sender_id: sendBranch._id,
					receiver_id: sendBranch._id,
					master_code: master_code,
					child_code: master_code + childType.SEND_MASTER,
					created_at: new Date(),
				},
			];
			promise = execute(trans, categoryConst.MASTER, qname.SEND_MASTER);
			transPromises.push(promise);
		}

		trans = [
			{
				from: branchOpWallet,
				to: branchMasterWallet,
				amount: claimBranchPart,
				note: "Claiming Branch share",
				email1: branch.email,
				mobile1: branch.mobile,
				from_name: branch.name,
				to_name: branch.name,
				sender_id: branch._id,
				receiver_id: branch._id,
				master_code: master_code,
				child_code: master_code + childType.CLAIM_MASTER,
				created_at: new Date(),
			},
		];
		promise = execute(trans, categoryConst.MASTER, qname.CLAIM_MASTER);
		transPromises.push(promise);

		Promise.all(transPromises).then((results) => {
			let allTxSucc = results.every((res) => {
				if (res.status == 0) {
					return false;
				} else {
					return true;
				}
			});
			if (allTxSucc) {
				txstate.completed(categoryConst.MASTER, transfer.master_code);
			} else {
				txstate.failed(categoryConst.MASTER, transfer.master_code);
			}
		});
	} catch (err) {
		txstate.failed(categoryConst.MASTER, transfer.master_code);
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
			if (childtx.transaction.child_code == masterId + childId) {
				myPart += childtx.transaction.amount;
			}
		}
	}

	if (otherIds.length > 0) {
		for (childtx of txInfo.childTx) {
			for (otherId of otherIds) {
				if (childtx.transaction.child_code == masterId + otherId) {
					othersPart += childtx.transaction.amount;
				}
			}
		}
	}

	return myPart - othersPart;
}

function getAllShares(transfer, rule) {
	let amount = transfer.amount;
	let exclusiveAmount = amount;
	let fee = calculateShare("bank", amount, rule);
	if (transfer.isInclusive) {
		exclusiveAmount = amount - fee;
	}
	let claimerShare = 0;
	if (fee > 0) {
		claimerShare = calculateShare(
			transfer.claimerType,
			amount,
			rule,
			{},
			transfer.claimerCode
		);
	}

	transfer.exclusiveAmount = exclusiveAmount;
	transfer.fee = fee;
	transfer.claimerShare = claimerShare;
	return transfer;
}
