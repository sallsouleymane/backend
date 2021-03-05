// User.js
const mongoose = require("mongoose");
const TxStateSchema = new mongoose.Schema({
	state: { type: String, required: false },
	txType: { type: String, required: false },
	bankId: { type: String, required: false },
	cashier_id: { type: String, required: false },
	payerId: { type: String, required: false },
	receiverId: { type: String, required: false },
	transaction: { type: Object, required: false },
	cash_in_hand: { type: Number, required: false, default: 0 },
	amount: { type: Number, required: false, default: 0 },
	description: { type: String, required: false },

	childTx: [
		{
			state: { type: String, required: false },
			transaction: { type: Object, required: false },
			message: { type: String, required: true },
			retry_count: { type: Number, required: false, default: 0 },
			retry_at: { type: Date, required: false, default: Date.now },
		},
	],
	createdAt: { type: Date, required: true, default: Date.now },
});
module.exports = mongoose.model("TxState", TxStateSchema);
