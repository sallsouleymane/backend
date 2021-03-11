//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const { jwtAuthentication } = require("./utils");

//models
const TxState = require("../../models/TxState");

// transactions
const cancelTransaction = require("../transactions/intraBank/cancelCashToCash");

module.exports.cashierCancelTransaction = async function (req, res, next) {
	const { transaction_id } = req.body;
	jwtAuthentication(req, function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			TxState.findById(transaction_id, (err, txstate) => {
				let errMsg = errorMessage(err, txstate, "Transaction not found");
				if (errMsg.status == 0) {
					res.status(200).json(errMsg);
				} else if (txstate.state == stateNames.DONE) {
					res.status(200).json({
						status: 0,
						message:
							"The money is already claimed. The transaction can not be cancelled.",
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
				} else {
					cancelTransaction(transaction_id);
				}
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
			TxState.updateOne(
				{ _id: transaction_id },
				{
					cancel_approval: 2,
				},
				(err) => {
					if (err) {
						res.status(200).json(catchError(err));
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
