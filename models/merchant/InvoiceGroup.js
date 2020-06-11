const mongoose = require("mongoose");
const InvoiceGroupSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    cashier_id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: false }
});
module.exports = mongoose.model("InvoiceGroup", InvoiceGroupSchema);