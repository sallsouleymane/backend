// BankUser.js
const mongoose = require("mongoose");
const MerchantStaffSchema = new mongoose.Schema({
	name: { type: String, required: true },
	username: { type: String, required: true, unique: true },
	ccode: { type: String, required: false },
	mobile: { type: String, required: true, unique: true },
	email: { type: String, required: true, unique: true },
	password: { type: String, required: true, select: false },
	branch_id: { type: String, required: true },
	merchant_id: { type: String, required: true },
	logo: { type: String, required: false },
	status: { type: Number, required: true, default: 1 },
});
module.exports = mongoose.model("MerchantStaff", MerchantStaffSchema);
