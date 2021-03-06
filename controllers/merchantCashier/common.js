//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const { queryTxStates } = require("../utils/common");
const { jwtAuthentication } = require("./utils");

//models
const DailyReport = require("../../models/cashier/DailyReport");

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

module.exports.queryDailyReport = function (req, res) {
	const { date_after, date_before, page_start, limit } = req.body;

	jwtAuthentication(req, function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			var date_range = [];
			if (date_after && date_after != "") {
				date_after = new Date(date_after);
				date_range[0] = { created_at: { $gte: date_after.toISOString() } };
			}

			if (date_before && date_before != "") {
				date_before = new Date(date_before);
				date_range[1] = { created_at: { $lte: date_before.toISOString() } };
			}

			if (date_range.length == 0) {
				date_range[0] = { created_at: { $lte: Date.now() } };
			}

			DailyReport.find(
				{ cashier_id: cashier._id, $and: date_range },
				null,
				{ skip: page_start, limit: limit },
				(err, reports) => {
					if (err) {
						res.status(200).json(catchError(err));
					} else {
						res.status(200).json({ status: 1, reports: reports });
					}
				}
			);
		}
	});
};

