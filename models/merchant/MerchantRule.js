const mongoose = require("mongoose");
const MerchantRuleSchema = new mongoose.Schema({
	merchant_id: { type: String, required: true },
	bank_id: { type: String, required: true },
	name: { type: String, required: true },
	status: { type: Number, required: true, default: 0 },
	active: { type: Number, required: true, default: 0 },
	type: { type: String, required: true },
	type_desc: { type: String, required: false, default: "WM-F, WM-C, NWM-F, NWM-C, M-F, M-C" },
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
	specific_branch_share: [
		{
			code: { type: String, required: false },
			name: { type: String, required: false },
			percentage: { type: Number, required: false },
		},
	],
	branch_share: { type: String, required: true, default: 0 },
	specific_partner_share: [
		{
			code: { type: String, required: false },
			name: { type: String, required: false },
			percentage: { type: Number, required: false },
		},
	],
	partner_share: { type: String, required: true, default: 0 },
	edited: {
		infra_share: {
			fixed: { type: Number, required: false },
			percentage: { type: Number, required: false },
		},
		active: { type: Number, required: false },
		name: { type: String, required: false },
		type: { type: Number, required: false },
		merchant_approve_status: { type: Number, required: false },
		infra_approve_status: { type: Number, required: false },
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
module.exports = mongoose.model("MerchantRule", MerchantRuleSchema);
