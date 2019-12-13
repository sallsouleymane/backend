// Wallet.js
const mongoose = require('mongoose');
const WalletSchema = new mongoose.Schema({
  address: { type: String, required: true, unique: true},
  balance: { type: Number, required: false, default: 0 },
  infra_id: { type: String, required: true},
  bank_id: { type: String, required: true},
  type: {type: String, required: true},
  status: {type: Number, required: true, default: 1},
  created_at: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Wallet', WalletSchema);
