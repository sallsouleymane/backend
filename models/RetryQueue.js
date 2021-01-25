const mongoose = require("mongoose");
const RetryQueueSchema = new mongoose.Schema({
	queue_id: { type: String, required: true },
	bank_id: { type: String, required: true },
	transactions: [
		{
			transaction: { type: Object, required: false },
			failure_reason: { type: Object, required: false },
			retry_count: { type: Number, required: false, default: 0 },
			arrived_at: { type: Date, required: true, default: Date.now },
			retry_at: { type: Date, required: false },
		},
	],
});
module.exports = mongoose.model("RetryQueue", RetryQueueSchema);
