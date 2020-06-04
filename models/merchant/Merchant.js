const mongoose = require("mongoose");
const MerchantSchema = new mongoose.Schema({
	name: { type: String, required: true },
	username: { type: String, required: true, unique: true },
	password: { type: String, required: true },
	logo: { type: String, required: false },
	description: { type: String, required: false },
	document_hash: { type: String, required: false },
	email: { type: String, required: false, unique: true },
	mobile: { type: String, required: true, unique: true },
	status: { type: Number, required: true },
	bank_id: { type: String, required: true },
	bills_paid: { type: String, required: true, default: 0 },
	bills_raised: { type: String, required: true, default: 0 },
	amount_collected: { type: String, required: true, default: 0 },
	amount_due: { type: String, required: true, default: 0 },
	fee_generated: { type: String, required: true, default: 0 },
});
module.exports = mongoose.model("Merchant", MerchantSchema);
