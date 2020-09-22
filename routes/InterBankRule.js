const express = require("express");
const router = express.Router();

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const makeid = require("./utils/idGenerator");
const makeotp = require("./utils/makeotp");
const interBankSendMoneyToNonWallet = require("./transactions/interBank/sendMoneyToNonWallet");
const interBankClaimMoney = require("./transactions/interBank/claimMoney");

const Bank = require("../models/Bank");
const Branch = require("../models/Branch")
const Cashier = require("../models/Cashier");
const CashierSend = require("../models/CashierSend");
const CashierPending = require("../models/CashierPending");
const CashierClaim = require("../models/CashierClaim");
const CashierLedger = require("../models/CashierLedger");
const CashierTransfer = require("../models/CashierTransfer");
const PartnerCashier = require("../models/partner/Cashier");
const Infra = require("../models/Infra");
const InterBankRule = require("../models/InterBankRule");
const Fee = require("../models/Fee");

const JWTTokenAuth = require("./JWTTokenAuth");


router.post("/cashier/interBank/claimMoney", function (req, res) {
    var today = new Date();
    today = today.toISOString();
    var s = today.split("T");
    var start = s[0] + "T00:00:00.000Z";
    var end = s[0] + "T23:59:59.999Z";

    const {
        token,
        transferCode,
        proof,
        givenname,
        familyname,
        receiverGivenName,
        receiverFamilyName,
        mobile,
    } = req.body;

    Cashier.findOne(
        {
            token,
            status: 1,
        },
        function (err, cashier) {
            if (err) {
                console.log(err);
                var message = err;
                if (err.message) {
                    message = err.message;
                }
                res.status(200).json({
                    status: 0,
                    message: message,
                });
            } else if (cashier == null) {
                res.status(200).json({
                    status: 0,
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                CashierClaim.findOne(
                    {
                        transaction_code: transferCode,
                        status: 1
                    },
                    function (err, cc) {
                        if (err) {
                            console.log(err);
                            var message = err;
                            if (err.message) {
                                message = err.message;
                            }
                            res.status(200).json({
                                status: 0,
                                message: message,
                            });
                        } else if (cc) {
                            res.status(200).json({
                                status: 0,
                                message: "Money is already claimed",
                            });
                        } else {
                            CashierSend.findOne(
                                {
                                    transaction_code: transferCode,
                                },
                                function (err, cs) {
                                    if (err) {
                                        console.log(err);
                                        var message = err;
                                        if (err.message) {
                                            message = err.message;
                                        }
                                        res.status(200).json({
                                            status: 0,
                                            message: message,
                                        });
                                    } else if (cs == null) {
                                        res.status(200).json({
                                            status: 0,
                                            message: "Transaction Not Found",
                                        });
                                    } else {
                                        Branch.findOne(
                                            {
                                                _id: cashier.branch_id,
                                            },
                                            function (err, branch) {
                                                if (err) {
                                                    console.log(err);
                                                    var message = err;
                                                    if (err.message) {
                                                        message = err.message;
                                                    }
                                                    res.status(200).json({
                                                        status: 0,
                                                        message: message,
                                                    });
                                                } else if (branch == null) {
                                                    res.status(200).json({
                                                        status: 0,
                                                        message: "Branch Not Found",
                                                    });
                                                } else {
                                                    Bank.findOne(
                                                        {
                                                            _id: cashier.bank_id,
                                                        },
                                                        function (err, bank) {
                                                            if (err) {
                                                                console.log(err);
                                                                var message = err;
                                                                if (err.message) {
                                                                    message = err.message;
                                                                }
                                                                res.status(200).json({
                                                                    status: 0,
                                                                    message: message,
                                                                });
                                                            } else if (bank == null) {
                                                                res.status(200).json({
                                                                    status: 0,
                                                                    message: "Bank Not Found",
                                                                });
                                                            } else {
                                                                Bank.findOne({ _id: cs.sending_bank_id }, (err, sendingBank) => {
                                                                    if (err) {
                                                                        console.log(err);
                                                                        var message = err;
                                                                        if (err.message) {
                                                                            message = err.message;
                                                                        }
                                                                        res.status(200).json({
                                                                            status: 0,
                                                                            message: message,
                                                                        });
                                                                    } else if (sendingBank == null) {
                                                                        res.status(200).json({
                                                                            status: 0,
                                                                            message: "Bank Not Found",
                                                                        });
                                                                    } else {
                                                                        var amount = cs.amount;
                                                                        if (cs.is_inclusive) {
                                                                            amount = cs.amount - cs.fee;
                                                                        }
                                                                        let data = new CashierClaim();
                                                                        data.transaction_code = transferCode;
                                                                        data.proof = proof;
                                                                        data.cashier_id = cashier._id;
                                                                        data.amount = cs.amount;
                                                                        data.fee = cs.fee;
                                                                        data.is_inclusive = cs.is_inclusive;
                                                                        data.sender_name = givenname + " " + familyname;
                                                                        data.sender_mobile = mobile;
                                                                        data.receiver_name =
                                                                            receiverGivenName + " " + receiverFamilyName;
                                                                        var master_code = cs.master_code;
                                                                        data.master_code = master_code;
                                                                        data.child_code = master_code + "-1";

                                                                        data.save((err, cashierClaimObj) => {
                                                                            if (err) {
                                                                                console.log(err);
                                                                                var message = err;
                                                                                if (err.message) {
                                                                                    message = err.message;
                                                                                }
                                                                                res.status(200).json({
                                                                                    status: 0,
                                                                                    message: message,
                                                                                });
                                                                            } else {
                                                                                const find = {
                                                                                    bank_id: sendingBank._id,
                                                                                    type: cs.inter_bank_rule_type,
                                                                                    status: 1,
                                                                                    active: 1,
                                                                                };
                                                                                InterBankRule.findOne(find, function (err, rule1) {
                                                                                    if (err) {
                                                                                        console.log(err);
                                                                                        var message = err;
                                                                                        if (err.message) {
                                                                                            message = err.message;
                                                                                        }
                                                                                        res.status(200).json({
                                                                                            status: 0,
                                                                                            message: message,
                                                                                        });
                                                                                    } else if (rule1 == null) {
                                                                                        res.status(200).json({
                                                                                            status: 0,
                                                                                            message: "Inter Bank Fee Rule Not Found",
                                                                                        });
                                                                                    } else {
                                                                                        const find = {
                                                                                            bank_id: cashier.bank_id,
                                                                                            trans_type: cs.rule_type,
                                                                                            status: 1,
                                                                                            active: "Active",
                                                                                        };
                                                                                        Fee.findOne(find, function (err, rule2) {
                                                                                            if (err) {
                                                                                                console.log(err);
                                                                                                var message = err;
                                                                                                if (err.message) {
                                                                                                    message = err.message;
                                                                                                }
                                                                                                res.status(200).json({
                                                                                                    status: 0,
                                                                                                    message: message,
                                                                                                });
                                                                                            } else if (rule2 == null) {
                                                                                                res.status(200).json({
                                                                                                    status: 0,
                                                                                                    message: "Revenue Rule Not Found",
                                                                                                });
                                                                                            } else {
                                                                                                interBankClaimMoney(amount, sendingBank, bank, branch, rule1, rule2)
                                                                                                    .then(function (result) {
                                                                                                        if (result.status == 1) {
                                                                                                            CashierClaim.findByIdAndUpdate(
                                                                                                                cashierClaimObj._id,
                                                                                                                {
                                                                                                                    status: 1,
                                                                                                                },
                                                                                                                (err) => {
                                                                                                                    if (err) {
                                                                                                                        console.log(err);
                                                                                                                        var message = err;
                                                                                                                        if (err.message) {
                                                                                                                            message = err.message;
                                                                                                                        }
                                                                                                                        res.status(200).json({
                                                                                                                            status: 0,
                                                                                                                            message: message,
                                                                                                                        });
                                                                                                                    } else {
                                                                                                                        Cashier.findByIdAndUpdate(
                                                                                                                            cashier._id,
                                                                                                                            {
                                                                                                                                cash_paid:
                                                                                                                                    Number(
                                                                                                                                        cashier.cash_paid
                                                                                                                                    ) + Number(amount),
                                                                                                                                cash_in_hand:
                                                                                                                                    Number(
                                                                                                                                        cashier.cash_in_hand
                                                                                                                                    ) - Number(amount),
                                                                                                                                fee_generated:
                                                                                                                                    Number(
                                                                                                                                        cashier.fee_generated
                                                                                                                                    ) +
                                                                                                                                    Number(result.claimFee),

                                                                                                                                total_trans:
                                                                                                                                    Number(
                                                                                                                                        cashier.total_trans
                                                                                                                                    ) + 1,
                                                                                                                            },
                                                                                                                            function (e, v) { }
                                                                                                                        );
                                                                                                                        CashierLedger.findOne(
                                                                                                                            {
                                                                                                                                cashier_id: cashier._id,
                                                                                                                                trans_type: "DR",
                                                                                                                                created_at: {
                                                                                                                                    $gte: new Date(
                                                                                                                                        start
                                                                                                                                    ),
                                                                                                                                    $lte: new Date(end),
                                                                                                                                },
                                                                                                                            },
                                                                                                                            function (err, c) {
                                                                                                                                if (
                                                                                                                                    err ||
                                                                                                                                    c == null
                                                                                                                                ) {
                                                                                                                                    let data = new CashierLedger();
                                                                                                                                    data.amount = Number(
                                                                                                                                        amount
                                                                                                                                    );
                                                                                                                                    data.trans_type =
                                                                                                                                        "DR";
                                                                                                                                    data.cashier_id =
                                                                                                                                        cashier._id;
                                                                                                                                    data.save(function (
                                                                                                                                        err,
                                                                                                                                        c
                                                                                                                                    ) {
                                                                                                                                        res
                                                                                                                                            .status(200)
                                                                                                                                            .json({
                                                                                                                                                status: 1,
                                                                                                                                                message:
                                                                                                                                                    "Cashier claimed money",
                                                                                                                                            });
                                                                                                                                    });
                                                                                                                                } else {
                                                                                                                                    var amt =
                                                                                                                                        Number(c.amount) +
                                                                                                                                        Number(amount);
                                                                                                                                    CashierLedger.findByIdAndUpdate(
                                                                                                                                        c._id,
                                                                                                                                        { amount: amt },
                                                                                                                                        function (
                                                                                                                                            err,
                                                                                                                                            c
                                                                                                                                        ) {
                                                                                                                                            res
                                                                                                                                                .status(200)
                                                                                                                                                .json({
                                                                                                                                                    status: 1,
                                                                                                                                                    message:
                                                                                                                                                        "Cashier claimed money",
                                                                                                                                                });
                                                                                                                                        }
                                                                                                                                    );
                                                                                                                                }
                                                                                                                            }
                                                                                                                        );
                                                                                                                    }
                                                                                                                }
                                                                                                            );
                                                                                                        } else {
                                                                                                            console.log(result.toString());
                                                                                                            res.status(200).json(result);
                                                                                                        }
                                                                                                    });
                                                                                            }
                                                                                        });
                                                                                    }
                                                                                });
                                                                            }
                                                                        }); //save
                                                                    }
                                                                });

                                                            }
                                                        }
                                                    );
                                                }
                                            }
                                        ); //branch
                                    }
                                }
                            );
                        }
                    });
            }
        }
    );
});

router.post("/cashier/interBank/SendMoneyToNonWallet", function (req, res) {
    var today = new Date();
    today = today.toISOString();
    var s = today.split("T");
    var start = s[0] + "T00:00:00.000Z";
    var end = s[0] + "T23:59:59.999Z";

    const {
        token,
        givenname,
        familyname,
        note,
        senderIdentificationCountry,
        senderIdentificationType,
        senderIdentificationNumber,
        senderIdentificationValidTill,
        address1,
        state,
        zip,
        ccode,
        country,
        email,
        mobile,
        withoutID,
        requireOTP,
        receiverMobile,
        receiverccode,
        receiverGivenName,
        receiverFamilyName,
        receiverCountry,
        receiverEmail,
        receiverIdentificationCountry,
        receiverIdentificationType,
        receiverIdentificationNumber,
        receiverIdentificationValidTill,
        receiverIdentificationAmount,
        isInclusive,
    } = req.body;

    const transactionCode = makeid(8);

    Cashier.findOne(
        {
            token,
            status: 1,
        },
        function (err, cashier) {
            if (err) {
                console.log(err);
                var message = err;
                if (err.message) {
                    message = err.message;
                }
                res.status(200).json({
                    status: 0,
                    message: message,
                });
            } else if (cashier == null) {
                res.status(200).json({
                    status: 0,
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                Branch.findOne(
                    {
                        _id: cashier.branch_id,
                    },
                    function (err, branch) {
                        if (err) {
                            console.log(err);
                            var message = err;
                            if (err.message) {
                                message = err.message;
                            }
                            res.status(200).json({
                                status: 0,
                                message: message,
                            });
                        } else if (branch == null) {
                            res.status(200).json({
                                status: 0,
                                message: "Branch Not Found",
                            });
                        } else {
                            Bank.findOne(
                                {
                                    _id: cashier.bank_id,
                                },
                                function (err, bank) {
                                    if (err) {
                                        console.log(err);
                                        var message = err;
                                        if (err.message) {
                                            message = err.message;
                                        }
                                        res.status(200).json({
                                            status: 0,
                                            message: message,
                                        });
                                    } else if (bank == null) {
                                        res.status(200).json({
                                            status: 0,
                                            message: "Bank Not Found",
                                        });
                                    } else {
                                        Infra.findOne(
                                            {
                                                _id: bank.user_id,
                                            },
                                            function (err, infra) {
                                                if (err) {
                                                    console.log(err);
                                                    var message = err;
                                                    if (err.message) {
                                                        message = err.message;
                                                    }
                                                    res.status(200).json({
                                                        status: 0,
                                                        message: message,
                                                    });
                                                } else if (infra == null) {
                                                    res.status(200).json({
                                                        status: 0,
                                                        message: "Infra Not Found",
                                                    });
                                                } else {
                                                    let data = new CashierSend();
                                                    data.is_inter_bank = 1;
                                                    data.inter_bank_rule_type = 0;
                                                    let temp = {
                                                        ccode: ccode,
                                                        mobile: mobile,
                                                        givenname: givenname,
                                                        familyname: familyname,
                                                        address1: address1,
                                                        state: state,
                                                        zip: zip,
                                                        country: country,
                                                        email: email,
                                                        note: note,
                                                    };
                                                    data.sender_info = JSON.stringify(temp);
                                                    temp = {
                                                        country: senderIdentificationCountry,
                                                        type: senderIdentificationType,
                                                        number: senderIdentificationNumber,
                                                        valid: senderIdentificationValidTill,
                                                    };
                                                    data.sender_id = JSON.stringify(temp);
                                                    data.sending_bank_id = bank._id;
                                                    temp = {
                                                        mobile: receiverMobile,
                                                        ccode: receiverccode,
                                                        givenname: receiverGivenName,
                                                        familyname: receiverFamilyName,
                                                        country: receiverCountry,
                                                        email: receiverEmail,
                                                    };
                                                    data.receiver_info = JSON.stringify(temp);
                                                    temp = {
                                                        country: receiverIdentificationCountry,
                                                        type: receiverIdentificationType,
                                                        number: receiverIdentificationNumber,
                                                        valid: receiverIdentificationValidTill,
                                                    };
                                                    data.receiver_id = JSON.stringify(temp);
                                                    data.amount = receiverIdentificationAmount;
                                                    data.is_inclusive = isInclusive;
                                                    data.cashier_id = cashier._id;
                                                    data.transaction_code = transactionCode;
                                                    data.rule_type = "Non Wallet to Non Wallet";
                                                    data.without_id = withoutID ? 1 : 0;
                                                    if (requireOTP) {
                                                        data.require_otp = 1;
                                                        data.otp = makeotp(6);
                                                        content =
                                                            data.otp + " - Send this OTP to the Receiver";
                                                        if (mobile && mobile != null) {
                                                            sendSMS(content, mobile);
                                                        }
                                                        if (email && email != null) {
                                                            sendMail(content, "Transaction OTP", email);
                                                        }
                                                    }

                                                    data.save((err, cs) => {
                                                        if (err) {
                                                            console.log(err);
                                                            var message = err;
                                                            if (err.message) {
                                                                message = err.message;
                                                            }
                                                            res.status(200).json({
                                                                status: 0,
                                                                message: message,
                                                            });
                                                        } else {
                                                            const find = {
                                                                bank_id: bank._id,
                                                                type: 0,
                                                                status: 1,
                                                                active: 1,
                                                            };
                                                            const amount = receiverIdentificationAmount;
                                                            InterBankRule.findOne(find, function (err, rule1) {
                                                                if (err) {
                                                                    console.log(err);
                                                                    var message = err;
                                                                    if (err.message) {
                                                                        message = err.message;
                                                                    }
                                                                    res.status(200).json({
                                                                        status: 0,
                                                                        message: message,
                                                                    });
                                                                } else if (rule1 == null) {
                                                                    res.status(200).json({
                                                                        status: 0,
                                                                        message: "Inter bank fee Rule Not Found",
                                                                    });
                                                                } else {
                                                                    const find = {
                                                                        bank_id: bank._id,
                                                                        trans_type: "Non Wallet to Non Wallet",
                                                                        status: 1,
                                                                        active: "Active",
                                                                    };
                                                                    Fee.findOne(find, function (err, rule2) {
                                                                        if (err) {
                                                                            console.log(err);
                                                                            var message = err;
                                                                            if (err.message) {
                                                                                message = err.message;
                                                                            }
                                                                            res.status(200).json({
                                                                                status: 0,
                                                                                message: message,
                                                                            });
                                                                        } else if (rule2 == null) {
                                                                            res.status(200).json({
                                                                                status: 0,
                                                                                message: "Revenue Rule Not Found",
                                                                            });
                                                                        } else {
                                                                            interBankSendMoneyToNonWallet(amount, infra, bank, branch, rule1, rule2, isInclusive, cashier._id)
                                                                                .then(function (result) {
                                                                                    if (result.status == 1) {
                                                                                        let content =
                                                                                            "Your Transaction Code is " +
                                                                                            transactionCode;
                                                                                        if (
                                                                                            receiverMobile &&
                                                                                            receiverMobile != null
                                                                                        ) {
                                                                                            sendSMS(
                                                                                                content,
                                                                                                receiverMobile
                                                                                            );
                                                                                        }
                                                                                        if (
                                                                                            receiverEmail &&
                                                                                            receiverEmail != null
                                                                                        ) {
                                                                                            sendMail(
                                                                                                content,
                                                                                                "Transaction Code",
                                                                                                receiverEmail
                                                                                            );
                                                                                        }

                                                                                        CashierSend.findByIdAndUpdate(
                                                                                            cs._id,
                                                                                            {
                                                                                                status: 1,
                                                                                                fee: result.fee,
                                                                                                master_code: result.master_code
                                                                                            },
                                                                                            (err) => {
                                                                                                if (err) {
                                                                                                    console.log(err);
                                                                                                    var message = err;
                                                                                                    if (err.message) {
                                                                                                        message = err.message;
                                                                                                    }
                                                                                                    res.status(200).json({
                                                                                                        status: 0,
                                                                                                        message: message,
                                                                                                    });
                                                                                                } else {
                                                                                                    Cashier.findByIdAndUpdate(
                                                                                                        cashier._id,
                                                                                                        {
                                                                                                            cash_received:
                                                                                                                Number(
                                                                                                                    cashier.cash_received
                                                                                                                ) +
                                                                                                                Number(result.amount) +
                                                                                                                Number(result.fee),
                                                                                                            cash_in_hand:
                                                                                                                Number(
                                                                                                                    cashier.cash_in_hand
                                                                                                                ) +
                                                                                                                Number(result.amount) +
                                                                                                                Number(result.fee),
                                                                                                            fee_generated:
                                                                                                                Number(result.sendFee) +
                                                                                                                Number(
                                                                                                                    cashier.fee_generated
                                                                                                                ),

                                                                                                            total_trans:
                                                                                                                Number(
                                                                                                                    cashier.total_trans
                                                                                                                ) + 1,
                                                                                                        },
                                                                                                        function (e, v) { }
                                                                                                    );
                                                                                                }

                                                                                                CashierLedger.findOne(
                                                                                                    {
                                                                                                        cashier_id: cashier._id,
                                                                                                        trans_type: "CR",
                                                                                                        created_at: {
                                                                                                            $gte: new Date(
                                                                                                                start
                                                                                                            ),
                                                                                                            $lte: new Date(end),
                                                                                                        },
                                                                                                    },
                                                                                                    function (err, c) {
                                                                                                        if (
                                                                                                            err ||
                                                                                                            c == null
                                                                                                        ) {
                                                                                                            let data = new CashierLedger();
                                                                                                            data.amount =
                                                                                                                Number(result.amount) +
                                                                                                                Number(result.fee);
                                                                                                            data.trans_type =
                                                                                                                "CR";
                                                                                                            data.transaction_details = JSON.stringify(
                                                                                                                {
                                                                                                                    fee: result.fee,
                                                                                                                }
                                                                                                            );
                                                                                                            data.cashier_id =
                                                                                                                cashier._id;
                                                                                                            data.save(function (
                                                                                                                err,
                                                                                                                c
                                                                                                            ) { });
                                                                                                        } else {
                                                                                                            var amt =
                                                                                                                Number(c.amount) +
                                                                                                                Number(result.amount) +
                                                                                                                Number(result.fee);
                                                                                                            CashierLedger.findByIdAndUpdate(
                                                                                                                c._id,
                                                                                                                { amount: amt },
                                                                                                                function (
                                                                                                                    err,
                                                                                                                    c
                                                                                                                ) { }
                                                                                                            );
                                                                                                        }
                                                                                                    }
                                                                                                );
                                                                                                res.status(200).json({
                                                                                                    status: 1,
                                                                                                    message: "success",
                                                                                                });
                                                                                            }
                                                                                        );
                                                                                    } else {
                                                                                        res.status(200).json(result);
                                                                                    }
                                                                                });


                                                                        }
                                                                    });
                                                                }
                                                            });
                                                        }
                                                    });
                                                } //infra
                                            }
                                        );
                                    }
                                }
                            );
                        }
                    }
                ); //branch
            }
        }
    );
});


router.post("/partnerCashier/interBank/checkNWNWFee", JWTTokenAuth, function (req, res) {
    const { amount } = req.body;
    const jwtusername = req.sign_creds.username;
    PartnerCashier.findOne(
        {
            username: jwtusername,
            status: 1,
        },
        function (err, cashier) {
            if (err) {
                console.log(err);
                var message = err;
                if (err.message) {
                    message = err.message;
                }
                res.status(200).json({
                    status: 0,
                    message: message,
                });
            } else if (cashier == null) {
                return res.status(200).json({
                    status: 0,
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                const find = {
                    bank_id: cashier.bank_id,
                    type: 0,
                    status: 1,
                    active: 1,
                };
                InterBankRule.findOne(find, function (err, rule) {
                    if (err) {
                        console.log(err);
                        var message = err;
                        if (err.message) {
                            message = err.message;
                        }
                        res.status(200).json({
                            status: 0,
                            message: message,
                        });
                    } else if (rule == null) {
                        return res.status(200).json({
                            status: 0,
                            message: "Transaction cannot be done at this time",
                        });
                    } else {
                        var amnt = Number(amount);
                        var fee = 0;
                        var range_found = false;
                        rule.ranges.map((range) => {
                            if (amnt >= range.trans_from && amnt <= range.trans_to) {
                                range_found = true;
                                fee = (amnt * range.percentage) / 100;
                                fee = fee + range.fixed;
                            }
                        });
                        if (range_found) {
                            res.status(200).json({
                                status: 1,
                                message: "Inter Bank Non Wallet to Non Wallet Fee",
                                fee: fee,
                            });
                        } else {
                            res.status(200).json({
                                status: 1,
                                message: "The amount is not within any range",
                            });
                        }
                    }
                }
                );
            }
        }
    );
})

router.post("/cashier/interBank/checkNWNWFee", function (req, res) {
    const { token, amount } = req.body;
    Cashier.findOne(
        {
            token,
            status: 1,
        },
        function (err, cashier) {
            if (err) {
                console.log(err);
                var message = err;
                if (err.message) {
                    message = err.message;
                }
                res.status(200).json({
                    status: 0,
                    message: message,
                });
            } else if (cashier == null) {
                return res.status(200).json({
                    status: 0,
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                const find = {
                    bank_id: cashier.bank_id,
                    type: 0,
                    status: 1,
                    active: 1,
                };
                InterBankRule.findOne(find, function (err, rule) {
                    if (err) {
                        console.log(err);
                        var message = err;
                        if (err.message) {
                            message = err.message;
                        }
                        res.status(200).json({
                            status: 0,
                            message: message,
                        });
                    } else if (rule == null) {
                        return res.status(200).json({
                            status: 0,
                            message: "Transaction cannot be done at this time",
                        });
                    } else {
                        var amnt = Number(amount);
                        var fee = 0;
                        var range_found = false;
                        rule.ranges.map((range) => {
                            if (amnt >= range.trans_from && amnt <= range.trans_to) {
                                range_found = true;
                                fee = (amnt * range.percentage) / 100;
                                fee = fee + range.fixed;
                            }
                        });
                        if (range_found) {
                            res.status(200).json({
                                status: 1,
                                message: "Inter Bank Non Wallet to Non Wallet Fee",
                                fee: fee,
                            });
                        } else {
                            res.status(200).json({
                                status: 1,
                                message: "The amount is not within any range",
                            });
                        }
                    }

                }
                );
            }
        }
    );
})

router.post("/bank/interBank/getRules", function (req, res) {
    const { token } = req.body;
    Bank.findOne(
        {
            token,
            status: 1,
        },
        function (err, bank) {
            if (err) {
                console.log(err);
                var message = err;
                if (err.message) {
                    message = err.message;
                }
                res.status(200).json({
                    status: 0,
                    message: message,
                });
            } else if (bank == null) {
                res.status(200).json({
                    status: 0,
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                InterBankRule.find({ bank_id: bank._id }, (err, rules) => {
                    if (err) {
                        console.log(err);
                        var message = err;
                        if (err.message) {
                            message = err.message;
                        }
                        res.status(200).json({
                            status: 0,
                            message: message,
                        });
                    } else {
                        res.status(200).json({
                            status: 1,
                            message: "Inter Bank Rules",
                            rules: rules,
                        });
                    }
                });
            }
        }
    );
});

router.post("/infra/interBank/getRules", function (req, res) {
    const { token, bank_id } = req.body;
    Infra.findOne(
        {
            token,
            status: 1,
        },
        function (err, infra) {
            if (err) {
                console.log(err);
                var message = err;
                if (err.message) {
                    message = err.message;
                }
                res.status(200).json({
                    status: 0,
                    message: message,
                });
            } else if (infra == null) {
                res.status(200).json({
                    status: 0,
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                InterBankRule.find(
                    {
                        bank_id: bank_id
                    },
                    async (err, rules) => {
                        if (err) {
                            console.log(err);
                            var message = err;
                            if (err.message) {
                                message = err.message;
                            }
                            res.status(200).json({
                                status: 0,
                                message: message,
                            });
                        } else {
                            rules = rules.map((rule) => {
                                if (rule.edit_status == 0) {
                                    rule["edited"] = undefined;
                                }
                                return rule;
                            });
                            res.status(200).json({
                                status: 1,
                                message: "Inter Bank Fee Rule",
                                rules: rules,
                            });
                        }
                    }
                );
            }
        }
    );
});

router.post("/infra/interBank/declineRule", function (req, res) {
    const { token, rule_id } = req.body;
    Infra.findOne(
        {
            token,
            status: 1,
        },
        function (err, infra) {
            if (err) {
                console.log(err);
                var message = err;
                if (err.message) {
                    message = err.message;
                }
                res.status(200).json({
                    status: 0,
                    message: message,
                });
            } else if (infra == null) {
                res.status(200).json({
                    status: 0,
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                InterBankRule.findOne(
                    {
                        _id: rule_id,
                    },
                    async (err, rule) => {
                        if (err) {
                            console.log(err);
                            var message = err;
                            if (err.message) {
                                message = err.message;
                            }
                            res.status(200).json({
                                status: 0,
                                message: message,
                            });
                        } else if (rule == null) {
                            res.status(200).json({
                                status: 0,
                                message: "Rule not found.",
                            });
                        } else {
                            try {
                                var bank = Bank.findOne({ _id: rule.bank_id })
                                if (!bank) {
                                    throw new Error("Bank not found");
                                }
                                if (rule.edit_status == 1) {
                                    InterBankRule.updateOne(
                                        {
                                            _id: rule._id,
                                        },
                                        {
                                            $set: {
                                                "edited.status": -1,
                                            },
                                        }
                                    );
                                } else {
                                    InterBankRule.updateOne(
                                        {
                                            _id: rule_id,
                                        },
                                        {
                                            $set: {
                                                status: -1,
                                            },
                                        }
                                    );
                                }
                            } catch (err) {
                                console.log(err);
                                var message = err.toString();
                                if (err.message) {
                                    message = err.message;
                                }
                                res.status(200).json({ status: 0, message: message });
                            }
                            var content =
                                "Infra has declined the fee rule " +
                                rule.name +
                                "in Ewallet Application";
                            sendMail(content, "Fee rule approved by Infra", bank.email);
                            content =
                                "Ewallet: Infra has declined the fee rule " + rule.name;
                            sendSMS(content, bank.mobile);
                            res.status(200).json({
                                status: 1,
                                message: "Declined",
                            });
                        }
                    }
                );
            }
        }
    );
});

router.post("/infra/interBank/approveRule", function (req, res) {
    const { token, rule_id } = req.body;
    Infra.findOne(
        {
            token,
            status: 1,
        },
        function (err, infra) {
            if (err) {
                console.log(err);
                var message = err;
                if (err.message) {
                    message = err.message;
                }
                res.status(200).json({
                    status: 0,
                    message: message,
                });
            } else if (infra == null) {
                res.status(200).json({
                    status: 0,
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                InterBankRule.findOne(
                    {
                        _id: rule_id,
                    },
                    async (err, rule) => {
                        if (err) {
                            console.log(err);
                            var message = err;
                            if (err.message) {
                                message = err.message;
                            }
                            res.status(200).json({
                                status: 0,
                                message: message,
                            });
                        } else if (rule == null) {
                            res.status(200).json({
                                status: 0,
                                message: "Rule not found.",
                            });
                        } else {
                            try {
                                var bank = Bank.findOne({ _id: rule.bank_id })
                                if (!bank) {
                                    throw new Error("Bank not found");
                                }
                                if (rule.edit_status == 1) {
                                    await InterBankRule.updateOne({ _id: rule._id }, {
                                        $set: {
                                            name: rule.edited.name,
                                            active: rule.edited.active,
                                            ranges: rule.edited.ranges,
                                            edit_status: 0,
                                            infra_share: rule.edited.infra_share,
                                            other_bank_share: rule.edited.other_bank_share
                                        },
                                        $unset: {
                                            edited: {}
                                        }
                                    });
                                } else {
                                    await InterBankRule.updateOne({ _id: rule._id }, {
                                        status: 1
                                    })
                                }
                            } catch (err) {
                                console.log(err);
                                var message = err.toString();
                                if (err.message) {
                                    message = err.message;
                                }
                                res.status(200).json({ status: 0, message: message });
                            }
                            var content =
                                "Infra has approved the fee rule " +
                                rule.name +
                                "in Ewallet Application";
                            sendMail(content, "Fee rule approved by Infra", bank.email);
                            content =
                                "Ewallet: Infra has approved the fee rule " + rule.name;
                            sendSMS(content, bank.mobile);
                            res.status(200).json({
                                status: 1,
                                message: "Approved",
                            });
                        }
                    }
                );

            }
        }
    );
});

router.post("/bank/interBank/editRuleShares", function (req, res) {
    const { token, rule_id, infra_share, other_bank_share } = req.body;
    Bank.findOne(
        {
            token,
            status: 1,
        },
        function (err, bank) {
            if (err) {
                console.log(err);
                var message = err;
                if (err.message) {
                    message = err.message;
                }
                res.status(200).json({
                    status: 0,
                    message: message,
                });
            } else if (bank == null) {
                res.status(200).json({
                    status: 0,
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                InterBankRule.findOne(
                    {
                        _id: rule_id,
                    },
                    async (err, rule) => {
                        if (err) {
                            console.log(err);
                            var message = err;
                            if (err.message) {
                                message = err.message;
                            }
                            res.status(200).json({
                                status: 0,
                                message: message,
                            });
                        } else if (rule == null) {
                            res.status(200).json({
                                status: 0,
                                message: "This rule is not allowed to edit.",
                            });
                        } else {
                            try {
                                if (rule.status == 0) {
                                    rule = await InterBankRule.findOneAndUpdate(
                                        {
                                            _id: rule._id,
                                        },
                                        {
                                            $set: {
                                                infra_share: infra_share,
                                                other_bank_share: other_bank_share
                                            },
                                        }, { new: true })
                                } else if (rule.rule_edit_status == 1) {
                                    rule = await InterBankRule.findOneAndUpdate(
                                        {
                                            _id: rule._id,
                                        },
                                        {
                                            $set: {
                                                "edited.infra_share": infra_share,
                                                "edited.other_bank_share": other_bank_share,
                                            },
                                        }, { new: true });
                                } else {
                                    rule = await InterBankRule.findOneAndUpdate(
                                        {
                                            _id: rule._id,
                                        },
                                        {
                                            $set: {
                                                "edited.status": 0,
                                                "edited.active": rule.active,
                                                "edited.name": rule.name,
                                                "edited.ranges": rule.ranges,
                                                "edited.infra_share": infra_share,
                                                "edited.other_bank_share": other_bank_share,
                                                edit_status: 1
                                            },
                                        }, { new: true });
                                }
                                res.status(200).json({
                                    status: 1,
                                    message: "Edited shares in " + rule.name + " transactions fee rule",
                                    rule: rule,
                                });
                            } catch (err) {
                                console.log(err);
                                var message = err.toString();
                                if (err && err.message) {
                                    message = err.message;
                                }
                                res.status(200).json({ status: 0, message: message, err: err });
                            }
                        }
                    }
                );
            }
        }
    );
});

router.post("/bank/interBank/editRule", function (req, res) {
    const { token, rule_id, name, active, description, ranges } = req.body;
    Bank.findOne(
        {
            token,
            status: 1,
        },
        function (err, bank) {
            if (err) {
                console.log(err);
                var message = err;
                if (err.message) {
                    message = err.message;
                }
                res.status(200).json({
                    status: 0,
                    message: message,
                });
            } else if (bank == null) {
                res.status(200).json({
                    status: 0,
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                InterBankRule.findOne(
                    {
                        _id: rule_id,
                    },
                    async (err, rule) => {
                        if (err) {
                            console.log(err);
                            var message = err;
                            if (err.message) {
                                message = err.message;
                            }
                            res.status(200).json({
                                status: 0,
                                message: message,
                            });
                        } else if (rule == null) {
                            res.status(200).json({
                                status: 0,
                                message: "Rule not found.",
                            });
                        } else {
                            try {
                                if (rule.status == 0) {
                                    rule = await InterBankRule.findOneAndUpdate(
                                        {
                                            _id: rule._id,
                                        },
                                        {
                                            $set: {
                                                name: name,
                                                active: active,
                                                ranges: ranges,
                                                description: description,
                                            },
                                        }, { new: true })
                                } else {
                                    rule = await InterBankRule.findOneAndUpdate(
                                        {
                                            _id: rule._id,
                                        },
                                        {
                                            $set: {
                                                edit_status: 1,
                                                "edited.name": name,
                                                "edited.active": active,
                                                "edited.ranges": ranges,
                                                "edited.description": description,
                                                "edited.infra_share": rule.infra_share,
                                                "edited.other_bank_share": rule.other_bank_share,
                                                "edited.status": 0
                                            },
                                        }, { new: true });
                                }
                            } catch (err) {
                                console.log(err);
                                var message = err.toString();
                                if (err && err.message) {
                                    message = err.message;
                                }
                                res.status(200).json({ status: 0, message: message, err: err });
                            }
                            let content =
                                "<p>Fee Rule for " + rule.name + " transactions is edited for your bank in E-Wallet application</p><p>&nbsp;</p>";
                            sendMail(content, "Fee Rule Edited", bank.email);
                            let content2 =
                                " E-Wallet: Fee Rule for " + rule.name + " transactions is edited"
                            sendSMS(content2, bank.mobile);

                            res.status(200).json({
                                status: 1,
                                message: "Fee Rule edited successfully",
                                rule: rule,
                            });

                        }
                    }
                );
            }
        }
    );
});

router.post("/bank/interBank/createRule", function (req, res) {
    const {
        token,
        name,
        active,
        type,
        ranges,
        description,
    } = req.body;
    Bank.findOne(
        {
            token,
            status: 1,
        },
        function (err, bank) {
            if (err) {
                console.log(err);
                var message = err;
                if (err.message) {
                    message = err.message;
                }
                res.status(200).json({
                    status: 0,
                    message: message,
                });
            } else if (bank == null) {
                res.status(200).json({
                    status: 0,
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                InterBankRule.findOne({ bank_id: bank._id, type }, (err, rule) => {
                    if (err) {
                        console.log(err);
                        var message = err;
                        if (err.message) {
                            message = err.message;
                        }
                        res.status(200).json({
                            status: 0,
                            message: message,
                        });
                    } else if (rule != null) {
                        res.status(200).json({
                            status: 0,
                            message: "Fee Rule already exist.",
                        });
                    } else {
                        let interBankRule = new InterBankRule();
                        interBankRule.name = name;
                        interBankRule.bank_id = bank._id;
                        interBankRule.active = active;
                        interBankRule.type = type;
                        interBankRule.description = description;
                        ranges.forEach((range) => {
                            var { trans_from, trans_to, fixed, percentage } = range;
                            interBankRule.ranges.push({
                                trans_from: trans_from,
                                trans_to: trans_to,
                                fixed: fixed,
                                percentage: percentage,
                            });
                        });
                        interBankRule.save((err) => {
                            if (err) {
                                console.log(err);
                                var message = err;
                                if (err.message) {
                                    message = err.message;
                                }
                                res.status(200).json({
                                    status: 0,
                                    message: message,
                                });
                            } else {
                                let content =
                                    "<p>An Inter Bank fee rule for " + name + " transactions is added in E-Wallet application</p><p>&nbsp;</p>";
                                sendMail(content, "New Fee Rule Added", bank.email);
                                let content2 =
                                    " E-Wallet: An Inter Bank fee rule for " + name + " transactions is added"
                                sendSMS(content2, bank.mobile);

                                res.status(200).json({
                                    status: 1,
                                    message: "Inter Bank Rule for " + name + " created successfully",
                                    rule: interBankRule,
                                });
                            }
                        });
                    }
                });
            }
        }
    );
});

router.post("/bank/interBank/addRuleShares", function (req, res) {
    const { token, rule_id, infra_share, other_bank_share } = req.body;
    Bank.findOne(
        {
            token,
            status: 1,
        },
        function (err, bank) {
            if (err) {
                console.log(err);
                var message = err;
                if (err.message) {
                    message = err.message;
                }
                res.status(200).json({
                    status: 0,
                    message: message,
                });
            } else if (bank == null) {
                res.status(200).json({
                    status: 0,
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                InterBankRule.findOneAndUpdate(
                    {
                        _id: rule_id,
                        status: 0
                    },
                    {
                        infra_share: infra_share,
                        other_bank_share: other_bank_share,
                        sharing_added: 1,
                    },
                    { new: true },
                    (err, rule) => {
                        if (err) {
                            console.log(err);
                            var message = err;
                            if (err.message) {
                                message = err.message;
                            }
                            res.status(200).json({
                                status: 0,
                                message: message,
                            });
                        } else if (rule == null) {
                            res.status(200).json({
                                status: 0,
                                message: "Infra share can not be added.",
                            });
                        } else {
                            res.status(200).json({
                                status: 1,
                                message:
                                    "Inter Bank " + rule.name + " Rule successfully updated with infra share",
                                rule: rule,
                            });
                        }
                    }
                );
            }
        }
    );
});

module.exports = router;