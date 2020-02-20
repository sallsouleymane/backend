// User.js
const mongoose = require('mongoose');
const CashierTransferSchema = new mongoose.Schema({
  sender_id: { type: String, required: true },
  receiver_id: { type: String, required: true },
    sender_name: { type: String, required: true },
  receiver_name: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: Number, required: true, default: 0 },
  created_at: { type: Date, required:true, default: Date.now }
});
module.exports = mongoose.model('CashierTransfer', CashierTransferSchema);
