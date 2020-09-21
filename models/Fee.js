// User.js
const mongoose = require("mongoose");
const FeeSchema = new mongoose.Schema({
	name: { type: String, required: true },
	trans_type: { type: String, required: true },
	bank_id: { type: String, required: true },
	active: { type: String, required: true, default: 0 },
	status: { type: Number, required: true, default: 0 },
	ranges: [
		{
			trans_from: { type: Number, required: true, default: 0 },
			trans_to: { type: Number, required: true, default: 0 },
			fixed: { type: Number, required: true, default: 0 },
			percentage: { type: Number, required: true, default: 0 }
		}
	],
	revenue_sharing_rule: {
		infra_share: {
			fixed: { type: Number, required: true, default: 0 },
			percentage: { type: Number, required: true, default: 0 }
		},
		branch_share: {
			claim: { type: Number, required: false, default: 0 },
			send: { type: Number, required: false, default: 0 }
		},
		specific_branch_share: [
			{
				branch_code: { type: String, required: false },
				branch_name: { type: String, required: false },
				claim: { type: Number, required: false },
				send: { type: Number, required: false }
			},
		],
		partner_share: {
			claim: { type: Number, required: false, default: 0 },
			send: { type: Number, required: false, default: 0 }
		},
		specific_partner_share: [
			{
				partner_code: { type: String, required: false },
				partner_name: { type: String, required: false },
				claim: { type: Number, required: false },
				send: { type: Number, required: false }
			},
		]
	},
});

module.exports = mongoose.model("Fee", FeeSchema);
