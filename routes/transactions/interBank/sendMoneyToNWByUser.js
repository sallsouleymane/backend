//services
const blockchain = require("../../../services/Blockchain.js");
const { getTransactionCode, calculateShare } = require("../../utils/utility");

module.exports = async function (
    transfer,
    infra,
    bank,
    sender,
    rule1
) {
    try {
        const senderWallet = sender.wallet_id;
        const bankEsWallet = bank.wallet_ids.escrow;
        const bankOpWallet = bank.wallet_ids.operational;

        // first transaction
        var amount = Number(transfer.amount);
        var fee = calculateShare("bank", transfer.amount, rule1);
        if (transfer.isInclusive) {
            amount = amount - fee;
        }

        var balance = await blockchain.getBalance(senderWallet);

        //Check balance first
        if (
            Number(balance) <
            amount + fee
        ) {
            throw new Error("Not enough balance in user's wallet")
        }

        let master_code = getTransactionCode(sender.mobile, bank.mobile)

        let trans1 = {
            from: senderWallet,
            to: bankEsWallet,
            amount: amount,
            note: "Transferred Money to " + transfer.receiverFamilyName,
            email1: sender.email,
            email2: bank.email,
            mobile1: sender.mobile,
            mobile2: bank.mobile,
            from_name: sender.name,
            to_name: bank.name,
            user_id: "",
            master_code: master_code,
            child_code: master_code + "1"
        }
        var result = await blockchain.initiateTransfer(trans1);

        // return response
        if (result.status == 0) {
            return {
                status: 0,
                message: "Transaction failed!",
                blockchain_message: result.message,
            };
        }

        if (fee > 0) {
            const trans2 = {
                from: senderWallet,
                to: bankOpWallet,
                amount: fee,
                note: "Bank Fee",
                email1: sender.email,
                email2: bank.email,
                mobile1: sender.mobile,
                mobile2: bank.mobile,
                from_name: sender.name,
                to_name: bank.name,
                user_id: "",
                master_code: master_code,
                child_code: master_code + "2"
            }
            await blockchain.initiateTransfer(trans2);
        }

        transfer.master_code = master_code;
        distributeRevenue(
            transfer,
            infra,
            bank,
            rule1
        );
        return {
            status: 1,
            message: "Transaction success!",
            blockchain_message: result.message,
            balance: balance,
            amount: amount,
            fee: fee,
            master_code: master_code,
        };
    } catch (err) {
        throw err;
    }

}

async function distributeRevenue(
    transfer,
    infra,
    bank,
    rule1) {
    const bankOpWallet = bank.wallet_ids.operational;
    const infraOpWallet = bank.wallet_ids.infra_operational;

    var infraShare = calculateShare("infra", transfer.amount, rule1);

    if (infraShare.percentage_amount > 0) {
        let trans21 = {
            from: bankOpWallet,
            to: infraOpWallet,
            amount: infraShare.percentage_amount,
            note: "Bank Send Infra Percentage amount for Inter Bank Wallet to Non Wallet transaction",
            email1: bank.email,
            email2: infra.email,
            mobile1: bank.mobile,
            mobile2: infra.mobile,
            from_name: bank.name,
            to_name: infra.name,
            user_id: "",
            master_code: transfer.master_code,
            child_code: transfer.master_code + "2.1",
        }
        await blockchain.initiateTransfer(trans21);
    }

    if (infraShare.fixed_amount > 0) {
        let trans22 = {
            from: bankOpWallet,
            to: infraOpWallet,
            amount: infraShare.fixed_amount,
            note: "Bank Send Infra Fixed amount for Inter Bank Non Wallet to Non Wallet transaction",
            email1: bank.email,
            email2: infra.email,
            mobile1: bank.mobile,
            mobile2: infra.mobile,
            from_name: bank.name,
            to_name: infra.name,
            user_id: "",
            master_code: transfer.master_code,
            child_code: transfer.master_code + "2.2",
        }
        await blockchain.initiateTransfer(trans22);
    }
}