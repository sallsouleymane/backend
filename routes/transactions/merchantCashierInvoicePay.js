//services
const blockchain = require("../../services/Blockchain.js");
const { getTransactionCode, calculateShare } = require("../utils/utility");

module.exports = async function (
	amount,
	infra,
	bank,
	merchant,
	comm
) {

	amount = Number(amount);

	var creator = (merchant.creator == 1) ? "inframerchant" : "merchant";
	const merchantOpWallet = merchant.code + "_" + creator + "_operational@" + bank.name;
	const bankOpWallet = "operational@" + bank.name;
	const infraOpWallet = "infra_operational@" + bank.name;

	let master_code = getTransactionCode(merchant.mobile, bank.mobile);

	// first transaction
	bankComm = calculateShare("bank", amount, comm);
	console.log("Bank Commission: ", bankComm);

	let trans1 = {
		from: merchantOpWallet,
		to: bankOpWallet,
		amount: bankComm,
		note: "Bank commission on paid bill",
		email1: merchant.email,
		email2: bank.email,
		mobile1: merchant.mobile,
		mobile2: bank.mobile,
		from_name: merchant.name,
		to_name: bank.name,
		master_code: master_code,
		child_code: master_code
	};

	await blockchain.initiateTransfer(trans1);

	//second transaction
	infraShare = calculateShare("infra", amount, comm);
	console.log("Infra Share: ", infraShare);
	let trans2 = {
		from: bankOpWallet,
		to: infraOpWallet,
		amount: infraShare,
		note: "Infra commission share on paid bill",
		email1: bank.email,
		email2: infra.email,
		mobile1: bank.mobile,
		mobile2: infra.mobile,
		from_name: bank.name,
		to_name: infra.name,
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