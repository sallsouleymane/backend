// User.js
const mongoose = require('mongoose');
const BankSchema = new mongoose.Schema({
  name: { type: String, required: true},
  address1: { type: String, required: false },
  address2: { type: String, required: false },
  mobile: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  user_id: { type: String, required: true },
  logo: { type: String, required: false },
  contract: { type: String, required: false },
  password: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  modified_at: { type: Date, default: null }
});
module.exports = mongoose.model('Bank', BankSchema);
