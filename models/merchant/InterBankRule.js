const mongoose = require("mongoose");
const InterBankMerchantRuleSchema = new mongoose.Schema({
    merchant_id: { type: String, required: true },
    bank_id: { type: String, required: true },
    name: { type: String, required: true },
    status: { type: Number, required: true, default: 0 },
    active: { type: Number, required: true, default: 0 },
    type: { type: String, required: true },
    type_desc: { type: String, required: false, default: "IBNWM-C IBNWM-F IBWM-C IBW-F" },
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
    other_bank_share: {
        fixed: { type: Number, required: true, default: 0 },
        percentage: { type: Number, required: true, default: 0 },
    },
    edited: {
        infra_share: {
            fixed: { type: Number, required: false },
            percentage: { type: Number, required: false },
        },
        active: { type: Number, required: false },
        name: { type: String, required: false },
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
module.exports = mongoose.model("InterBankMerchantRule", InterBankMerchantRuleSchema);
