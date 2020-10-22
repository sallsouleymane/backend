// User.js
const mongoose = require("mongoose");
const PartnerSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true },
    address: { type: String, required: true },
    state: { type: String, required: true },
    zip: { type: String, required: true },
    country: { type: String, required: true },
    ccode: { type: String, required: false },
    mobile: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    bank_id: { type: String, required: true },
    logo: { type: String, required: false },
    contract: { type: String, required: false },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
    modified_at: { type: Date, default: null },
    initial_setup: { type: Boolean, default: false },
    status: { type: Number, required: true, default: 0 },
    working_from: { type: String, required: false, default: 0 },
    working_to: { type: String, required: false, default: 0 },
    total_branches: { type: Number, required: true, default: 0 },
    total_cashiers: { type: Number, required: true, default: 0 },
    total_trans: { type: Number, required: false, default: 0 },
    wallets: {
        op_wallet: { type: String, required: false },
        master_wallet: { type: String, required: false }
    }
});
module.exports = mongoose.model("Partner", PartnerSchema);
