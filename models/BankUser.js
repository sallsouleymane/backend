// BankUser.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const BankUserSchema = new mongoose.Schema({
	name: { type: String, required: true },
	username: { type: String, required: true, unique: true },
	ccode: { type: String, required: false },
	role: { type: String, default: 'user'},
	mobile: { type: String, required: true, unique: true },
	email: { type: String, required: true, unique: true },
	password: { type: String, required: true },
	branch_id: { type: String, required: false },
	bank_id: { type: String, required: true },
	logo: { type: String, required: false },
	status: { type: Number, required: true, default: 1 },
});

BankUserSchema.pre('save', async function (next){
	try{
		const hashedPassword = await bcrypt.hash(this.password,12);
		this.password = hashedPassword;
		next();

	}catch(err){
		next(err);
	}
});

module.exports = mongoose.model("BankUser", BankUserSchema);
