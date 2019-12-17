// User.js
const mongoose = require('mongoose');
const FeeSchema = new mongoose.Schema({
  name: { type: String, required: true},
  trans_type: { type: String, required: true },
  active: { type: String, required: true },
  trans_from: { type: Number, required: true },
  trans_to: { type: Number, required: true },
  transcount_from: { type: Number, required: true },
  transcount_to: { type: Number, required: true },
  fixed_amount: { type: Number, required: false, default: 0 },
  percentage: { type: Number, required: false, default: 0},
  bank_id: { type: String, required: true},
  user_id: { type: String, required: true },
  token: {type: String, required:false, default:null},
  status: { type: Number, required: true, default: 0 }
});
module.exports = mongoose.model('Fee', FeeSchema);
