//services
const blockchain = require("../../services/Blockchain.js");
const { getTransactionCode, calculateShare } = require("../utils/utility");

module.exports = async function (
	amount,
	infra,
	bank,
	merchant,
	fee
) {

	amount = Number(amount);

	var creator = (merchant.creator == 1) ? "inframerchant" : "merchant";
	const merchantOpWallet = merchant.username + "_" + creator + "_operational@" + bank.name;
	const bankOpWallet = "operational@" + bank.name;
	const infraOpWallet = "infra_operational@" + bank.name;

	let master_code = getTransactionCode(merchant.mobile, bank.mobile);

	// first transaction
	bankFee = calculateShare("bank", amount, fee);
	console.log("Bank Fee: ", bankFee);

	let trans1 = {
		from: merchantOpWallet,
		to: bankOpWallet,
		amount: bankFee,
		note: "Bank fee on paid bill",
		email1: merchant.email,
		email2: bank.email,
		mobile1: merchant.mobile,
		mobile2: bank.mobile,
		fromName: merchant.name,
		toName: bank.name,
		master_code: master_code,
		child_code: master_code
	};

	await blockchain.initiateTransfer(trans1);

	//second transaction
	infraShare = calculateShare("infra", amount, fee);
	console.log("Infra Share: ", infraShare);
	let trans2 = {
		from: bankOpWallet,
		to: infraOpWallet,
		amount: infraShare,
		note: "Infra Fee share on paid bill",
		email1: bank.email,
		email2: infra.email,
		mobile1: bank.mobile,
		mobile2: infra.mobile,
		fromName: bank.name,
		toName: infra.name,
		master_code: master_code,
		child_code: getTransactionCode(bank.mobile, infra.mobile) + "1",
	};

	await blockchain.initiateTransfer(trans2);

	result = {
		status: 1,
		message: "Transaction success!",
	};
	return result;
};