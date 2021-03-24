const mongoose = require("mongoose");
const ZoneSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    merchant_id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: false },
    type: { type: String, required: false },
    branch_count: { type: Number, required: false, default: 0},
    subzone_count: { type: Number, required: false, default: 0},
});
module.exports = mongoose.model("Zone", ZoneSchema);