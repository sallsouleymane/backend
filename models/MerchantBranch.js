// User.js
const mongoose = require('mongoose');
const MerchantBranchSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  branch_id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique:true },
  password: { type: String, required: true },
  credit_limit: { type: Number, required: false, default: 0 },
  cash_in_hand: { type: Number, required: false, default: 0 },
  address1: { type: String, required: true },
  state: { type: String, required: true },
  zip: { type: String, required: true },
  country: { type: String, required: true },
  ccode: { type: String, required: true },
  mobile: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  merchant_id: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  modified_at: { type: Date, default: null },
  initial_setup: { type: Boolean, default: false},
  total_cashiers: {type: Number, required: false, default: 0},
  status: {type: Number, required:true, default:1},
  working_from: { type: String, required: false, default: 0 },
  working_to: { type: String, required: false, default: 0 },
});
module.exports = mongoose.model('MerchantBranch', MerchantBranchSchema);