// User.js
const mongoose = require('mongoose');
const CashierClaimSchema = new mongoose.Schema({
  transaction_code: { type: String, required: true, default: null },
  amount: { type: Number, required: true },
  fee: { type: String, required: true },
  transaction_details: { type: String, required: false, default: null },
  proof: { type: String, required: false, default: null },
  cashier_id: { type: String, required: true},
  sender_name: {type: String, required: true},
  trans_type: { type: String, required: true, default: 'CR' },
  master_code: {type: String, required:true},
  child_code: {type: String, required:true},
  status: { type: Number, required: true, default: 0 },
  created_at: { type: Date, required:true, default: Date.now }
});
module.exports = mongoose.model('CashierClaim', CashierClaimSchema);
