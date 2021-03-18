//services
const blockchain = require("../../../services/Blockchain.js");
const { calculateShare } = require("../../../routes/utils/calculateShare");

// transaction services
const txstate = require("../services/states");
const execute = require("../services/execute.js");
const qname = require("../constants/queueName");

module.exports = async function (
	transfer,
	infra,
	bank,
	branch,
	merchant,
	fee,
	comm
) {
	try {
		// receiver's wallet names
		const branchOpWallet = branch.wallet_ids.operational;
		const merchantOpWallet = merchant.wallet_ids.operational;
		const bankOpWallet = bank.wallet_ids.operational;

		transfer = getAllShares(transfer, feeRule, commRule);

		// check branch operational wallet balance
		var balance = await blockchain.getBalance(branchOpWallet);
		if (Number(balance) < transfer.amount + transfer.bankFee) {
			return {
				status: 0,
				message: "Not enough balance. Recharge Your wallet.",
			};
		}

		let trans = [
			{
				from: branchOpWallet,
				to: merchantOpWallet,
				amount: transfer.amount,
				note: "Bill amount",
				email1: branch.email,
				email2: merchant.email,
				mobile1: branch.mobile,
				mobile2: merchant.mobile,
				from_name: branch.name,
				to_name: merchant.name,
				sender_id: transfer.cashierId,
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + "-p1",
				created_at: new Date(),
			},
		];

		if (transfer.bankFee > 0) {
			trans.push([
				{
					from: branchOpWallet,
					to: bankOpWallet,
					amount: transfer.bankFee,
					note: "Bank fee on paid bill",
					email1: branch.email,
					email2: bank.email,
					mobile1: branch.mobile,
					mobile2: bank.mobile,
					from_name: branch.name,
					to_name: bank.name,
					sender_id: transfer.cashierId,
					receiver_id: "",
					master_code: transfer.master_code,
					child_code: transfer.master_code + "-p2",
					created_at: new Date(),
				},
			]);
		}

		if (transfer.bankComm > 0) {
			trans.push([
				{
					from: merchantOpWallet,
					to: bankOpWallet,
					amount: transfer.bankComm,
					note: "Bank commission on paid bill",
					email1: merchant.email,
					email2: bank.email,
					mobile1: merchant.mobile,
					mobile2: bank.mobile,
					from_name: merchant.name,
					to_name: bank.name,
					sender_id: "",
					receiver_id: "",
					master_code: transfer.master_code,
					child_code: transfer.master_code + "-p6",
					created_at: new Date(),
				},
			]);

			let res = await execute(trans5, qname.comm);
			if (res.status == 0) {
				allTxSuccess = false;
			}
		}

		let res = await execute(trans);

		// return response
		if (res.status == 0) {
			return {
				status: 0,
				message: "Transaction failed! - " + res.message,
			};
		}

		distributeRevenue(transfer, infra, bank, branch);
		return {
			status: 1,
			message: "Transaction success!",
			bankFee: bankFee,
			partnerFeeShare: partnerFeeShare,
			partnerCommShare: partnerCommShare,
		};
	} catch (err) {
		throw err;
	}
};

async function distributeRevenue(transfer, infra, bank, branch) {
	const branchOpWallet = branch.wallet_ids.operational;
	const bankOpWallet = bank.wallet_ids.operational;
	const infraOpWallet = bank.wallet_ids.infra_operational;

	let allTxSuccess = true;

	if (transfer.infraFeeShare.percentage_amount > 0) {
		let trans31 = [
			{
				from: bankOpWallet,
				to: infraOpWallet,
				amount: transfer.infraFeeShare.percentage_amount,
				note: "Percentage share on paid bill",
				email1: bank.email,
				email2: infra.email,
				mobile1: bank.mobile,
				mobile2: infra.mobile,
				from_name: bank.name,
				to_name: infra.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + "-p3",
				created_at: new Date(),
			},
		];
		let res = await execute(trans31, qname.INFRA_PERCENT);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}

	if (transfer.infraFeeShare.fixed_amount > 0) {
		let trans32 = [
			{
				from: bankOpWallet,
				to: infraOpWallet,
				amount: transfer.infraFeeShare.fixed_amount,
				note: "Fixed share on paid bill",
				email1: bank.email,
				email2: infra.email,
				mobile1: bank.mobile,
				mobile2: infra.mobile,
				from_name: bank.name,
				to_name: infra.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + "-p4",
				created_at: new Date(),
			},
		];
		let res = await execute(trans32, qname.INFRA_FIXED);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}

	if (transfer.bankFee > 0) {
		//fourth transaction
		let trans4 = [
			{
				from: bankOpWallet,
				to: branchOpWallet,
				amount: transfer.partnerFeeShare,
				note: "Fee share on paid bill",
				email1: bank.email,
				email2: branch.email,
				mobile1: bank.mobile,
				mobile2: branch.mobile,
				from_name: bank.name,
				to_name: branch.name,
				sender_id: "",
				receiver_id: transfer.cashierId,
				master_code: transfer.master_code,
				child_code: transfer.master_code + "-p5",
				created_at: new Date(),
			},
		];

		let res = await execute(trans4, qname.PARTNER_MASTER);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}

	if (transfer.infraCommShare.percentage_amount > 0) {
		let trans61 = [
			{
				from: bankOpWallet,
				to: infraOpWallet,
				amount: transfer.infraCommShare.percentage_amount,
				note: "Commission share on paid bill",
				email1: bank.email,
				email2: infra.email,
				mobile1: bank.mobile,
				mobile2: infra.mobile,
				from_name: bank.name,
				to_name: infra.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + "-p7",
				created_at: new Date(),
			},
		];

		let res = await execute(trans61, qname.INFRA_PERCENTage);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}
	if (transfer.infraCommShare.fixed_amount > 0) {
		let trans62 = [
			{
				from: bankOpWallet,
				to: infraOpWallet,
				amount: transfer.infraCommShare.fixed_amount,
				note: "Fixed Commission share on paid bill",
				email1: bank.email,
				email2: infra.email,
				mobile1: bank.mobile,
				mobile2: infra.mobile,
				from_name: bank.name,
				to_name: infra.name,
				sender_id: "",
				receiver_id: "",
				master_code: transfer.master_code,
				child_code: transfer.master_code + "-p8",
				created_at: new Date(),
			},
		];

		let res = await execute(trans62, qname.INFRA_FIXED);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}

	if (transfer.bankComm > 0) {
		//seventh transaction
		let trans7 = [
			{
				from: bankOpWallet,
				to: branchOpWallet,
				amount: transfer.partnerCommShare,
				note: "Commission share on paid bill",
				email1: bank.email,
				email2: branch.email,
				mobile1: bank.mobile,
				mobile2: branch.mobile,
				from_name: bank.name,
				to_name: branch.name,
				sender_id: "",
				receiver_id: transfer.cashierId,
				master_code: transfer.master_code,
				child_code: transfer.master_code + "-p9",
				created_at: new Date(),
			},
		];

		let res = await execute(trans7, qname.PARTNER_MASTER);
		if (res.status == 0) {
			allTxSuccess = false;
		}
	}

	if (allTxSuccess) {
		transferToMasterWallets(transfer, infra, bank, branch);
	}
}

async function transferToMasterWallets(transfer, infra, bank, branch) {
	const bankOpWallet = bank.wallet_ids.operational;
	const bankMasterWallet = bank.wallet_ids.master;
	const infraOpWallet = bank.wallet_ids.infra_operational;
	const infraMasterWallet = bank.wallet_ids.infra_master;
	const branchOpWallet = branch.wallet_ids.operational;
	const branchMasterWallet = branch.wallet_ids.master;

	let infraPart =
		transfer.infraFeeShare.percentage_amount +
		transfer.infraFeeShare.fixed_amount +
		transfer.infraCommShare.percentage_amount +
		transfer.infraCommShare.fixed_amount;
	let sendBranchPart = transfer.partnerFeeShare + transfer.partnerCommShare;
	let bankPart =
		transfer.bankFee +
		transfer.bankComm -
		transfer.infraFeeShare.percentage_amount -
		transfer.infraCommShare.percentage_amount -
		sendBranchPart;

	let trans = [
		{
			from: bankOpWallet,
			to: bankMasterWallet,
			amount: bankPart,
			note: "Bank share to its Master Wallet",
			email1: bank.email,
			mobile1: bank.mobile,
			from_name: bank.name,
			to_name: bank.name,
			sender_id: "",
			receiver_id: "",
			master_code: master_code,
			child_code: master_code + "-m1",
			created_at: new Date(),
		},
	];
	execute(trans, qname.BANK_MASTER);

	trans = [
		{
			from: infraOpWallet,
			to: infraMasterWallet,
			amount: infraPart,
			note: "Infra share to its Master Wallet",
			email1: infra.email,
			mobile1: infra.mobile,
			from_name: infra.name,
			to_name: infra.name,
			sender_id: "",
			receiver_id: "",
			master_code: master_code,
			child_code: master_code + "-m2",
			created_at: new Date(),
		},
	];
	execute(trans, qname.INFRA_MASTER);

	trans = [
		{
			from: branchOpWallet,
			to: branchMasterWallet,
			amount: sendBranchPart,
			note: "Sending Branch share to its Master Wallet",
			email1: branch.email,
			mobile1: branch.mobile,
			from_name: branch.name,
			to_name: branch.name,
			sender_id: transfer.cashierId,
			receiver_id: "",
			master_code: master_code,
			child_code: master_code + "-m3",
			created_at: new Date(),
		},
	];
	execute(trans, qname.SEND_MASTER);
}

function getAllShares(transfer, feeRule, commRule) {
	let amount = transfer.amount;
	let bankFee = calculateShare("bank", amount, feeRule);
	let bankComm = calculateShare("bank", amount, commRule);
	let infraFeeShare = calculateShare("infra", amount, feeRule);
	let infraCommShare = calculateShare("infra", amount, commRule);
	let partnerFeeShare = 0;
	if (bankFee > 0) {
		partnerFeeShare = calculateShare(
			transfer.payerType,
			amount,
			feeRule,
			{},
			transfer.payerCode
		);
	}
	let partnerCommShare = 0;
	if (bankComm > 0) {
		partnerCommShare = calculateShare(
			transfer.payerType,
			amount,
			commRule,
			{},
			transfer.payerCode
		);
	}
	transfer.bankFee = bankFee;
	transfer.bankComm = bankComm;
	transfer.infraFeeShare = infraFeeShare;
	transfer.infraCommShare = infraCommShare;
	transfer.partnerFeeShare = partnerFeeShare;
	transfer.partnerCommShare = partnerCommShare;
	return transfer;
}
