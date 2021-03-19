const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const InvoiceSchema = new mongoose.Schema({
	number: { type: String, required: true, unique: true },
	name: { type: String, required: true },
	last_name: { type: String, required: false },
	address: { type: String, required: false },
	merchant_id: { type: String, required: true },
	customer_code: { type: String, required: false },
	amount: { type: Number, required: false },
	penalty: { type: Number, required: false },
	bill_date: { type: String, required: false },
	bill_period: {
		start_date: { type: Date, required: false },
		end_date: { type: Date, required: false },
		period_name: { type: String, required: false },
	},
	due_date: { type: String, required: false },
	description: { type: String, required: false },
	mobile: { type: String, required: true },
	ccode: { type: String, required: false },
	creator_id: { type: String, required: true },
	branch_id: { type: String, required: true },
	zone_id: { type: String, required: true },
	subzone_id: { type: String, required: true },
	paid: { type: Number, required: true, default: 0 },
	paid_desc: { type: String, required: false, default: "0-not paid 1-paid" },
	paid_by: { type: String, required: false },
	date_paid: { type: Date, required: false },
	payer_id: { type: String, required: false },
	payer_branch_id: { type: String, required: false },
	group_id: { type: String, required: false },
	is_created: { type: Number, required: true, default: 0 },
	is_validated: { type: Number, required: true, default: 1 },
	created_at: { type: Date, required: true, default: Date.now },
	items: [
		{
			item_desc: { type: Object, required: false },
			quantity: { type: Number, required: false },
			tax_desc: { type: Object, required: false },
			total_amount: { type: Number, required: false },
		},
	],
	is_counter: { type: Boolean, required: false, default: false },
	reference_invoice: { type: String, required: false },
	term: { type: Number, required: false },
	has_counter_invoice: { type: Boolean, required: false, default: false },
	transaction_code: { type: String, required: false },
});
InvoiceSchema.plugin(uniqueValidator, {
	message: "Expected to be unique.",
});

module.exports = mongoose.model("Invoice", InvoiceSchema);
