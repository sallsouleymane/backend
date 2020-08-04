// User.js
const mongoose = require("mongoose");
const CustomerSchema = new mongoose.Schema({
	customer_code: { type: String, required: true },
	name: { type: String, required: true },
	last_name: { type: String, required: false },
	mobile: { type: String, required: true },
	email: { type: String, required: true },
	address: { type: String, required: false },
	city: { type: String, required: false },
	state: { type: String, required: false },
	country: { type: String, required: false },
	id_type: { type: String, required: false },
	id_name: { type: String, required: false },
	valid_till: { type: String, required: false },
	id_number: { type: String, required: false },
	dob: { type: String, required: false },
	gender: { type: String, required: false },
	merchant_id: { type: String, required: true },
	docs_hash: [
		{
			name: { type: String, required: false },
			hash: { type: String, required: false },
			type: { type: String, required: false },
		},
	],
});
module.exports = mongoose.model("Customer", CustomerSchema);
