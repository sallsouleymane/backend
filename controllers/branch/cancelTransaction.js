//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const { jwtAuthentication } = require("./utils");

//models
const TxState = require("../../models/TxState");

// transactions
const cancelTransaction = require("../transactions/intraBank/cancelTransaction");

module.exports.cancelTransaction = async function (req, res, next) {
	const { transaction_id } = req.body;
	jwtAuthentication(req, function (err, branch) {
		if (err) {
			res.status(200).json(err);
		} else {
			TxState.findById(transaction_id, async (err, txstate) => {
				let errMsg = errorMessage(err, txstate, "Transaction not found");
				if (errMsg.status == 0) {
					res.status(200).json(errMsg);
				} else if (txstate.state == stateNames.DONE) {
					res.status(200).json({
						status: 0,
						message:
							"The money is already claimed. The transaction can not be cancelled.",
					});
				} else if (txstate.state == stateNames.CANCEL) {
					res.status(200).json({
						status: 0,
						message: "The transaction is already cancelled.",
					});
				} else if (txstate.cancel_approval == 0) {
					res.status(200).json({
						status: 0,
						message: "Transaction is not sent for approval",
					});
				} else if (txstate.cancel_approval == -1) {
					res.status(200).json({
						status: 0,
						message: "Cancel request is rejected.",
					});
				} else if (txstate.cancel_approval == 2) {
					res.status(200).json({
						status: 0,
						message: "The request is not approved yet.",
					});
				} else if (txstate.state == stateNames.WAIT) {
					try {
						let result = await cancelTransaction.revertAll(txstate);
						if (result.status == 1) {
							stateUpd.cancelled(transaction_id);
						}
						res.status(200).json(result);
					} catch (err) {
						res.status(200).json(catchError(err));
					}
				} else {
					res.status(200).json({
						status: 0,
						message:
							"The state in which transaction is in does not allow it to cancel. Please check with the administrator.",
					});
				}
			});
		}
	});
};

module.exports.approveCancelRequest = async function (req, res, next) {
	const { transaction_id } = req.body;
	jwtAuthentication(req, function (err, branch) {
		if (err) {
			res.status(200).json(err);
		} else {
			TxState.findOneAndUpdate(
				{ _id: transaction_id, "cancel.approved": 2 },
				{
					$set: {
						cancel: { approved: 1 },
					},
				},
				(err, txstate) => {
					let errMsg = errorMessage(
						err,
						txstate,
						"Transaction is either not sent for approval or may be it is already rejected. Please check the transaction status first."
					);
					if (errMsg.status == 0) {
						res.status(200).json(errMsg);
					} else {
						res.status(200).json({
							status: 1,
							message: "Approved cancel request",
						});
					}
				}
			);
		}
	});
};

module.exports.rejectCancelRequest = async function (req, res, next) {
	const { transaction_id, reason } = req.body;
	jwtAuthentication(req, function (err, branch) {
		if (err) {
			res.status(200).json(err);
		} else {
			TxState.updateOne(
				{ _id: transaction_id, "cancel.approved": 2 },
				{
					$set: {
						cancel: { approved: -1, reason: reason },
					},
				},
				(err, txstate) => {
					let errMsg = errorMessage(
						err,
						txstate,
						"Transaction is either not sent for approval or may be it is already approved. Please check the transaction status first."
					);
					if (errMsg.status == 0) {
						res.status(200).json(errMsg);
					} else {
						res.status(200).json({
							status: 1,
							message: "Rejected cancel request",
						});
					}
				}
			);
		}
	});
};
