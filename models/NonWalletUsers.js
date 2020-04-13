// User.js
const mongoose = require("mongoose");
const NWUserSchema = new mongoose.Schema({
	name: { type: String, required: true },
	last_name: { type: String, required: false },
	mobile: { type: String, required: true, unique: true },
	email: { type: String, required: true, unique: true },
	country: { type: String, required: false },
	id_type: { type: String, required: false },
	valid_till: { type: String, required: false },
	id_number: { type: String, required: false },
});
module.exports = mongoose.model("NWUser", NWUserSchema);
  