//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const { jwtAuthentication } = require("../branch/utils");
const stateUpd = require("../transactions/services/states");

//models
const TxState = require("../../models/TxState");

//constants
const categoryConst = require("../transactions/constants/category");

// transactions
const cancelTransaction = require("../transactions/cancelTransaction");

module.exports.revertTransaction = async function (req, res, next) {
	const { transaction_id } = req.body;
	jwtAuthentication(req, function (err, branch) {
		if (err) {
			res.status(200).json(err);
		} else {
			TxState.findById(transaction_id, async (err1, txstate) => {
				let errMsg = errorMessage(err1, txstate, "Transaction not found");
				if (errMsg.status == 0) {
					res.status(200).json(errMsg);
				} else if (txstate.state.main == stateNames.DONE) {
					res.status(200).json({
						status: 0,
						message:
							"The money is already claimed. The transaction can not be cancelled.",
					});
				} else if (txstate.state.main == stateNames.CANCEL) {
					res.status(200).json({
						status: 0,
						message: "The transaction is already cancelled.",
					});
				} else if (txstate.state.main == stateNames.WAIT) {
					try {
						let result = await cancelTransaction.revertAll(txstate);
						if (result.status == 1) {
							stateUpd.cancelled(categoryConst.MAIN, transaction_id);
						}
						res.status(200).json(result);
					} catch (error) {
						res.status(200).json(catchError(error));
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
