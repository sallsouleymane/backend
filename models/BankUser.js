// BankUser.js
const mongoose = require('mongoose');
const BankUserSchema = new mongoose.Schema({
  name: { type: String, required: true},
  username: { type: String, required: true, unique: true },
  ccode: { type: String, required: false},
  mobile: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  branch_id: {type: String, required: true},
  bank_id: {type: String, required: true},
  logo: {type: String, required: false},
  status: {type: Number, required:true, default:1},
  token: { type: String, required: false }
});
module.exports = mongoose.model('BankUser', BankUserSchema);
