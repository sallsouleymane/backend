const mongoose = require("mongoose");
const CashierDailyReportSchema = new mongoose.Schema({
	cashier_id: { type: String, required: true },
	branch_id: { type: String, required: true },
	partner_id: { type: String, required: false },
	created_at: { type: Date, default: Date.now },
	user: { type: String, required: true },
	note: { type: String, required: true },
	opening_balance: { type: Number, required: false, default: 0 },
	closing_balance: { type: Number, required: false, default: 0 },
	denomination: [],
	opening_time: { type: Date, required: false },
	closing_time: { type: Date, required: false },
	cash_in_hand: { type: Number, required: false, default: 0 },
	paid_in_cash: { type: Number, required: false, default: 0 },
	cash_received: { type: Number, required: false, default: 0 },
	fee_generated: { type: Number, required: false, default: 0 },
	comm_generated: { type: Number, required: false, default: 0 },
	descripency: { type: Number, required: false, default: 0 },
	request_approved: { type: Number, required: false, default: 0 },
	request_declined: { type: Number, required: false, default: 0 },
	request_pending: { type: Number, required: false, default: 0 },
});
module.exports = mongoose.model("CashierDailyReport", CashierDailyReportSchema);
