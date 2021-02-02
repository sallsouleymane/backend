//utils
const sendSMS = require("../../routes/utils/sendSMS");

//models
const MerchantBranch = require("../../models/merchant/MerchantBranch");
const MerchantPosition = require("../../models/merchant/Position");
const Merchant = require("../../models/merchant/Merchant");
const Invoice = require("../../models/merchant/Invoice");
const InvoiceGroup = require("../../models/merchant/InvoiceGroup");

module.exports = async function (reqData, otherData) {
	const { invoices, merchant_id } = reqData;
	const { total_amount, master_code, paid_by, payer_id } = otherData;
	var last_paid_at = new Date();
	var m = await Merchant.updateOne(
		{ _id: merchant_id },
		{
			last_paid_at: last_paid_at,
			$inc: {
				amount_collected: total_amount,
				amount_due: -total_amount,
				bills_paid: invoices.length,
			},
		}
	);
	if (m == null) {
		throw new Error("Merchant status can not be updated");
	}

	// var ms = await MerchantPosition.updateOne(
	// 	{ _id: i.creator_id },
	// 	{
	// 		last_paid_at: last_paid_at,
	// 	}
	// );
	// if (ms == null) {
	// 	status_update_feedback =
	// 		"Merchant Staff status can not be updated";
	// }

	// var mb = await MerchantBranch.updateOne(
	// 	{ _id: ms.branch_id },
	// 	{
	// 		last_paid_at: last_paid_at,
	// 		$inc: {
	// 			amount_collected: total_amount,
	// 			amount_due: -total_amount,
	// 			bills_paid: invoices.length,
	// 		},
	// 	}
	// );
	// if (mb == null) {
	// 	status_update_feedback =
	// 		"Merchant branch status can not be findOneAndupdated";
	// }

	for (invoice of invoices) {
		let { id, penalty } = invoice;
		let i = await Invoice.findOneAndUpdate(
			{ _id: id },
			{
				paid: 1,
				paid_by: paid_by,
				payer_id: payer_id,
				penalty: penalty,
				transaction_code: master_code,
			}
		);
		if (i == null) {
			throw new Error("Invoice paid status can not be updated");
		}

		var ig = await InvoiceGroup.updateOne(
			{ _id: i.group_id },
			{
				last_paid_at: last_paid_at,
				$inc: {
					bills_paid: 1,
				},
			}
		);
		if (ig == null) {
			throw new Error("Invoice group status can not be updated");
		}

		content =
			"E-Wallet:  Amount " +
			i.amount +
			" is paid for invoice nummber " +
			i.number +
			" for purpose " +
			i.description;
		sendSMS(content, i.mobile);
	}
	return null;
};
