const Invoice = require("../../models/merchant/Invoice");

module.exports = async function (invoices, merchant_id) {
	try {
		var total_amount = 0;
		for (invoice of invoices) {
			var { id, penalty } = invoice;
			var inv = await Invoice.findOne({
				_id: id,
				merchant_id: merchant_id,
				paid: 0,
				is_validated: 1,
			});
			if (inv == null) {
				throw new Error(
					"Invoice id " +
						id +
						" is already paid or not validated or it belongs to different merchant"
				);
			}
			total_amount += inv.amount + penalty;
		}
		if (total_amount < 0) {
			throw new Error("Amount is a negative value");
		}
		return total_amount;
	} catch (err) {
		throw err;
	}
};
