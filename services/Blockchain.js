const doRequest = require("../routes/utils/doRequest");
const sendSMS = require("../routes/utils/sendSMS");
const sendMail = require("../routes/utils/sendMail");
const config = require("../config.json");
const TxState = require("../models/TxState");

module.exports.createWallet = async (arr) => {
	try {
		console.log("Blockchain service: createWallet " + arr);
		let err = [];
		await Promise.all(
			arr.map(async (url) => {
				let options = {
					uri: "http://" + config.blockChainIP + ":8000/createEWallet",
					method: "POST",
					json: {
						wallet_id: url,
						type: "test",
						remarks: "",
					},
				};
				let res = await doRequest(options);
				if (res.status === 0) {
					console.log(res);
					err.push(res.message);
				}
			})
		);
		return err.toString();
	} catch (err) {
		throw err;
	}
};

module.exports.getStatement = async (arr, user_id = "") => {
	try {
		console.log("Blockchain service: getStatement " + arr);
		let options = {
			uri: "http://" + config.blockChainIP + ":8000/getEWalletStatement",
			method: "POST",
			json: {
				wallet_id: arr.toString(),
				user_id: "",
			},
		};

		let res = await doRequest(options);
		if (res.status && res.status === 1) {
			return res.data;
		} else {
			console.log(res);
			return [];
		}
	} catch (err) {
		throw err;
	}
};

module.exports.rechargeNow = async (arr) => {
	try {
		console.log("Blockchain service: rechargeNow " + arr);
		var err = [];
		await Promise.all(
			arr.map(async (url) => {
				var options = {
					uri: "http://" + config.blockChainIP + ":8000/rechargeEWallet",
					method: "POST",
					json: {
						wallet_id: url.to.toString(),
						amount: url.amount.toString(),
						remarks: "recharge",
					},
				};
				let res = await doRequest(options);
				if (res.status == 1) {
					err.push(res.Reason);
				} else {
					console.log(res);
				}
			})
		);
		return err.toString();
	} catch (err) {
		throw err;
	}
};

module.exports.getChildStatements = async (arr) => {
	try {
		console.log("Blockchain service: getChildStatements " + arr);
		var options = {
			uri: "http://" + config.blockChainIP + ":8000/getChildIds",
			method: "POST",
			json: {
				master_id: arr.toString(),
			},
		};

		let res = await doRequest(options);
		console.log(res);
		if (res.status && res.status == 1) {
			return res.data;
		} else {
			return [];
		}
	} catch (err) {
		throw err;
	}
};

module.exports.getTransactionCount = async (arr) => {
	try {
		console.log("Blockchain service: getTransactionCount " + arr);
		var options = {
			uri: "http://" + config.blockChainIP + ":8000/getEWalletTransactionCount",
			method: "POST",
			json: {
				wallet_id: arr.toString(),
			},
		};

		let res = await doRequest(options);
		if (res.status && res.status == 1) {
			return res.data;
		} else {
			console.log(res);
			return 0;
		}
	} catch (err) {
		throw err;
	}
};

module.exports.getBalance = async (arr) => {
	try {
		console.log("Blockchain service: getBalance " + arr);
		var options = {
			uri: "http://" + config.blockChainIP + ":8000/showEWalletBalance",
			method: "POST",
			json: {
				wallet_id: arr.toString(),
			},
		};

		let res = await doRequest(options);
		if (res.status && res.status === 1) {
			return res.data.balance;
		} else {
			console.log(res);
			return 0;
		}
	} catch (err) {
		throw err;
	}
};

module.exports.initiateTransfer = async function (transaction, tx_id = "") {
	try {
		console.log("Blockchain service: initiateTransfer " + transaction);

		var options = {
			uri: "http://" + config.blockChainIP + ":8000/transferBtwEWallets",
			method: "POST",
			json: {
				wallet_from: transaction.from.toString(),
				wallet_to: transaction.to.toString(),
				amount: transaction.amount.toString(),
				from_name: transaction.from_name,
				to_name: transaction.to_name,
				user_id: "",
				remarks: transaction.note.toString(),
				master_id: transaction.master_code.toString(),
				child_id: transaction.child_code.toString(),
			},
		};
		let res = await doRequest(options);
		await saveTxState(transaction, res, tx_id);
		if (res.status == 1) {
			sendSuccessMail(transaction);
		} else {
			sendFailureMail(transaction);
		}
		return res;
	} catch (err) {
		throw err;
	}
};

async function sendSuccessMail(transaction) {
	if (transaction.email1 && transaction.email1 != "") {
		sendMail(
			"<p>You have sent " +
				transaction.amount +
				" to the wallet " +
				transaction.to +
				". Reason: " +
				transaction.note +
				"</p>",
			"Payment Sent",
			transaction.email1
		);
	}
	if (transaction.email2 && transaction.email2 != "") {
		sendMail(
			"<p>You have received " +
				transaction.amount +
				" from the wallet " +
				transaction.from +
				". Reason: " +
				transaction.note +
				"</p>",
			"Payment Received",
			transaction.email2
		);
	}
	if (transaction.mobile1 && transaction.mobile1 != "") {
		sendSMS(
			"You have sent " +
				transaction.amount +
				" to the wallet " +
				transaction.to +
				". Reason: " +
				transaction.note,
			transaction.mobile1
		);
	}
	if (transaction.mobile2 && transaction.mobile2 != "") {
		sendSMS(
			"You have received " +
				transaction.amount +
				" from the wallet " +
				transaction.from +
				". Reason: " +
				transaction.note,
			transaction.mobile2
		);
	}
}

async function sendFailureMail(transaction) {
	if (transaction.email1 && transaction.email1 != "") {
		sendMail(
			"<p>Transfer failed for the amount " +
				transaction.amount +
				" to the wallet " +
				transaction.to +
				". Reason: " +
				transaction.note +
				"</p>",
			"Payment failed",
			transaction.email1
		);
	}
	if (transaction.mobile1 && transaction.mobile1 != "") {
		sendSMS(
			"Transfer failed for the amount " +
				transaction.amount +
				" to the wallet " +
				transaction.to +
				+". Reason: " +
				transaction.note,
			transaction.mobile1
		);
	}
}

async function saveTxState(transaction, res) {
	try {
		console.log(res);
		//update transaction state
		let txstate = await TxState.findOneAndUpdate(
			{
				_id: transaction.master_code,
				"childTx.transaction.child_code": transaction.child_code,
			},
			{
				$set: {
					"childTx.$.state": res.status,
					"childTx.$.message": res.message,
					"childTx.$.transaction": transaction,
				},
			}
		);
		if (txstate == null) {
			await TxState.updateOne(
				{
					_id: transaction.master_code,
				},
				{
					$addToSet: {
						childTx: {
							state: res.status,
							transaction: transaction,
							message: res.message,
						},
					},
				}
			);
		}
	} catch (err) {
		console.log(err);
		// throw err;
	}
}
