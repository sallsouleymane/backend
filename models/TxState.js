// User.js
const mongoose = require("mongoose");
const TxStateSchema = new mongoose.Schema({
	state: { type: String, required: false },
	masterTx: { type: Object, required: false },
	childTx: [
		{
			state: { type: String, required: false },
			transaction: { type: Object, required: false },
			message: { type: String, required: true },
		},
	],
	createdAt: { type: Date, required: true, default: Date.now },
});
module.exports = mongoose.model("TxState", TxStateSchema);
