//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const { queryTxStates } = require("../utils/common");

//models
const Bank = require("../../models/Bank");

module.exports.queryTransactionStates = function (req, res) {
	var { status, date_after, date_before, page_start, limit } = req.body;
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
				queryTxStates(
					bank._id,
					null,
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
