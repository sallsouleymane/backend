//utils
const getTypeClass = require("../../routes/utils/getTypeClass");
//models
const CashierSend = require("../../models/CashierSend");
const CashierLedger = require("../../models/CashierLedger");

module.exports = function updateCashierRecords(model, data, next) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";

	const { cashierId, csId, amount, fee, sendFee } = data;
	const Model = getTypeClass(model);

	let totalAmount = Number(amount) + Number(fee);

	CashierSend.findByIdAndUpdate(
		csId,
		{
			status: 1,
			fee: fee,
		},
		(err) => {
			if (err) {
				next(err);
			} else {
				Model.findByIdAndUpdate(
					cashierId,
					{
						$inc: {
							cash_received: totalAmount,
							cash_received_fee: Number(sendFee),
							cash_in_hand: totalAmount,
							fee_generated: Number(sendFee),
							total_trans: 1,
						},
					},
					function (err) {
						if (err) {
							next(err);
						} else {
							CashierLedger.findOneAndUpdate(
								{
									cashier_id: cashierId,
									trans_type: "CR",
									created_at: {
										$gte: new Date(start),
										$lte: new Date(end),
									},
								},
								{ $inc: { amount: totalAmount } },
								function (err, c) {
									if (err) {
										next(err);
									} else if (c == null) {
										let data = new CashierLedger();
										data.amount = totalAmount;
										data.trans_type = "CR";
										data.transaction_details = JSON.stringify({
											fee: fee,
										});
										data.cashier_id = cashierId;
										data.save(function (err) {
											if (err) {
												next(err);
											} else {
												next(null);
											}
										});
									} else {
										next(null);
									}
								}
							);
						}
					}
				);
			}
		}
	);
};
