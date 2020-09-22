const mongoose = require("mongoose");
const InterBankRuleSchema = new mongoose.Schema({
	bank_id: { type: String, required: true },
	name: { type: String, required: true },
	status: { type: Number, required: true, default: 0 },
	active: { type: Number, required: true, default: 0 },
	type: { type: Number, required: true },
	type_desc: { type: String, required: false, default: "0-NWNW" },
	description: { type: String, required: false },
	sharing_added: { type: String, required: false, default: 0 },
	edit_status: { type: Number, required: true, default: 0 },
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
	other_bank_share: {
		fixed: { type: Number, required: true, default: 0 },
		percentage: { type: Number, required: true, default: 0 },
	},
	edited: {
		status: { type: Number, required: false },
		infra_share: {
			fixed: { type: Number, required: false },
			percentage: { type: Number, required: false },
		},
		other_bank_share: {
			fixed: { type: Number, required: false },
			percentage: { type: Number, required: false },
		},
		active: { type: Number, required: false },
		name: { type: String, required: false },
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
module.exports = mongoose.model("InterBankRule", InterBankRuleSchema);