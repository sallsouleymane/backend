// User.js
const mongoose = require('mongoose');
const BankFeeSchema = new mongoose.Schema({
  name: { type: String, required: true},
  trans_type: { type: String, required: true },
  trans_from: { type: String, required: true },
  trans_to: { type: String, required: true },
  active: { type: String, required: true },
  ranges: { type: String, required: true },
  editedRanges: { type: String, required: true },
  bank_id: { type: String, required: true},
  token: {type: String, required:false, default:null},
  status: { type: Number, required: true, default: 0 },
  edit_status: { type: Number, required: true, default: 0 }
});
module.exports = mongoose.model('BankFee', BankFeeSchema);
