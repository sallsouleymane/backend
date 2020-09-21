//services
const blockchain = require("../../../services/Blockchain.js");
const { getTransactionCode, calculateShare } = require("../../utils/utility");

module.exports = async function (
    amount,
    infra,
    bank,
    branch,
    rule1,
    rule2,
    isInclusive,
    cashier_id
) {
    const branchOpWallet =
        branch.bcode + "_operational@" + bank.name;
    const bankEsWallet = "escrow@" + bank.name;
    const bankOpWallet = "operational@" + bank.name;

    // first transaction
    amount = Number(amount);
    var fee = calculateShare("bank", amount, rule1);
    if (isInclusive) {
        amount = amount - fee;
    }

    var balance = await blockchain.getBalance(branchOpWallet);

    //Check balance first
    if (
        Number(balance) +
        Number(branch.credit_limit) <
        amount + fee
    ) {
        return {
            status: 0,
            message: "Not enough balance in branch operational wallet",
        };
    }

    let master_code = getTransactionCode(branch.mobile, bank.mobile)

    let trans1 = {
        from: branchOpWallet,
        to: bankEsWallet,
        amount: amount,
        note: "Cashier Send Money to Non Wallet of Inter Bank",
        email1: branch.email,
        email2: bank.email,
        mobile1: branch.mobile,
        mobile2: bank.mobile,
        from_name: branch.name,
        to_name: bank.name,
        user_id: cashier_id,
        master_code: master_code,
        child_code: master_code
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

    let trans2 = {
        from: branchOpWallet,
        to: bankOpWallet,
        amount: fee,
        note: "Cashier Send Fee for Inter Bank Non Wallet to Non Wallet Transaction",
        email1: branch.email,
        email2: bank.email,
        mobile1: branch.mobile,
        mobile2: bank.mobile,
        from_name: branch.name,
        to_name: bank.name,
        user_id: cashier_id,
        master_code: master_code,
        child_code: master_code + "1"
    }

    await blockchain.initiateTransfer(trans2);

    distributeRevenue(
        amount,
        infra,
        bank,
        branch,
        rule1,
        rule2,
        master_code
    );
    var sendingBranchShare = calculateShare("sendBranch", amount, rule1, rule2, branch.bcode);
    return {
        status: 1,
        message: "Transaction success!",
        blockchain_message: result.message,
        amount: amount,
        fee: fee,
        sendFee: sendingBranchShare,
        master_code: master_code
    };

}

async function distributeRevenue(amount,
    infra,
    bank,
    branch,
    rule1,
    rule2,
    master_code) {
    const branchOpWallet =
        branch.bcode + "_operational@" + bank.name;
    const bankOpWallet = "operational@" + bank.name;
    const infraOpWallet =
        "infra_operational@" + bank.name;

    var infraShare = calculateShare("infra", amount, rule1);

    let trans3 = {
        from: bankOpWallet,
        to: infraOpWallet,
        amount: infraShare,
        note: "Bank Send Infra Fee for Inter Bank Non Wallet to Non Wallet transaction",
        email1: branch.email,
        email2: infra.email,
        mobile1: branch.mobile,
        mobile2: infra.mobile,
        from_name: branch.name,
        to_name: infra.name,
        user_id: "",
        master_code: master_code,
        child_code: master_code + "2",
    }

    await blockchain.initiateTransfer(trans3);

    var sendingBranchShare = calculateShare("sendBranch", amount, rule1, rule2, branch.bcode);

    let trans4 = {
        from: bankOpWallet,
        to: branchOpWallet,
        amount: sendingBranchShare,
        note: "Bank Send Revenue Share for Sending Money for Inter Bank Non Wallet to Non Wallet transaction",
        email1: branch.email,
        email2: bank.email,
        mobile1: branch.mobile,
        mobile2: bank.mobile,
        from_name: branch.name,
        to_name: bank.name,
        user_id: "",
        master_code: master_code,
        child_code: master_code + "3",
    }

    await blockchain.initiateTransfer(trans4);
}