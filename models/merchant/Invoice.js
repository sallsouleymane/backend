const mongoose = require("mongoose");
const InvoiceSchema = new mongoose.Schema({
    number: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    merchant_id: { type: String, required: true },
    amount: { type: String, required: true },
    bill_date: { type: String, required: false },
    bill_period: { type: String, required: false },
    due_date: { type: String, required: false },
    description: { type: String, required: false },
    mobile: { type: String, required: true },
    ccode: { type: String, required: false },
    paid: { type: Number, required: true, default: 0 },
    paid_desc: { type: String, required: false, default: "0-not paid 1-paid" },
    group_id: { type: String, required: false },
    cashier_id: { type: String, required: true },
    created_at: { type: Date, required: true, default: Date.now },
});
module.exports = mongoose.model("Invoice", InvoiceSchema);