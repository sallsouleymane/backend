const mongoose = require("mongoose");
const InvoiceSchema = new mongoose.Schema({
    number: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    merchant_id: { type: String, required: true },
    amount: { type: String, required: true },
    due_date: { type: String, required: true },
    description: { type: String, required: true },
    mobile: { type: String, required: true },
    paid: { type: Number, required: true },
    paid_desc: { type: String, required: false, default: "0-not paid 1-paid" },
    group_id: { type: String, required: false },
    cashier_id: { type: String, required: true },
    created_at: { type: Date, required: true, default: Date.now },
});
module.exports = mongoose.model("Invoice", InvoiceSchema);