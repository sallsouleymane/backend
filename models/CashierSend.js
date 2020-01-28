// User.js
const mongoose = require('mongoose');
const CashierSendSchema = new mongoose.Schema({
  sender_info: { type: String, required: true},
  sender_id: { type: String, required: true },
  receiver_info: { type: String, required: true },
  receiver_id: { type: String, required: true },
  without_id: { type: String, required: true, default: 0 },
  require_otp: { type: String, required: true, default: 0 },
  transaction_code: { type: String, required: true, default: null },
  otp: { type: String, required: false, default: null },
  amount: { type: Number, required: true },
  fee: { type: String, required: true },
  transaction_details: { type: String, required: false, default: null },
  cashier_id: { type: String, required: true},
  trans_type: { type: String, required: true, default: 'DR' },
  master_code: {type: String, required:true},
  child_code: {type: String, required:true},
  status: { type: Number, required: true, default: 0 },
  created_at: { type: Date, required:true, default: Date.now }
});
module.exports = mongoose.model('CashierSend', CashierSendSchema);
