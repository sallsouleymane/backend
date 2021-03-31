//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const { jwtAuthentication } = require("./utils");

//models
const TxState = require("../../models/TxState");

// transactions
const cancelTransaction = require("../transactions/cancelTransaction");

module.exports.cancelTransaction = async function (req, res, next) {
	const { transaction_id } = req.body;
	jwtAuthentication(req, function (err, user) {
		if (err) {
			res.status(200).json(err);
		} else {
			cancelTransaction.run(transaction_id, (result) => {
				res.status(200).json(result);
			});
		}
	});
};

module.exports.sendForApproval = async function (req, res, next) {
	const { transaction_id } = req.body;
	jwtAuthentication(req, function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			TxState.findOneAndUpdate(
				{ _id: transaction_id, "cancel.approved": 0 },
				{
					$set: {
						cancel: { approved: 2 },
					},
				},
				(err, txstate) => {
					let errMsg = errorMessage(
						err,
						txstate,
						"Transaction is either already sent for approval or may be it is already approved or rejected. Please check the transaction status first."
					);
					if (errMsg.status == 0) {
						res.status(200).json(errMsg);
					} else {
						res.status(200).json({
							status: 1,
							message: "Sent for approval to branch Admin successfully",
						});
					}
				}
			);
		}
	});
};

module.exports.checkApprovalStatus = async function (req, res, next) {
	const { transaction_id } = req.body;
	jwtAuthentication(req, function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			TxState.findOne({ _id: transaction_id }, (err, txstate) => {
				let errRes = errorMessage(err, txstate, "Transaction not found");
				if (errRes.status == 0) {
					res.status(200).json(errRes);
				} else {
					res.status(200).json({
						status: 1,
						message: "Check Approval status",
						txstate: txstate,
					});
				}
			});
		}
	});
};
