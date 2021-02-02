const mongoose = require("mongoose");
const OfferingSchema = new mongoose.Schema({
	merchant_id: { type: String, required: true },
	code: { type: String, required: true },
	name: { type: String, required: true },
	description: { type: String, required: false },
	denomination: { type: String, required: true },
	unit_of_measure: { type: String, required: true },
	unit_price: { type: Number, required: true },
	type: { type: String, required: true },
	type_desc: { type: String, required: false, default: "0-Product, 1-Service" },
});
module.exports = mongoose.model("Offering", OfferingSchema);
