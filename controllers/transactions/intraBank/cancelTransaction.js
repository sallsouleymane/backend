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
		var cancelTx = [];
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
				cancelTx.push(cancelTx);
				txFound = true;
				break;
			}
		}

		res = await execute(cancelTx, categoryConst.MAIN);
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
		let id = 1;
		var promise;
		var mainTrans = [];
		var distributePromises = [];
		var masterPromises = [];
		for (i = 0; i < txstate.childTx.length; i++) {
			if (
				txstate.childTx[i].category == categoryConst.MAIN &&
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
				cancelTx.child_code = tx.master_code + childType.REVERT + id++;
				mainTrans.push(cancelTx);
				txFound = true;
			}

			if (
				txstate.childTx[i].category == categoryConst.DISTRIBUTE &&
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
				cancelTx.child_code = tx.master_code + childType.REVERT + id++;
				promise = execute([cancelTx], categoryConst.DISTRIBUTE, qname.REVERT);
				distributePromises.push(promise);
				txFound = true;
			}

			if (
				txstate.childTx[i].category == categoryConst.MASTER &&
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
				cancelTx.child_code = tx.master_code + childType.REVERT + id++;
				promise = execute([cancelTx], categoryConst.MASTER, qname.REVERT);
				masterPromises.push(promise);
				txFound = true;
			}
		}

		if (txFound == false) {
			return { status: 0, message: "No transaction found to revert." };
		}

		let result = execute(mainTrans, categoryConst.MAIN, qname.REVERT);
		// return response
		if (result.status == 0) {
			return {
				status: 0,
				message: "Transaction failed! - " + result.message,
			};
		}

		Promise.all(distributePromises).then((results) => {
			let allTxSuccess = results.every((res) => {
				if (res.status == 0) {
					return false;
				} else {
					return true;
				}
			});
			if (allTxSuccess) {
				txstate.cancelled(categoryConst.DISTRIBUTE, transfer.master_code);
				Promise.all(masterPromises).then((results) => {
					let allTxSuccess = results.every((res) => {
						if (res.status == 0) {
							return false;
						} else {
							return true;
						}
					});
					if (allTxSuccess) {
						txstate.cancelled(categoryConst.MASTER, transfer.master_code);
					} else {
						txstate.failed(categoryConst.MASTER, transfer.master_code);
					}
				});
			} else {
				txstate.failed(categoryConst.DISTRIBUTE, transfer.master_code);
			}
		});

		return {
			status: 1,
			message: "Transaction success!",
		};
	} catch (err) {
		throw err;
	}
};
