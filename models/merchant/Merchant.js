const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const MerchantSchema = new mongoose.Schema({
	name: { type: String, required: true },
	creator: { type: Number, required: true },
	creator_desc: { type: String, required: false, default: "0-Bank, 1-Infra" },
	username: { type: String, required: true, unique: true },
	password: { type: String, required: true, select: false },
	code: { type: String, required: true, unique: true },
	logo: { type: String, required: false },
	description: { type: String, required: false },
	document_hash: { type: String, required: false },
	email: { type: String, required: false, unique: true },
	mobile: { type: String, required: true, unique: true },
	status: { type: Number, required: true },
	bank_id: { type: String, required: true },
	infra_id: { type: String, required: false },
	bills_paid: { type: Number, required: false, default: 0 },
	bills_raised: { type: Number, required: false, default: 0 },
	amount_collected: { type: Number, required: true, default: 0 },
	amount_collected_desc: {
		type: String,
		required: false,
		default: "Today's total amount paid",
	},
	last_paid_at: { type: Date, required: false, default: null },
	amount_due: { type: Number, required: true, default: 0 },
	wallet_ids: {
		operational: { type: String, required: false },
	},
	is_private: { type: Boolean, required: true, default: false },
});

MerchantSchema.plugin(uniqueValidator, {
	message: "Error, expected {PATH} to be unique.",
});

module.exports = mongoose.model("Merchant", MerchantSchema);
