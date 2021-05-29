// Infra.js
const mongoose = require("mongoose");
const InfraSchema = new mongoose.Schema({
	name: { type: String, required: true },
	username: { type: String, required: true, unique: true },
	ccode: { type: String, required: false },
	mobile: { type: String, required: true, unique: true },
	email: { type: String, required: true, unique: true },
	password: { type: String, required: true },
	country: { type: String, required: false },
	profile_id: { type: String, required: false },
	logo: { type: String, required: false },
	isAdmin: { type: Boolean, required: true, default: false },
	status: { type: Number, required: true, default: 1 },
});
module.exports = mongoose.model("Infra", InfraSchema);

InfraSchema.methods.isCorrectPassword = function (password, callback) {
	// bcrypt.compare(password, this.password, function(err, same) {
	if (password == this.password) {
		callback(err);
	} else {
		callback(err, same);
	}
	// });
};
