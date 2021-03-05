const blockchain = require("../../../services/Blockchain.js");

const sendSMS = require("../../../routes/utils/sendSMS");
const sendMail = require("../../../routes/utils/sendMail");
const queue = require("./queue");

//Models
const TxState = require("../../../models/TxState");

module.exports = async function (transactions, queue_name = "") {
	try {
		var res = await blockchain.initiateMultiTransfer(transactions);
		for (transaction of transactions) {
			await saveTxState(transaction, res);
			if (res.status == 1) {
				sendSuccessMail(transaction);
			} else {
				sendFailureMail(transaction);
				if (queue_name != "") {
					queue.send(queue_name, [transaction]);
				}
			}
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
					"childTx.$.retry_at": Date.now(),
				},
				$inc: {
					"childTx.$.retry_count": 1,
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
