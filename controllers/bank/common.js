//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const { queryTxStates } = require("../utils/common");
const { jwtAuthentication } = require("./utils");

//models
const Bank = require("../../models/Bank");
const TxState = require("../../models/TxState");

module.exports.queryTransactionStates = function (req, res) {
	const jwtusername = req.sign_creds.username;

	Bank.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, bank) {
			let errMsg = errorMessage(
				err,
				bank,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (errMsg.status == 0) {
				res.status(200).json(errMsg);
			} else {
				queryTxStates(bank._id, null, req, function (err, txstates) {
					if (err) {
						res.status(200).json(catchError(err));
					} else {
						res.status(200).json({
							status: 1,
							transactions: txstates,
						});
					}
				});
			}
		}
	);
};

module.exports.approveTxCancelRequest = function (req, res) {
	const { transaction_id } = req.body;
	jwtAuthentication(req, function (err, bank) {
		if (err) {
			res.status(200).json(err);
		} else {
			TxState.updateOne(
				{ _id: transaction_id, bank_id: bank._id },
				{
					cancel_approval: 1,
				},
				(err) => {
					if (err) {
						res.status(200).json(catchError(err));
					} else {
						res.status(200).json({
							status: 1,
							message: "Updated approval status",
						});
					}
				}
			);
		}
	});
};
