//models
const TxState = require("../../models/TxState");

module.exports.queryTxStates = function (bankId, cashierId, req, next) {
	var { status, date_after, date_before, page_start, limit } = req.body;
	let date_range = [];
	if (date_after && date_after != "") {
		date_after = new Date(date_after);
		date_range[0] = { createdAt: { $gte: date_after.toISOString() } };
	}

	if (date_before && date_before != "") {
		date_before = new Date(date_before);
		date_range[1] = { createdAt: { $lte: date_before.toISOString() } };
	}

	if (date_range.length == 0) {
		date_range[0] = { created_at: { $lte: Date.now() } };
	}

	var status_query;
	if (status == "0") {
		status_query = { $elemMatch: { state: "0" } };
	} else if (status == "1") {
		status_query = { $not: { $elemMatch: { state: "0" } } };
	} else {
		status_query = { $elemMatch: {} };
	}

	console.log(date_range);
	console.log(status_query);

	TxState.find(
		{
			bankId: bankId,
			$or: [{ payerId: cashierId }, { receiverId: cashierId }],
			childTx: status_query,
			$and: date_range,
		},
		null,
		{ skip: page_start, limit: limit },
		(err, txstates) => {
			if (err) {
				next(err, null);
			} else {
				next(null, txstates);
			}
		}
	);
};
