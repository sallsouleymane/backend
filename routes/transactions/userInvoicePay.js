//services
const blockchain = require("../../services/Blockchain.js");
const { getTransactionCode, calculateShare } = require("../utils/utility");

module.exports = async function (
	amount,
	infra,
	bank,
	user,
	merchant,
	fee,
	comm
) {
	// receiver's wallet names
	const userWallet = user.mobile + "@" + bank.name;
	const merchantOpWallet = merchant.username + "_operational@" + bank.name;

	let master_code = getTransactionCode(user.mobile, merchant.mobile);

	// first transaction
	amount = Number(amount);

	let trans1 = {
		from: userWallet,
		to: merchantOpWallet,
		amount: amount,
		note: "Bill amount",
		email1: user.email,
		email2: merchant.email,
		mobile1: user.mobile,
		mobile2: merchant.mobile,
		master_code: master_code,
		child_code: master_code + "1",
	};

	var result = await blockchain.initiateTransfer(trans1);

	// return response
	if (result.status == 0) {
		result = {
			status: 0,
			message: "Transaction failed!",
			blockchain_message: result.message,
		};
	} else {
        
		result = {
			status: 1,
			message: "Transaction success!",
			blockchain_message: result.message,
		};
	}
	distributeRevenue(
		amount,
		infra,
		bank,
		user,
		merchant,
		fee,
		comm,
		master_code
	);
	return result;
};

async function distributeRevenue(
    amount,
	infra,
	bank,
	user,
	merchant,
	fee,
	comm,
	master_code
) {
	const userWallet = user.mobile + "@" + bank.name;
	const merchantOpWallet = merchant.username + "_operational@" + bank.name;
	const bankOpWallet = "operational@" + bank.name;
    const infraOpWallet = "infra_operational@" + bank.name;
    
	//second transaction
	bankFee = calculateShare("bank", amount, fee);
	console.log("Bank Fee: ", bankFee);

	let trans2 = {
		from: userWallet,
		to: bankOpWallet,
		amount: bankFee,
		note: "Bank fee on paid bill",
		email1: user.email,
		email2: bank.email,
		mobile1: user.mobile,
		mobile2: bank.mobile,
		master_code: master_code,
		child_code: getTransactionCode(user.mobile, bank.mobile) + "2",
	};

	await blockchain.initiateTransfer(trans2);

	//third transaction
	infraShare = calculateShare("infra", amount, fee);
	console.log("Infra Share: ", infraShare);
	let trans3 = {
		from: bankOpWallet,
		to: infraOpWallet,
		amount: infraShare,
		note: "Fee share on paid bill",
		email1: bank.email,
		email2: infra.email,
		mobile1: bank.mobile,
		mobile2: infra.mobile,
		master_code: master_code,
		child_code: getTransactionCode(bank.mobile, infra.mobile) + "3",
	};

	await blockchain.initiateTransfer(trans3);

	//fourth transaction
	bankComm = calculateShare("bank", amount, comm);
	let trans5 = {
		from: merchantOpWallet,
		to: bankOpWallet,
		amount: bankComm,
		note: "Bank commission on paid bill",
		email1: merchant.email,
		email2: bank.email,
		mobile1: merchant.mobile,
		mobile2: bank.mobile,
		master_code: master_code,
		child_code: getTransactionCode(merchant.mobile, bank.mobile) + "5",
	};

	await blockchain.initiateTransfer(trans5);

	//fifth transaction
	infraShare = calculateShare("infra", amount, comm);
	let trans6 = {
		from: bankOpWallet,
		to: infraOpWallet,
		amount: infraShare,
		note: "Commission share on paid bill",
		email1: bank.email,
		email2: infra.email,
		mobile1: bank.mobile,
		mobile2: infra.mobile,
		master_code: master_code,
		child_code: getTransactionCode(bank.mobile, infra.mobile) + "6",
	};

	await blockchain.initiateTransfer(trans6);
}
