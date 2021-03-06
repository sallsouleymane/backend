// User.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const BankSchema = new mongoose.Schema({
	name: { type: String, required: true, unique: true },
	bcode: { type: String, required: true, unique: true },
	address1: { type: String, required: true },
	state: { type: String, required: true },
	zip: { type: String, required: true },
	country: { type: String, required: true },
	ccode: { type: String, required: false },
	mobile: { type: String, required: true, unique: true },
	email: { type: String, required: true, unique: true },
	user_id: { type: String, required: true },
	logo: { type: String, required: false },
	contract: { type: String, required: false },
	username: { type: String, required: true, unique: true },
	password: { type: String, required: true },
	created_at: { type: Date, default: Date.now },
	modified_at: { type: Date, default: null },
	initial_setup: { type: Boolean, default: false },
	status: { type: Number, required: true, default: 0 },
	total_trans: { type: Number, required: false, default: 0 },
	working_from: { type: String, required: false, default: 0 },
	working_to: { type: String, required: false, default: 0 },
	total_branches: { type: Number, required: true, default: 0 },
	total_cashiers: { type: Number, required: true, default: 0 },
	total_partners: { type: Number, required: true, default: 0 },
	wallet_ids: {
		operational: { type: String, required: false },
		master: { type: String, required: false },
		escrow: { type: String, required: false },
		infra_operational: { type: String, required: false },
		infra_master: { type: String, required: false },
	},
	theme:{
		primary: { type: String, required: false, default: '#417505' },
		secondary: { type: String, required: false, default: '#6cac69' },
	}
});

BankSchema.pre('save', async function (next){
	try{
		const hashedPassword = await bcrypt.hash(this.password,12);
		this.password = hashedPassword;
		next();

	}catch(err){
		next(err);
	}
});

module.exports = mongoose.model("Bank", BankSchema);
