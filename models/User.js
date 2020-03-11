// User.js
const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true},
  mobile: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  address: {type: String, required: false},
  token: { type: String, required: false },
  otp: { type: String, required: false,  default: null},
  status: {type:Number, required: true, default: 0}
});
module.exports = mongoose.model('User', UserSchema);
  