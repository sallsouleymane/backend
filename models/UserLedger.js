const mongoose = require('mongoose');
const UserLedgerSchema = new mongoose.Schema({
  sender_mobile: { type: String, required: true},
  receiver_mobile: { type: String, required: true },
  note: { type: String, required: false},
  transaction_code: { type: String, required: true, default: null },
  amount: { type: Number, required: true },
  fee: { type: String, required: true },
  master_code: {type: String, required:true},
  status: { type: Number, required: true, default: 0 },
  created_at: { type: Date, required:true, default: Date.now }
});
module.exports = mongoose.model('UserLedger', UserLedgerSchema);