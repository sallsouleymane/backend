const mongoose = require("mongoose");
const MerchantFeeSchema = new mongoose.Schema({
	merchant_id: { type: String, required: true },
	status: { type: Number, required: true, default: 0 },
    active: { type: Number, required: true, default: 0 },
	type: { type: Number, required: true },
	description: { type: String, required: false },
	rule_edit_status: { type: Number, required: true, default: 0 },
	infra_share_edit_status: { type: Number, required: true, default: 0 },
	merchant_approve_status: { type: Number, required: true, default: 0 },
	infra_approve_status: { type: Number, required: true, default: 0 },
	ranges: [
		{
			trans_from: { type: Number, required: true, default: 0 },
			trans_to: { type: Number, required: true, default: 0 },
			fixed: { type: Number, required: true, default: 0 },
			percentage: { type: Number, required: true, default: 0 },
		},
	],
	infra_share: {
		fixed: { type: Number, required: true, default: 0 },
		percentage: { type: Number, required: true, default: 0 },
	},
	specific_partners_share: [
		{
			code: { type: String, required: false },
			name: { type: String, required: false },
			percentage: { type: Number, required: false },
		},
	],
	partner_share_percentage: { type: String, required: true, default: 0 },
	edited: {
		infra_share: {
			fixed: { type: Number, required: false },
			percentage: { type: Number, required: false },
		},
        active: { type: Number, required: false },
        type: { type: Number, required: false },
		merchant_approve_status: { type: Number, required: false },
		ranges: [
			{
				trans_from: { type: Number, required: false },
				trans_to: { type: Number, required: false },
				fixed: { type: Number, required: false },
				percentage: { type: Number, required: false },
			},
		],
	},
});
module.exports = mongoose.model("MerchantFee", MerchantFeeSchema);
