// User.js
const mongoose = require('mongoose');
const CashierPendingSchema = new mongoose.Schema({
  sender_name: { type: String, required: true},
  receiver_name: { type: String, required: true },
  amount: { type: Number, required: true },
  transaction_details: { type: String, required: false, default: null },
  cashier_id: { type: String, required: true},
  trans_type: { type: String, required: true, default: 'DR' },
  status: { type: Number, required: true, default: 0 },
  created_at: { type: Date, required:true, default: Date.now }
});
module.exports = mongoose.model('CashierPending', CashierPendingSchema);
