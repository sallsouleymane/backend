const mongoose = require("mongoose");
const InvoiceSchema = new mongoose.Schema({
    number: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    merchant_id: { type: String, required: true },
    amount: { type: String, required: true },
    due_date: { type: String, required: true },
    description: { type: String, required: true },
    mobile: { type: String, required: true },
    group_id: { type: String, required: false },
    zone_id: { type: String, required: true }
});
module.exports = mongoose.model("Invoice", InvoiceSchema);