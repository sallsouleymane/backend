const mongoose = require("mongoose");
const MerchantFeeSchema = new mongoose.Schema({
	merchant_id: { type: String, required: true },
    status: { type: Number, required: true, default: 0 },
    rule_edit_status: { type: Number, required: true, default: 0 },
    infra_share_edit_status: { type: Number, required: true, default: 0 },
	current: {
		fixed: { type: String, required: true, default: 0 },
		percentage: { type: String, required: true, default: 0 },
        merchant_approve_status: { type: Number, required: true, default: 0 },
        infra_approve_status: { type: Number, required: true, default: 0 },
		infra_fixed: { type: String, required: true, default: 0 },
		infra_percentage: { type: String, required: true, default: 0 },
	},
	edited: {
		fixed: { type: String, required: false },
		percentage: { type: String, required: false },
		merchant_approve_status: { type: Number, required: false },
        infra_approve_status: { type: Number, required: false },
        infra_fixed: { type: String, required: false },
        infra_percentage: { type: String, required: false },
	},
});
module.exports = mongoose.model("MerchantFee", MerchantFeeSchema);