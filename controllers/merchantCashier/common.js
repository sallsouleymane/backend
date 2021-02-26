//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const { queryTxStates } = require("../utils/common");
const { jwtAuthentication } = require("./utils");


module.exports.queryTransactionStates = function (req, res) {
	const { bank_id } = req.body;
	jwtAuthentication(req, function (err, position) {
		if (err) {
			res.status(200).json(err);
		} else {
			queryTxStates(
				bank_id,
				position._id,
				req,
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
	});
};

