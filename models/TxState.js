/* If this file is updated, also build docker for receive.js which is a rabbitmq queue receiver*/

const mongoose = require("mongoose");
const TxStateSchema = new mongoose.Schema({
	state: {
		main: { type: String, required: false, default: "INITIATED" },
		distribute: { type: String, required: false },
		master: { type: String, required: false },
		revert: { type: String, required: false },
	},
	txType: { type: String, required: false },
	bankId: { type: String, required: false },
	cashier_id: { type: String, required: false },
	payerId: { type: String, required: false },
	receiverId: { type: String, required: false },
	transaction: { type: Object, required: false },
	fee: { type: Object, required: false },
	commission: { type: Object, required: false },
	cash_in_hand: { type: Number, required: false, default: 0 },
	amount: { type: Number, required: false, default: 0 },
	description: { type: String, required: false },
	masterTx: { type: Object, required: false },
	childTx: [
		{
			state: { type: Number, required: false },
			transaction: { type: Object, required: false },
			message: { type: String, required: true },
			retry_count: { type: Number, required: false, default: 0 },
			retry_at: { type: Date, required: false, default: Date.now },
			category: { type: String, required: false },
		},
	],
	cancel: {
		approved: { type: Number, required: false, default: 0 },
		reason: { type: String, required: false },
	},
	createdAt: { type: Date, required: true, default: Date.now },
});
module.exports = mongoose.model("TxState", TxStateSchema);
