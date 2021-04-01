//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const { jwtAuthentication } = require("../branch/utils");

//models
const TxState = require("../../models/TxState");

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
