const mongoose = require("mongoose");
const MerchantSchema = new mongoose.Schema({
	name: { type: String, required: true },
	username: { type: String, required: true, unique: true},
	password: { type: String, required: true},
	logo_hash: { type: String, required: false },
	description: { type: String, required: false },
	document_hash: { type: String, required: false },
	email: { type: String, required: false, unique: true },
	mobile: { type: String, required: true, unique: true },
	status: { type: Number, required: true  },
	bank: { type: String, required: true }
});
module.exports = mongoose.model("Merchant", MerchantSchema);