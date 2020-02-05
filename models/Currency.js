// User.js
const mongoose = require("mongoose");
const CurrencySchema = new mongoose.Schema({

  value: {
    type: String
  },
  denomination: [
    {
      type: Number
    }
  ]
});
module.exports = mongoose.model("Currency", CurrencySchema);
