const mongoose = require("mongoose");
const MerchantLedgerSchema = new mongoose.Schema({
    date: { type: Date, required: true, default: Date.now },
    merchant_id: { type: String, required: true },
    partner_commission: { type: Number, required: true },
    partner_fee: { type: Number, required: false },
    bank_commission: { type: Number, required: true },
    bank_fee: { type: Number, required: false },
    merchant_commission: { type: Number, required: true },
    merchant_fee: { type: Number, required: false },
    user_commission: { type: Number, required: true },
    user_fee: { type: Number, required: false },
});
module.exports = mongoose.model("MerchantLedger", MerchantLedgerSchema);