// User.js
const mongoose = require('mongoose');
const CashierSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true},
  username: { type: String, required: false, unique: false},
  bcode: { type: String, required: true, unique: true},
  working_from: { type: String, required: false, default: 0 },
  working_to: { type: String, required: false, default: 0 },
  per_trans_amt: { type: String, required: false, default: 0 },
  max_trans_amt: { type: String, required: false, default: 0 },
  max_trans_count: { type: String, required: false, default: 0 },
  bank_id: { type: String, required: true },
  branch_id: { type: String, required: false },
  created_at: { type: Date, default: Date.now },
  modified_at: { type: Date, default: null },
  initial_setup: { type: Boolean, default: false},
  status: {type: Number, required:true, default:0},
  token: {type: String, required:false, default:null}
});
module.exports = mongoose.model('Cashier', CashierSchema);
