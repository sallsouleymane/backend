const TxState = require("../../../models/TxState");
const blockchain = require("../../../services/Blockchain");

module.exports.initiate = async function (bank_id, tx_type, payer_id = "") {
	try {
		console.log("Transaction initiated");
		let tx = new TxState();
		tx.state = "INIT";
		tx.bankId = bank_id;
		tx.txType = tx_type;
		tx.payerId = payer_id;
		let txstate = await tx.save();
		return txstate._id;
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

module.exports.waitingForCompletion = async function (master_code) {
	try {
		console.log("Transaction waiting for completion");
		let tx = { state: "WAITING" };
		await TxState.updateOne({ _id: master_code }, tx);
	} catch (err) {
		throw err;
	}
};

module.exports.nearCompletion = async function (master_code) {
	try {
		console.log("Transaction near to completion");
		let tx = { state: "NEAR" };
		await TxState.updateOne({ _id: master_code }, tx);
	} catch (err) {
		throw err;
	}
};

module.exports.failed = async function (master_code) {
	try {
		console.log("Transaction failed");
		let tx = { state: "FAILED" };
		await TxState.updateOne({ _id: master_code }, tx);
	} catch (err) {
		throw err;
	}
};

module.exports.completed = async function completed(master_code) {
	try {
		console.log("Transaction Completed");
		let tx = { state: "DONE" };
		await TxState.updateOne({ _id: master_code }, tx);
	} catch (err) {
		throw err;
	}
};

module.exports.reported = async function reported(master_code) {
	try {
		console.log("Transaction Reported");
		let tx = { state: "REPORTED" };
		await TxState.updateOne({ _id: master_code }, tx);
	} catch (err) {
		throw err;
	}
};

module.exports.cancelled = async function (master_code) {
	let tx = {
		master_code: master_code,
		state: "CANCEl",
	};
	TxState.updateById(master_code, tx, function (err, txstate) {
		if (err) throw err;
		txstate.transaction.amount = -txstate.transaction.amount;
		txstate.transaction.note = "Reverted amount";
		blockchain.initiateTransfer(txstate.transaction);
	});
};
