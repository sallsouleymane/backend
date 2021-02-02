const mongoose = require("mongoose");
const CountrySchema = new mongoose.Schema({

    country_list: [
        {
            ccode: { type: String, required: false},
            name: { type: String, required: false},
        },
    ],
});
module.exports = mongoose.model("Country", CountrySchema);