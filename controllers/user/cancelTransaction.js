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
				(err1, txstate) => {
					let errMsg1 = errorMessage(
						err1,
						txstate,
						"Transaction is either already sent for approval or may be it is already approved or rejected. Please check the transaction status first."
					);
					if (errMsg1.status == 0) {
						res.status(200).json(errMsg1);
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
			TxState.findOne({ _id: transaction_id }, (err1, txstate) => {
				let errRes1 = errorMessage(err1, txstate, "Transaction not found");
				if (errRes1.status == 0) {
					res.status(200).json(errRes1);
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
