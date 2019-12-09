// User.js
const mongoose = require('mongoose');
const OTPSchema = new mongoose.Schema({
  page: { type: String, required: true },
  otp: { type: String, required: true },
  mobile: { type: String, required: true },
  user_id: { type: String, required: true },
});
module.exports = mongoose.model('OTP', OTPSchema);
