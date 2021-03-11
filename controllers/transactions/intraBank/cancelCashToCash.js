//services
const execute = require("../services/execute.js");
const qname = require("../constants/queueName");
const TxState = require("../../../models/TxState.js");
const { stateNames } = require("../constants/stateNames");

module.exports = async function (txstate) {
	try {
		revertTxId = transaction_id + "-s1";

		var res;
		for (i = 0; i < txstate.childTx.length; i++) {
			if (txstate.childTx[i].transaction.child_code == revertTxId) {
				let tx = txstate.childTx[i].transaction;
				let trans = tx;
				trans.from = tx.to;
				trans.to = tx.from;
				trans.note = "Transaction cancelled. Reverting the amount";
				trans.child_code = tx.master_code + "-r" + (i + 1);
				res = await execute([trans], qname.revert);
				break;
			}
		}
		if (res.status == 0) {
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
