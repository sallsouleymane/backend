//services
const blockchain = require("../../../services/Blockchain.js");
const {
	getTransactionCode,
	calculateShare,
} = require("../../utils/calculateShare");

module.exports = async function (
	transfer,
	infra,
	bank,
	branch,
	toBranch,
	rule
) {
	try {
		var fee = calculateShare("bank", transfer.amount, rule);
		var amount = Number(transfer.amount);
		if (transfer.isInclusive) {
			amount = amount - fee;
		}

		var balance = await blockchain.getBalance(branch.wallet_ids.operational);

		//Check balance first
		if (Number(balance) + Number(branch.credit_limit) < amount + fee) {
			return {
				status: 0,
				message: "Not enough balance in branch operational wallet",
			};
		}

		let master_code = getTransactionCode(branch.mobile, bank.mobile);

		let trans = {
			from: branch.wallet_ids.operational,
			to: toBranch.wallet_ids.operational,
			amount: amount,
			note: "Transfer to " + toBranch.name + " Operational Wallet",
			email1: branch.email,
			email2: toBranch.email,
			mobile1: branch.mobile,
			mobile2: toBranch.mobile,
			from_name: branch.name,
			to_name: toBranch.name,
			user_id: "",
			master_code: master_code,
			child_code: master_code + "1",
		};
		var result = await blockchain.initiateTransfer(trans);
		if (result.status == 0) {
			res.status(200).json({
				status: 0,
				message: result.message,
			});
		} else {
			transfer.fee = fee;
			var sendingBranchShare = 0;
			if (fee > 0) {
				let trans = {
					from: branch.wallet_ids.operational,
					to: bank.wallet_ids.operational,
					amount: fee,
					note:
						"Cashier Send Fee for Inter Bank Non Wallet to Non Wallet Transaction",
					email1: branch.email,
					email2: bank.email,
					mobile1: branch.mobile,
					mobile2: bank.mobile,
					from_name: branch.name,
					to_name: bank.name,
					user_id: "",
					master_code: master_code,
					child_code: master_code + "1",
				};

				await blockchain.initiateTransfer(trans);
				sendingBranchShare = calculateShare(
					"sendBranch",
					transfer.amount,
					rule,
					{},
					branch.bcode
				);
				transfer.sendingBranchShare = sendingBranchShare;
			}
			transfer.master_code = master_code;
			distributeRevenue(transfer, infra, bank, branch, rule);
			return {
				status: 1,
				message: result.message,
				amount: amount,
				fee: fee,
				sendFee: sendingBranchShare,
			};
		}
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, infra, bank, branch, rule) {
	const branchOpWallet = branch.wallet_ids.operational;
	const bankOpWallet = bank.wallet_ids.operational;
	const infraOpWallet = bank.wallet_ids.infra_operational;

	var infraShare = calculateShare("infra", transfer.amount, rule);

	if (infraShare.percentage_amount > 0) {
		let trans = {
			from: bankOpWallet,
			to: infraOpWallet,
			amount: infraShare.percentage_amount,
			note: "Cashier Send percentage Infra Fee",
			email1: bank.email,
			email2: infra.email,
			mobile1: bank.mobile,
			mobile2: infra.mobile,
			from_name: bank.name,
			to_name: infra.name,
			user_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + "3.1",
		};
		await blockchain.initiateTransfer(trans);
	}

	if (infraShare.fixed_amount > 0) {
		let trans = {
			from: bankOpWallet,
			to: infraOpWallet,
			amount: infraShare.fixed_amount,
			note: "Cashier Send fixed Infra Fee",
			email1: bank.email,
			email2: infra.email,
			mobile1: bank.mobile,
			mobile2: infra.mobile,
			from_name: bank.name,
			to_name: infra.name,
			user_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + "3.2",
		};
		await blockchain.initiateTransfer(trans);
	}

	if (transfer.fee > 0) {
		let trans = {
			from: bankOpWallet,
			to: branchOpWallet,
			amount: transfer.sendingBranchShare,
			note: "Bank Send Revenue share to Branch for Sending money",
			email1: bank.email,
			email2: branch.email,
			mobile1: bank.mobile,
			mobile2: branch.mobile,
			from_name: bank.name,
			to_name: branch.name,
			user_id: "",
			master_code: transfer.master_code,
			child_code: transfer.master_code + "4",
		};

		await blockchain.initiateTransfer(trans);
	}
}
