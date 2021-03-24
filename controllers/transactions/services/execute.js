const blockchain = require("../../../services/Blockchain.js");

const sendSMS = require("../../../routes/utils/sendSMS");
const sendMail = require("../../../routes/utils/sendMail");
const queue = require("./queue");

//Models
const TxState = require("../../../models/TxState");

//transactions
const txstate = require("./states");

//constants
const childType = require("../constants/childType");

module.exports = async function (transactions, category, queue_name = "") {
	return new Promise(async (resolve, reject) => {
		var res = await blockchain.initiateMultiTransfer(transactions);
		for (transaction of transactions) {
			await saveTxState(transaction, res, category);
			if (res.status == 1) {
				sendSuccessMail(transaction);
			} else {
				txstate.failed(category, transaction.master_code);
				sendFailureMail(transaction);
				if (queue_name != "") {
					queue.send(queue_name, transaction, category);
				}
			}
		}
		resolve(res);
	});
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

async function saveTxState(transaction, res, category) {
	try {
		//update status of retried child transaction
		let txstateDoc = await TxState.findOneAndUpdate(
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
		//update status new child transaction
		if (txstateDoc == null) {
			transaction.created_at = new Date();
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
							category: category,
						},
					},
				}
			);
		} else {
			if (allTxSuccess(category, txstateDoc)) {
				txstate.completed(category, transaction.master_code);
				// if (category == categoryConst.DISTRIBUTE) {
				// 	transferToMasterWallets(transaction.master_code, txstateDoc);
				// }
			}
		}
	} catch (err) {
		console.log(err);
		// throw err;
	}
}

function allTxSuccess(category, txstateDoc) {
	try {
		for (childtx of txstateDoc.childTx) {
			if (childtx.category == category && childtx.state == 0) {
				return false;
			}
		}
		return true;
	} catch (err) {
		throw err;
	}
}

function transferToMasterWallets(master_code, txstateDoc) {
	let share = getShares(txstateDoc);
	// calling a function to start master wallet transaction pending...
}

function getShares() {
	let bank_rev = 0;
	let infra_per = 0;
	let infra_fx = 0;
	let sender_share = 0;
	let claimer_share = 0;
	let partner_share = 0;
	let other_bank_share = 0;

	for (childtx of txstateDoc.childTx) {
		ctype = fetchChildType(childtx.child_code);
		if (ctype == childType.REVENUE) {
			bank_rev += childtx.amount;
		}
		if (ctype == childType.INFRA_PERCENT) {
			infra_per += childtx.amount;
		}
		if (ctype == childType.INFRA_FIXED) {
			infra_fx += childtx.amount;
		}
		if (ctype == childType.SENDER) {
			sender_share += childtx.amount;
		}
		if (ctype == childType.CLAIMER) {
			claimer_share += childtx.amount;
		}
		if (ctype == childType.PARTNER_SHARE) {
			partner_share += childtx.amount;
		}
		if (ctype == childType.OTHER_BANK_SHARE) {
			other_bank_share += childtx.amount;
		}
	}

	let bank_share =
		bank_rev -
		infra_per -
		sender_share -
		partner_share -
		claimer_share -
		other_bank_share;
	let infra_share = infra_per + infra_fx;
	return {
		bank_share: bank_share,
		infra_share: infra_share,
		sender_share: sender_share,
		claimer_share: claimer_share,
		partner_share: partner_share,
		other_bank_share: other_bank_share,
	};
}

function fetchChildType(code) {
	let subCode = code.substring(str.indexOf("-") + 1, 4);
	return subCode;
}
