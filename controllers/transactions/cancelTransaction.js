//services
const execute = require("./services/execute.js");
const TxState = require("../../models/TxState.js");

//constants
const qname = require("./constants/queueName");
const categoryConst = require("./constants/category.js");
const childType = require("./constants/childType");

module.exports.run = async function (transaction_id, next) {
	TxState.findById(transaction_id, async (err, txstate) => {
		let errMsg = errorMessage(err, txstate, "Transaction not found");
		if (errMsg.status == 0) {
			next(errMsg);
		} else if (txstate.state == stateNames.DONE) {
			next({
				status: 0,
				message:
					"The money is already claimed. The transaction can not be cancelled.",
			});
		} else if (txstate.state == stateNames.CANCEL) {
			next({
				status: 0,
				message: "The transaction is already cancelled.",
			});
		} else if (txstate.cancel_approval == 0) {
			next({
				status: 0,
				message: "Transaction is not sent for approval",
			});
		} else if (txstate.cancel_approval == -1) {
			next({
				status: 0,
				message: "Cancel request is rejected.",
			});
		} else if (txstate.cancel_approval == 2) {
			next({
				status: 0,
				message: "The request is not approved yet.",
			});
		} else if (txstate.state == stateNames.WAIT) {
			try {
				let result = await revertOnlyAmount(txstate);
				if (result.status == 1) {
					stateUpd.cancelled(categoryConst.MAIN, transaction_id);
				}
				next(result);
			} catch (err1) {
				next(catchError(err1));
			}
		} else {
			next({
				status: 0,
				message:
					"The state in which transaction is in does not allow it to cancel. Please check with the administrator.",
			});
		}
	});
};

async function revertOnlyAmount(txstate) {
	var txFound = false;
	var res;
	var cancelTx = [];
	for (let i = 0; i < txstate.childTx.length; i++) {
		let txChildType = fetchChildType(txstate.childTx[i].transaction.child_code);
		if (txChildType == childType.AMOUNT && txstate.childTx[i].state == 1) {
			let waitTx = ( cancelTx = txstate.childTx[i].transaction);
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
	if (txFound == false) {
		return { status: 0, message: "No transaction found to revert." };
	}

	res = await execute(cancelTx, categoryConst.MAIN);
	if (res.status == 0) {
		return { status: 0, message: "Transaction Failed - " + res.message };
	}
	return {
		status: 1,
		message: "Transaction success!",
	};
}

module.exports.revertAll = async function (txstate) {
	try {
		var txFound = false;
		let id = 1;
		var promise;
		var mainTrans = [];
		var distributePromises = [];
		var masterPromises = [];
		for (let i = 0; i < txstate.childTx.length; i++) {
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
				Promise.all(masterPromises).then((results1) => {
					let allTxSuccess1 = results1.every((res) => {
						if (res.status == 0) {
							return false;
						} else {
							return true;
						}
					});
					if (allTxSuccess1) {
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

function fetchChildType(code) {
	let subCode = code.substring(str.indexOf("-") + 1, 4);
	return subCode;
}
