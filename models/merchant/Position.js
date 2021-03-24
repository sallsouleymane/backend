// User.js
const mongoose = require("mongoose");
const MerchantPositionSchema = new mongoose.Schema({
	username: { type: String, required: false, default: null },
	name: { type: String, required: true, unique: true },
	working_from: { type: String, required: false, default: 0 },
	working_to: { type: String, required: false, default: 0 },
	merchant_id: { type: String, required: true },
	branch_id: { type: String, required: true },
	staff_id: { type: String, required: false, default: null },
	type: { type: String, required: false, default: null },
	cash_in_hand: { type: Number, required: false, default: 0 },
	closing_balance: { type: Number, required: false, default: 0 },
	opening_balance: { type: Number, required: false, default: 0 },
	discrepancy : { type: Number, required: false, default: 0 },
	cash_transferred: { type: Number, required: false, default: 0 },
	cash_accepted: { type: Number, required: false, default: 0 },
	closing_time: { type: Date, required: false, default: null },
	opening_time: { type: Date, required: false, default: null },
	is_closed: { type: Boolean, required: false, default: true },
	status: { type: Number, required: true, default: 1 },
	counter_invoice_access: { type: Boolean, required: false, default: false },
	last_paid_at: { type: Date, required: false, default: null },
	counter: { type: Number, required: false, default: 001 },
});
module.exports = mongoose.model("MerchantPosition", MerchantPositionSchema);
