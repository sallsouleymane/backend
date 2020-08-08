const mongoose = require("mongoose");
const MerchantCashierSettings = new mongoose.Schema({
    cashier_id: { type: String, required: true },
    counter: { type: Number, required: false, default: 0 },
});

module.exports = mongoose.model("MerchantCashierSettings", MerchantCashierSettings);