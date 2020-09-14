const mongoose = require("mongoose");
const BankCommissionSchema = new mongoose.Schema({
	merchant_id: { type: String, required: true },
	status: { type: Number, required: true, default: 0 },
	status_desc: { type: String, required: true, default: "0-created 1-valid" },
	name: { type: String, required: true },
	type: { type: Number, required: true },
	type_desc: { type: String, required: false, default: "0-Wallet, 1-Non-Wallet" },
	active: { type: Number, required: true, default: 0 },
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
	specific_partners_branch_share: [
		{
			code: { type: String, required: false },
			name: { type: String, required: false },
			percentage: { type: Number, required: false },
		},
	],
	partner_branch_share: { type: String, required: true, default: 0 },
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
module.exports = mongoose.model("BankCommission", BankCommissionSchema);
