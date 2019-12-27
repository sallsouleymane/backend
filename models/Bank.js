// User.js
const mongoose = require('mongoose');
const BankSchema = new mongoose.Schema({
  name: { type: String, required: true},
  bcode: { type: String, required: true},
  address1: { type: String, required: true },
  state: { type: String, required: true },
  zip: { type: String, required: true },
  country: { type: String, required: true },
  ccode: { type: String, required: false },
  mobile: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  user_id: { type: String, required: true },
  logo: { type: String, required: false },
  contract: { type: String, required: false },
  username: { type: String, required: true, unique:true },
  password: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  modified_at: { type: Date, default: null },
  initial_setup: { type: Boolean, default: false },
  status: {type: Number, required:true, default:0},
  token: {type: String, required:false, default:null},
  total_trans: {type: Number, required: false, default: 0}
});
module.exports = mongoose.model('Bank', BankSchema);
