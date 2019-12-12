// Infra.js
const mongoose = require('mongoose');
const InfraSchema = new mongoose.Schema({
  name: { type: String, required: true},
  username: { type: String, required: true, unique: true },
  mobile: { type: String, required: true, unique: true },
  email: { type: String, required: true},
  password: { type: String, required: true },
  initial_setup: {type: Boolean, default: false, required: false},
  status: {type: Number, default: 1, required: false},
  token: { type: String, required: false }
});
module.exports = mongoose.model('Infra', InfraSchema);

InfraSchema.methods.isCorrectPassword = function(password, callback){
    // bcrypt.compare(password, this.password, function(err, same) {
      if (password == this.password) {
        callback(err);
      } else {
        callback(err, same);
      }
    // });
  }
  