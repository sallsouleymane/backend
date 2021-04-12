// BankUser.js
const mongoose = require('mongoose');
const PartnerUserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    role: { type: String, default: 'user'},
    ccode: { type: String, required: false },
    mobile: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    branch_id: { type: String, required: false },
    partner_id: { type: String, required: true },
    logo: { type: String, required: false },
    status: { type: Number, required: true, default: 1 }
});
module.exports = mongoose.model('PartnerUser', PartnerUserSchema);
