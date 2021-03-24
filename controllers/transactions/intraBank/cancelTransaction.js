//services
const execute = require("../services/execute.js");
const TxState = require("../../../models/TxState.js");

//constants
const qname = require("../constants/queueName");
const categoryConst = require("../constants/category.js");
const childType = require("../constants/childType");

module.exports.revertOnlyAmount = async function (txstate) {
	try {
		revertTxId = txstate._id + childType.AMOUNT;

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
				cancelTx.child_code = waitTx.master_code + childType.REVERT;
				res = await execute([cancelTx], categoryConst.REVERT);
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
				trans.child_code = tx.master_code + childType.REVERT + id++;
				promise = execute([trans], txstate.childTx[i].REVERT, qname.REVERT);
				transPromises.push(promise);
				txFound = true;
			}
		}

		if (txFound == false) {
			return { status: 0, message: "No transaction found to revert." };
		}

		Promise.all(transPromises).then((results) => {
			let allTxSuccess = results.every((res) => {
				if (res.status == 0) {
					return false;
				} else {
					return true;
				}
			});
			if (allTxSuccess) {
				txstate.completed(categoryConst.REVERT, transfer.master_code);
				return {
					status: 1,
					message: "Transaction success!",
				};
			} else {
				txstate.failed(categoryConst.REVERT, transfer.master_code);
				return { status: 0, message: "Transaction Failed ", results: results };
			}
		});
	} catch (err) {
		throw err;
	}
};
