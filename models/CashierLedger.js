// User.js
const mongoose = require('mongoose');
const CashierLedgerSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  transaction_details: { type: String, required: false, default: "{}" },
  cashier_id: { type: String, required: true},
  trans_type: { type: String, required: true },
  status: { type: Number, required: true, default: 1 },
  created_at: { type: Date, required:true, default: Date.now }
});
module.exports = mongoose.model('CashierLedger', CashierLedgerSchema);
