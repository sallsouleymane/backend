//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const { queryTxStates } = require("../utils/common");

//models
const Cashier = require("../../models/Cashier");

module.exports.queryTransactionStates = function (req, res) {
	var { status, date_after, date_before, page_start, limit } = req.body;
	const jwtusername = req.sign_creds.username;

	Cashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let errMsg = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (errMsg.status == 0) {
				res.status(200).json(errMsg);
			} else {
				queryTxStates(
					cashier.bank_id,
					cashier._id,
					status,
					date_after,
					date_before,
					page_start,
					limit,
					function (err, txstates) {
						if (err) {
							res.status(200).json(catchError(err));
						} else {
							res.status(200).json({
								status: 1,
								transactions: txstates,
							});
						}
					}
				);
			}
		}
	);
};
