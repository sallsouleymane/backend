/* If this file is updated, also build docker for receive.js which is a rabbitmq queue receiver*/

const TxState = require("../../../models/TxState");
const stateConst = require("../constants/stateNames");

module.exports.initiate = async function (
	category,
	bank_id,
	tx_type,
	payer_id = "",
	cash_in_hand = 0,
	transaction = {},
) {
	try {
		console.log(category + " transaction initiated");
		let tx = new TxState();
		tx.state[category] = stateConst.INIT;
		tx.bankId = bank_id;
		tx.txType = tx_type;
		tx.payerId = payer_id;
		tx.cash_in_hand = cash_in_hand;
		tx.transaction = transaction;
		let txstate = await tx.save();
		return txstate._id;
	} catch (err) {
		throw err;
	}
};

module.exports.initiateSubTx = async function (category, master_code) {
	try {
		console.log(category + " transaction initiated");
		var tx = {};
		tx["state." + category] = stateConst.INIT;
		await TxState.updateOne({ _id: master_code }, { $set: tx });
	} catch (err) {
		throw err;
	}
};

module.exports.updateClaimer = async function (master_code, receiver_id) {
	try {
		console.log("Updated claimer id");
		let tx = { receiverId: receiver_id };
		await TxState.updateOne({ _id: master_code }, tx);
	} catch (err) {
		throw err;
	}
};

module.exports.waitingForCompletion = async function (
	category,
	master_code,
	transaction = {}
) {
	try {
		console.log(category + " transaction waiting for completion");
		let tx = {};
		tx["state." + category] = stateConst.WAIT;
		tx.transaction = transaction;
		await TxState.updateOne({ _id: master_code }, tx);
	} catch (err) {
		throw err;
	}
};

module.exports.failed = async function (
	category,
	master_code,
	cash_in_hand = 0
) {
	try {
		console.log(category + " transaction failed");
		let tx = {};
		tx["state." + category] = stateConst.FAIL;
		tx.cash_in_hand = cash_in_hand;
		await TxState.updateOne({ _id: master_code }, { $set: tx });
	} catch (err) {
		throw err;
	}
};

module.exports.completed = async function completed(
	category,
	master_code,
	cash_in_hand = 0
) {
	try {
		console.log(category + " transaction Completed");
		let tx = {};
		tx["state." + category] = stateConst.DONE;
		tx.cash_in_hand = cash_in_hand;
		console.log(tx);
		await TxState.updateOne({ _id: master_code }, { $set: tx });
	} catch (err) {
		throw err;
	}
};

module.exports.cancelled = async function (category, master_code) {
	try {
		console.log(category + " transaction Cancelled");
		let tx = {};
		tx["state." + category] = stateConst.REVERT;
		await TxState.updateOne({ _id: master_code }, tx);
	} catch (err) {
		throw err;
	}
};
