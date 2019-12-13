// Transaction.js
const mongoose = require('mongoose');
const TransactionSchema = new mongoose.Schema({
  trans_id: { type: String, required: true, unique: true},
  from: { type: String, required: true},
  to: { type: String, required: true},
  fee: { type: Number, required: false},
  amount: { type: Number, required: true},
  remarks: {type: String, required: false},
  created_at: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Transaction', TransactionSchema);
