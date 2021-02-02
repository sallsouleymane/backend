const mongoose = require("mongoose");
const InvoiceGroupSchema = new mongoose.Schema({
	code: { type: String, required: true, unique: true },
	position_id: { type: String, required: true },
	name: { type: String, required: true },
	description: { type: String, required: false },
	bills_paid: { type: Number, required: false, default: 0 },
	bills_raised: { type: Number, required: false, default: 0 },
	last_paid_at: { type: Date, required: false, default: null },
});
module.exports = mongoose.model("InvoiceGroup", InvoiceGroupSchema);
