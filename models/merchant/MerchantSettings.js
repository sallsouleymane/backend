const mongoose = require("mongoose");
const MerchantSettings = new mongoose.Schema({
    merchant_id: { type: String, required: true },
	zone_name: { type: String, required: false, default: 'Zone' },
    subzone_name: { type: String, required: false, default: 'Sub zone' },
    bill_period: [
        {
            start_date: { type: Date, required: false},
            end_date: { type: Date, required: false}, 
            period_name: { type: Date, required: false},
        }
    ],
    bill_term: [
        {
            days: { type: Number, required: false},
            name: { type: String, required: false},
        },
    ],
});

module.exports = mongoose.model("MerchantSettings", MerchantSettings);