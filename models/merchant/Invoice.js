const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const InvoiceSchema = new mongoose.Schema({
	number: { type: String, required: true, unique: true },
	name: { type: String, required: true },
	merchant_id: { type: String, required: true },
	amount: { type: Number, required: false },
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
	paid: { type: Number, required: true, default: 0 },
	paid_desc: { type: String, required: false, default: "0-not paid 1-paid" },
	group_id: { type: String, required: false },
	cashier_id: { type: String, required: true },
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
});
InvoiceSchema.plugin(uniqueValidator, {
	message: "Expected to be unique.",
});

module.exports = mongoose.model("Invoice", InvoiceSchema);
