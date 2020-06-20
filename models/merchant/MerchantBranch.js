// User.js
const mongoose = require("mongoose");
const MerchantBranchSchema = new mongoose.Schema({
	name: { type: String, required: true, unique: true },
	code: { type: String, required: true, unique: true },
	zone_id: { type: String, required: true },
	username: { type: String, required: true, unique: true },
	password: { type: String, required: true, select: false },
	address1: { type: String, required: true },
	state: { type: String, required: true },
	zip: { type: String, required: true },
	country: { type: String, required: true },
	ccode: { type: String, required: true },
	mobile: { type: String, required: true, unique: true },
	email: { type: String, required: true, unique: true },
	merchant_id: { type: String, required: true },
	created_at: { type: Date, default: Date.now },
	modified_at: { type: Date, default: null },
	initial_setup: { type: Boolean, default: false },
	total_cashiers: { type: Number, required: false, default: 0 },
	status: { type: Number, required: true, default: 0 },
	working_from: { type: String, required: false, default: 0 },
	working_to: { type: String, required: false, default: 0 },
	bills_paid: { type: Number, required: true, default: 0 },
	bills_raised: { type: Number, required: true, default: 0 },
	amount_collected: { type: Number, required: true, default: 0 }, 
	amount_collected_desc: { type: String, required: false, default: "Today's total amount paid"},
	last_paid_at: { type: Date, required: false, default: null},
	amount_due: { type: Number, required: true, default: 0 }
});
module.exports = mongoose.model("MerchantBranch", MerchantBranchSchema);
