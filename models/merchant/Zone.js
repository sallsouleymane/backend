const mongoose = require("mongoose");
const ZoneSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    merchant_id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: false }
});
module.exports = mongoose.model("Zone", ZoneSchema);