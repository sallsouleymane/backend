// User.js
const mongoose = require('mongoose');
const ProfileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: false },
  permissions: { type: String, required: true },
  user_id: { type: String, required: true },
  created_at: { type: Date, required: true, default: Date.now },
});
module.exports = mongoose.model('Profile', ProfileSchema);
