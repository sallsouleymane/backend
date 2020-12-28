// User.js
const mongoose = require("mongoose");
const FailedTXSchema = new mongoose.Schema({
	master_code: { type: String, require: false },
	user_id: { type: String, required: false },
	wallet_id: { type: String, required: true },
	transaction: {
		from: { type: String, required: true },
		to: { type: String, required: true },
		amount: { type: Number, required: true },
		note: { type: String, required: true },
		email1: { type: String, required: true },
		email2: { type: String, required: true },
		mobile1: { type: String, required: true },
		mobile2: { type: String, required: true },
		master_code: { type: String, required: true },
		child_code: { type: String, required: true },
	},
	message: { type: String, required: true },
	status: { type: Number, required: true, default: 0 },
	status_desc: {
		type: String,
		required: false,
		default: "0-created 1-re-initiated tx success 2-re-initiated tx failed",
	},
	created_at: { type: Date, required: true, default: Date.now },
});
module.exports = mongoose.model("FailedTX", FailedTXSchema);
