// User.js
const mongoose = require('mongoose');
const CashierSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true},
  bcode: { type: String, required: true, unique: true},
  mobile: { type: String, required: false},
  working_from: { type: String, required: false, default: 0 },
  working_to: { type: String, required: false, default: 0 },
  per_trans_amt: { type: String, required: false, default: 0 },
  max_trans_amt: { type: String, required: false, default: 0 },
  max_trans_count: { type: String, required: false, default: 0 },
  bank_id: { type: String, required: true },
  branch_id: { type: String, required: false },
  bank_user_id: {type:String, required:false, default: null},
  created_at: { type: Date, default: Date.now },
  modified_at: { type: Date, default: null },
  initial_setup: { type: Boolean, default: false},
  status: {type: Number, required:true, default:1},
  opening_balance: { type: Number, required: false , default: 0},
  cash_in_hand: { type: Number, required: false , default: 0},
  cash_received: { type: Number, required: false , default: 0},
  cash_paid: { type: Number, required: false , default: 0},
  fee_generated: { type: Number, required: false , default: 0},
  cash_transferred: { type: Number, required: false , default: 0},
  cash_accepted: { type: Number, required: false , default: 0},
  closing_balance: { type: Number, required: false , default: 0},
  closing_time: { type: Date, required: false , default: null},
  transaction_started: { type: Boolean, default: false},
  total_trans: { type: Number, required: false , default: 0},
  token: {type: String, required:false, default:null},
  central:{type: Boolean, required:false, default:false}
});
module.exports = mongoose.model('Cashier', CashierSchema);
