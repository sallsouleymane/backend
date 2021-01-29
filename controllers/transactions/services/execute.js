const blockchain = require("../../../services/Blockchain.js");

const sendSMS = require("../../../routes/utils/sendSMS");
const sendMail = require("../../../routes/utils/sendMail");

//Models
const RetryQueue = require("../../../models/RetryQueue");
const TxState = require("../../../models/TxState");
const {
	getTransactionCode,
} = require("../../../routes/utils/calculateShare.js");

module.exports = async function (transaction, queue = "", bank_id) {
	try {
		var res = await blockchain.initiateTransfer(transaction);
		await saveTxState(transaction, res, bank_id);
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

async function saveTxState(transaction, res, bank_id) {
	try {
		//update transaction state
		let txstate = await TxState.findOneAndUpdate(
			{
				_id: transaction.master_code,
				"childTx.transaction.child_code": transaction.child_code,
			},
			{
				$set: {
					bankId: bank_id,
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

async function appendToQueue(transaction, queue, bank_id, response) {
	console.log("Append to queue: ", queue);
	RetryQueue.findOne({ queue_id: queue, bank_id: bank_id }, (err, rq) => {
		if (err) {
			throw err;
		} else if (rq == null) {
			let data = new RetryQueue();
			data.queue_id = queue;
			data.bank_id = bank_id;
			data.transactions = [
				{
					transaction: transaction,
					failure_reason: response,
				},
			];
			data.save((err) => {
				if (err) {
					throw err;
				} else {
					return true;
				}
			});
		} else {
			RetryQueue.updateOne(
				{ queue_id: queue, bank_id: bank_id },
				{
					$addToSet: {
						transactions: {
							transaction: transaction,
							failure_reason: response,
						},
					},
				},
				(err) => {
					if (err) {
						throw err;
					} else {
						return true;
					}
				}
			);
		}
	});
}
