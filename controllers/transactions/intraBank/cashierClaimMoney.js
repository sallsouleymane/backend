//models
const TxState = require("../../../models/TxState.js");
const Infra = require("../../../models/Infra");

//services
const blockchain = require("../../../services/Blockchain.js");

//utils
const { calculateShare } = require("../../../routes/utils/calculateShare");
const getTypeClass = require("../../../routes/utils/getTypeClass");

//transaction
const txstate = require("../services/states");
const execute = require("../services/execute.js");

module.exports = async function (transfer, bank, branch, rule1) {
	try {
		const bankEsWallet = bank.wallet_ids.escrow;
		const branchOpWallet = branch.wallet_ids.operational;

		var amount = Number(transfer.amount);
		var fee = calculateShare("bank", transfer.amount, rule1);
		if (transfer.isInclusive) {
			amount = amount - fee;
		}

		// Check balance
		var balance = await blockchain.getBalance(bankEsWallet);

		// Check balance first
		if (Number(balance) < amount + fee) {
			return {
				status: 0,
				message: "Not enough balance in branch operational wallet",
			};
		}

		let master_code = transfer.master_code;

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
			sender_id: bank._id,
			receiver_id: transfer.cashierId,
			master_code: master_code,
			child_code: master_code + "-c1",
			created_at: new Date(),
		};

		let result = await execute(trans, "CLAIMAMOUNT");

		// return response
		if (result.status == 0) {
			return {
				status: 0,
				message: "Transaction failed! - " + result.message,
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
		distributeRevenue(transfer, bank, branch);

		return {
			status: 1,
			message: "Transaction success!",
			amount: amount,
			claimFee: claimFee,
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, bank, branch) {
	const branchOpWallet = branch.wallet_ids.operational;
	const bankOpWallet = bank.wallet_ids.operational;

	let fee = transfer.fee;
	let master_code = transfer.master_code;

	if (fee > 0) {
		let trans = {
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
			sender_id: bank._id,
			receiver_id: transfer.cashierId,
			master_code: master_code,
			child_code: master_code + "-c2",
			created_at: new Date(),
		};
		await execute(trans, "CLAIMFEE");
	}
	let txInfo = await TxState.findById(master_code);
	let alltxsuccess = allTxSuccess(txInfo);
	if (alltxsuccess) {
		// txstate.nearCompletion(master_code);
		transferToMasterWallets(transfer, bank, branch, txInfo);
	}
}

async function transferToMasterWallets(transfer, bank, branch, txInfo) {
	let master_code = transfer.master_code;
	let infra = await Infra.findOne({ _id: bank.user_id });
	let sendBranchPart = 0;
	let sendBranch = {};
	if (transfer.sendBranchType && transfer.sendBranchType != "") {
		const BranchType = getTypeClass(transfer.sendBranchType);
		sendBranch = await BranchType.findOne({ _id: transfer.sendBranchId });
		sendBranchPart = getPart(txInfo, master_code, ["s5"], []);
	}

	const bankOpWallet = bank.wallet_ids.operational;
	const bankMasterWallet = bank.wallet_ids.master;
	const infraOpWallet = bank.wallet_ids.infra_operational;
	const infraMasterWallet = bank.wallet_ids.infra_master;
	const branchOpWallet = branch.wallet_ids.operational;
	const branchMasterWallet = branch.wallet_ids.master;

	let infraPart = getPart(txInfo, master_code, ["s3", "s4"], []);
	let claimBranchPart = getPart(txInfo, master_code, ["c2"], []);
	let bankPart = getPart(txInfo, master_code, ["s2"], ["s3", "s5", "c2"]);
	let txStatus = 1;

	let trans = {
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
		child_code: master_code + "-m1",
		created_at: new Date(),
	};
	let result = await execute(trans, "BANKMASTER");
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
		sender_id: infra._id,
		receiver_id: infra._id,
		master_code: master_code,
		child_code: master_code + "-m2",
		created_at: new Date(),
	};
	result = await execute(trans, "INFRAMASTER");
	if (result.status == 0) {
		txStatus = 0;
	}

	if (sendBranchPart > 0) {
		const sendBranchOpWallet = sendBranch.wallet_ids.operational;
		const sendBranchMasterWallet = sendBranch.wallet_ids.master;
		trans = {
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
			child_code: master_code + "-m3",
			created_at: new Date(),
		};
		result = await execute(trans, "SENDMASTER");
		if (result.status == 0) {
			txStatus = 0;
		}
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
		sender_id: branch._id,
		receiver_id: branch._id,
		master_code: master_code,
		child_code: master_code + "-m4",
		created_at: new Date(),
	};
	result = await execute(trans, "CLAIMMASTER");
	if (result.status == 0) {
		txStatus = 0;
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
