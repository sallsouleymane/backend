const mongoose = require("mongoose");
const TaxSchema = new mongoose.Schema({
	merchant_id: { type: String, required: true },
	code: { type: String, required: true, unique: true },
	name: { type: String, required: true },
	value: { type: Number, required: true },
	description: { type: String, required: false, default: "" },
});
module.exports = mongoose.model("Tax", TaxSchema);
