// User.js
const mongoose = require("mongoose");
const UserSchema = new mongoose.Schema({
	name: { type: String, required: true },
	last_name: { type: String, required: false },
	mobile: { type: String, required: true, unique: true },
	email: { type: String, required: true, unique: true },
	username: { type: String, required: true, unique: true },
	password: { type: String, required: true },
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
	otp: { type: String, required: false, default: null },
	bank: { type: String, required: false, default: null },
	docs_hash: [
		{
			name: { type: String, required: false },
			hash: { type: String, required: false },
			type: { type: String, required: false },
		},
	],
	status: { type: Number, required: true, default: null },
	contact_list: { type: [String], required: false, default: null },
});
module.exports = mongoose.model("User", UserSchema);
  