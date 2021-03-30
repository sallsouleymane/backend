//models
const CashierClaim = require("../../models/CashierClaim");
const CashierLedger = require("../../models/CashierLedger");

const getTypeClass = require("../../routes/utils/getTypeClass");

module.exports = function updateClaimRecord(model, data, next) {
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";

	const { cashierId, claimId, amount, claimFee } = data;
	const Model = getTypeClass(model);

	CashierClaim.findByIdAndUpdate(
		claimId,
		{
			status: 1,
		},
		(err) => {
			if (err) {
				next(err);
			} else {
				Model.findByIdAndUpdate(
					cashierId,
					{
						$inc: {
							cash_paid: Number(amount),
							cash_in_hand: -Number(amount),
							fee_generated: Number(claimFee),
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
									trans_type: "DR",
									created_at: {
										$gte: new Date(start),
										$lte: new Date(end),
									},
								},
								{
									$inc: {
										amount: amount,
									},
								},
								function (err, c) {
									if (err) {
										next(err);
									} else if (c == null) {
										let data = new CashierLedger();
										data.amount = amount;
										data.trans_type = "DR";
										data.cashier_id = cashierId;
										data.save(function (err) {
											next(err);
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
