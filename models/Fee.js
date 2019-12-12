// User.js
const mongoose = require('mongoose');
const FeeSchema = new mongoose.Schema({
  name: { type: String, required: true},
  trans_type: { type: String, required: true },
  active: { type: String, required: true },
  trans_from: { type: String, required: true },
  trans_to: { type: String, required: true },
  transcount_from: { type: String, required: true },
  transcount_to: { type: String, required: true },
  fixed_amount: { type: String, required: false },
  percentage: { type: String, required: false},
  bank_id: { type: String, required: true},
  user_id: { type: String, required: true },
  token: {type: String, required:false, default:null},
  status: { type: Number, required: true, default: 0 }
});
module.exports = mongoose.model('Fee', FeeSchema);
