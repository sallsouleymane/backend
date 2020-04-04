// User.js
const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true},
  last_name: { type: String, required: false },
  mobile: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  address: { type: String, required: false },
  city: { type: String, required: false },
  state: { type: String, required: false },
  country: { type: String, required: false },
  id_type: { type: String, required: false },
  id_name: { type: String, required: false },
  valid_till: { type: String, required: false },
  idNumber: { type: String, required: false },
  dob: { type: String, required: false },
  gender: { type: String, required: false },
  token: { type: String, required: false },
  otp: { type: String, required: false,  default: null },
  bank: { type: String, required: false, default: null },
  docsHash: { type: Array, required: false, default: null },
  status: { type: String, required: true, default: null },
  contactList: { type: [String], required: false, default: null }
});
module.exports = mongoose.model('User', UserSchema);
  