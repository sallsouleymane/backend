const mongoose = require("mongoose");
const SubzoneSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    merchant_id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: false },
    branch_count: { type: Number, required: false},
    type: { type: String, required: false },
    zone_id: { type: String, required: true },
    
});
module.exports = mongoose.model("Subzone", SubzoneSchema);