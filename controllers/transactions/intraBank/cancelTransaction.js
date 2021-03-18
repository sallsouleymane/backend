//services
const execute = require("../services/execute.js");
const qname = require("../constants/queueName");
const TxState = require("../../../models/TxState.js");
const { stateNames } = require("../constants/stateNames");

module.exports.revertOnlyAmount = async function (txstate) {
	try {
		revertTxId = txstate._id + "-s1";

		var txFound = false;
		var res;
		for (i = 0; i < txstate.childTx.length; i++) {
			if (
				txstate.childTx[i].transaction.child_code == revertTxId &&
				txstate.childTx[i].state == 1
			) {
				let waitTx = (cancelTx = txstate.childTx[i].transaction);
				cancelTx.from = waitTx.to;
				cancelTx.to = waitTx.from;
				cancelTx.email1 = waitTx.email2;
				cancelTx.email2 = waitTx.email1;
				cancelTx.mobile1 = waitTx.mobile2;
				cancelTx.mobile2 = waitTx.mobile1;
				cancelTx.from_name = waitTx.to_name;
				cancelTx.to_name = waitTx.from_name;
				cancelTx.sender_id = waitTx.receiver_id;
				cancelTx.receiver_id = waitTx.sender_id;
				cancelTx.note = "Transaction cancelled. Reverting the amount";
				cancelTx.child_code = waitTx.master_code + "-r1";
				res = await execute([cancelTx]);
				txFound = true;
				break;
			}
		}
		if (txFound == false) {
			return { status: 0, message: "No transaction found to revert." };
		}
		if (res.status == 0) {
			return { status: 0, message: "Transaction Failed - " + res.message };
		}
		return {
			status: 1,
			message: "Transaction success!",
		};
	} catch (err) {
		throw err;
	}
};

module.exports.revertAll = async function (txstate) {
	try {
		var txFound = false;
		var res;
		let id = 1;
		for (i = 0; i < txstate.childTx.length; i++) {
			if (txstate.childTx[i].state == 1) {
				let tx = txstate.childTx[i].transaction;
				let trans = tx;
				trans.from = tx.to;
				trans.to = tx.from;
				trans.note = "Transaction cancelled. Reverting the amount";
				trans.child_code = tx.master_code + "-r" + id++;
				res = await execute([trans]);
				txFound = true;
			}
		}
		if (txFound == false) {
			return { status: 0, message: "No transaction found to revert." };
		} else if (res.status == 0) {
			return { status: 0, message: "Transaction Failed - " + res.message };
		} else {
			return {
				status: 1,
				message: "Transaction success!",
			};
		}
	} catch (err) {
		throw err;
	}
};
