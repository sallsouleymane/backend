const TxState = require("../../models/TxState");
const blockchain = require("../../services/Blockchain");

module.exports.initiate = async function () {
	try {
		console.log("Transaction initiated");
		let tx = new TxState();
		tx.state = "INIT";
		let txstate = await tx.save();
		return txstate._id;
	} catch (err) {
		throw err;
	}
};

module.exports.waitingForCompletion = async function (master_code) {
	try {
		let tx = { state: "WAIT" };
		await TxState.update({ _id: master_code }, tx);
	} catch (err) {
		throw err;
	}
};

module.exports.nearCompletion = async function (master_code) {
	try {
		let tx = { state: "NEAR" };
		await TxState.updateOne({ _id: master_code }, tx);
	} catch (err) {
		throw err;
	}
};

module.exports.failed = async function (master_code) {
	try {
		let tx = { state: "FAIL" };
		await TxState.updateOne({ _id: master_code }, tx);
	} catch (err) {
		throw err;
	}
};

module.exports.completed = async function completed(master_code) {
	try {
		let tx = { state: "DONE" };
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
