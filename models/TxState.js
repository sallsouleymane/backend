// User.js
const mongoose = require("mongoose");
const TxStateSchema = new mongoose.Schema({
	master_code: { type: String, required: false },
	state: { type: String, required: false },
	created_at: { type: Date, required: true, default: Date.now },
});
module.exports = mongoose.model("TxState", TxStateSchema);
