const express = require("express");
const router = express.Router();

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const makeid = require("./utils/idGenerator");
const makeotp = require("./utils/makeotp");
const interBankSendMoneyToNonWallet = require("./transactions/interBank/sendMoneyToNonWallet");
const interBankSendMoneyToNWByUser = require("./transactions/interBank/sendMoneyToNWByUser");
const interBankSendMoneyToNWByPartner = require("./transactions/interBank/sendMoneyToNWByPartner");
const interBankClaimMoney = require("./transactions/interBank/claimMoney");
const interBankClaimByPartner = require("./transactions/interBank/claimMoneyByPartner");
const interBankSendMoneyToWallet = require("./transactions/interBank/sendMoneyToWallet");
const interBankSendMoneyToWByUser = require("./transactions/interBank/sendMoneyToWalletByUser");
const interBankSendMoneyToWByPartner = require("./transactions/interBank/sendMoneyToWByPartner");

const Bank = require("../models/Bank");
const Branch = require("../models/Branch")
const Cashier = require("../models/Cashier");
const CashierSend = require("../models/CashierSend");
const CashierPending = require("../models/CashierPending");
const CashierClaim = require("../models/CashierClaim");
const CashierLedger = require("../models/CashierLedger");
const CashierTransfer = require("../models/CashierTransfer");
const Partner = require("../models/partner/Partner");
const PartnerCashier = require("../models/partner/Cashier");
const PartnerBranch = require("../models/partner/Branch");
const Infra = require("../models/Infra");
const InterBankRule = require("../models/InterBankRule");
const Fee = require("../models/Fee");
const User = require("../models/User");
const NWUser = require("../models/NonWalletUsers");

const JWTTokenAuth = require("./JWTTokenAuth");

router.post("/user/interBank/checkFee", JWTTokenAuth, function (req, res) {
    const { type, amount } = req.body;
    const jwtusername = req.sign_creds.username;
    if (type == "IBWNW" || type == "IBWW") {
        User.findOne(
            {
                username: jwtusername,
                status: 1,
            },
            function (err, user) {
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
                } else if (user == null) {
                    return res.status(200).json({
                        status: 0,
                        message:
                            "Token changed or user not valid. Try to login again or contact system administrator.",
                    });
                } else {
                    Bank.findOne({ name: user.bank }, (err, bank) => {
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
                            return res.status(200).json({
                                status: 0,
                                message: "Bank not found"
                            });
                        } else {
                            const find = {
                                bank_id: bank._id,
                                type: type,
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
                                            message: "Inter Bank " + rule.name + " Fee",
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
                    })
                }
            }
        );
    } else {
        res.status(200).json({
            status: 0,
            message: "Invalid rule type"
        });
    }
})

router.post("/user/interBank/sendMoneyToWallet", JWTTokenAuth, async function (req, res) {
    const username = req.sign_creds.username;

    const { receiverMobile, note, sending_amount, isInclusive } = req.body;

    try {
        const sender = await User.findOneAndUpdate(
            {
                username,
                status: 1,
            },
            {
                $addToSet: {
                    contact_list: receiverMobile,
                },
            });
        if (sender == null) {
            throw new Error(
                "Token changed or user not valid. Try to login again or contact system administrator.");
        }

        const receiver = await User.findOne(
            {
                mobile: receiverMobile,
            });
        if (receiver == null) {
            throw new Error("Receiver's wallet do not exist");
        }

        const bank = await Bank.findOne(
            {
                name: sender.bank,
            });
        if (bank == null) {
            throw new Error("Bank Not Found");
        }

        const receiverBank = await Bank.findOne({ name: receiver.bank });
        if (receiver.bank == null) {
            throw new Error("Receiver Bank Not Found");
        }

        const infra = await Infra.findOne(
            {
                _id: bank.user_id,
            });
        if (infra == null) {
            throw new Error("Infra Not Found");
        }
        const find = {
            bank_id: bank._id,
            type: "IBWW",
            status: 1,
            active: 1
        };
        const rule1 = await InterBankRule.findOne(find)
        if (rule1 == null) {
            throw new Error("Inter Bank Rule Not Found");
        }

        const transfer = {
            amount: sending_amount,
            isInclusive: isInclusive,
            note: note,
        }
        const result = await interBankSendMoneyToWByUser(transfer,
            infra,
            bank,
            receiverBank,
            sender,
            receiver,
            rule1)
        console.log("Result: " + result);
        if (result.status == 1) {
            res.status(200).json({
                status: 1,
                message:
                    sending_amount +
                    " XOF is transferred to " +
                    receiver.name,
                balance: result.balance - (result.amount + result.fee),
            });
        } else {
            res.status(200).json({
                status: 0,
                message: result.toString(),
            });
        }
    } catch (err) {
        console.log(err);
        var message = err.toString();
        if (err && err.message) {
            message = err.message;
        }
        res.status(200).json({
            status: 0,
            message: message,
        });

    }
});

router.post("/partnerCashier/interBank/sendMoneyToWallet", JWTTokenAuth, function (req, res) {
    var today = new Date();
    today = today.toISOString();
    var s = today.split("T");
    var start = s[0] + "T00:00:00.000Z";
    var end = s[0] + "T23:59:59.999Z";

    const jwtusername = req.sign_creds.username;
    const {
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
        requireOTP,
        receiverMobile,
        receiverIdentificationAmount,
        isInclusive,
    } = req.body;

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
                res.status(200).json({
                    status: 0,
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                Partner.findOne(
                    { _id: cashier.partner_id },
                    (err, partner) => {
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
                        } else if (partner == null) {
                            res.status(200).json({
                                status: 0,
                                message: "Partner not found",
                            });
                        } else {

                            User.findOne(
                                {
                                    mobile: receiverMobile,
                                },
                                function (err, receiver) {
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
                                    } else if (receiver == null) {
                                        res.status(200).json({
                                            status: 0,
                                            message: "Receiver Not Found",
                                        });
                                    } else {
                                        Bank.findOne({ name: receiver.bank }, (err, receiverBank) => {
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
                                            } else if (receiverBank == null) {
                                                res.status(200).json({
                                                    status: 0,
                                                    message: "Receiver Bank Not Found",
                                                });
                                            } else {
                                                PartnerBranch.findOne(
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
                                                                                    temp = {
                                                                                        mobile: receiverMobile,
                                                                                    };
                                                                                    data.receiver_info = JSON.stringify(temp);
                                                                                    data.amount = receiverIdentificationAmount;
                                                                                    data.is_inclusive = isInclusive;
                                                                                    data.cashier_id = cashier._id;
                                                                                    data.rule_type = "Non Wallet to Wallet";
                                                                                    data.is_inter_bank = 1;
                                                                                    data.inter_bank_rule_type = "IBNWW";

                                                                                    //send transaction sms after actual transaction

                                                                                    if (requireOTP) {
                                                                                        data.require_otp = 1;
                                                                                        data.otp = makeotp(6);
                                                                                        content =
                                                                                            data.otp +
                                                                                            " - Send this OTP to the Receiver";
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
                                                                                            var find = {
                                                                                                bank_id: bank._id,
                                                                                                type: "IBNWW",
                                                                                                status: 1,
                                                                                                active: 1
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
                                                                                                        message: "Inter Bank Revenue Rule Not Found",
                                                                                                    });
                                                                                                } else {
                                                                                                    find = {
                                                                                                        bank_id: bank._id,
                                                                                                        trans_type: "Non Wallet to Wallet",
                                                                                                        status: 1,
                                                                                                        active: "Active",
                                                                                                    };
                                                                                                    const amount = receiverIdentificationAmount;
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
                                                                                                            //End
                                                                                                            var transfer = {
                                                                                                                amount: amount,
                                                                                                                isInclusive: isInclusive,
                                                                                                                cashierId: cashier._id,
                                                                                                                partnerCode: partner.code
                                                                                                            }
                                                                                                            interBankSendMoneyToWByPartner(
                                                                                                                transfer,
                                                                                                                infra,
                                                                                                                bank,
                                                                                                                receiverBank,
                                                                                                                branch,
                                                                                                                receiver,
                                                                                                                rule1,
                                                                                                                rule2)
                                                                                                                .then(function (result) {
                                                                                                                    console.log(
                                                                                                                        "Result: " + result
                                                                                                                    );
                                                                                                                    if (result.status == 1) {
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
                                                                                                                                        message =
                                                                                                                                            err.message;
                                                                                                                                    }
                                                                                                                                    res
                                                                                                                                        .status(200)
                                                                                                                                        .json({
                                                                                                                                            status: 0,
                                                                                                                                            message: message,
                                                                                                                                        });
                                                                                                                                } else {
                                                                                                                                    PartnerCashier.findByIdAndUpdate(
                                                                                                                                        cashier._id,
                                                                                                                                        {
                                                                                                                                            cash_received:
                                                                                                                                                Number(
                                                                                                                                                    cashier.cash_received
                                                                                                                                                ) +
                                                                                                                                                Number(
                                                                                                                                                    result.amount
                                                                                                                                                ) +
                                                                                                                                                Number(result.fee),
                                                                                                                                            cash_in_hand:
                                                                                                                                                Number(
                                                                                                                                                    cashier.cash_in_hand
                                                                                                                                                ) +
                                                                                                                                                Number(
                                                                                                                                                    result.amount
                                                                                                                                                ) +
                                                                                                                                                Number(result.fee),
                                                                                                                                            fee_generated:
                                                                                                                                                Number(
                                                                                                                                                    result.sendFee
                                                                                                                                                ) +
                                                                                                                                                Number(
                                                                                                                                                    cashier.fee_generated
                                                                                                                                                ),

                                                                                                                                            total_trans:
                                                                                                                                                Number(
                                                                                                                                                    cashier.total_trans
                                                                                                                                                ) + 1,
                                                                                                                                        },
                                                                                                                                        function (
                                                                                                                                            e,
                                                                                                                                            v
                                                                                                                                        ) { }
                                                                                                                                    );

                                                                                                                                    CashierLedger.findOne(
                                                                                                                                        {
                                                                                                                                            cashier_id:
                                                                                                                                                cashier._id,
                                                                                                                                            trans_type:
                                                                                                                                                "CR",
                                                                                                                                            created_at: {
                                                                                                                                                $gte: new Date(
                                                                                                                                                    start
                                                                                                                                                ),
                                                                                                                                                $lte: new Date(
                                                                                                                                                    end
                                                                                                                                                ),
                                                                                                                                            },
                                                                                                                                        },
                                                                                                                                        function (
                                                                                                                                            err,
                                                                                                                                            c
                                                                                                                                        ) {
                                                                                                                                            if (
                                                                                                                                                err ||
                                                                                                                                                c == null
                                                                                                                                            ) {
                                                                                                                                                let data = new CashierLedger();
                                                                                                                                                data.amount =
                                                                                                                                                    Number(
                                                                                                                                                        result.amount
                                                                                                                                                    ) +
                                                                                                                                                    Number(
                                                                                                                                                        result.fee
                                                                                                                                                    );
                                                                                                                                                data.trans_type =
                                                                                                                                                    "CR";
                                                                                                                                                data.transaction_details = JSON.stringify(
                                                                                                                                                    {
                                                                                                                                                        fee: result.fee,
                                                                                                                                                    }
                                                                                                                                                );
                                                                                                                                                data.cashier_id = cashier._id;
                                                                                                                                                data.save(
                                                                                                                                                    function (
                                                                                                                                                        err,
                                                                                                                                                        c
                                                                                                                                                    ) { }
                                                                                                                                                );
                                                                                                                                            } else {
                                                                                                                                                var amt =
                                                                                                                                                    Number(
                                                                                                                                                        c.amount
                                                                                                                                                    ) +
                                                                                                                                                    Number(
                                                                                                                                                        result.amount
                                                                                                                                                    ) +
                                                                                                                                                    Number(
                                                                                                                                                        result.fee
                                                                                                                                                    );
                                                                                                                                                CashierLedger.findByIdAndUpdate(
                                                                                                                                                    c._id,
                                                                                                                                                    {
                                                                                                                                                        amount: amt,
                                                                                                                                                    },
                                                                                                                                                    function (
                                                                                                                                                        err,
                                                                                                                                                        c
                                                                                                                                                    ) { }
                                                                                                                                                );
                                                                                                                                            }
                                                                                                                                        }
                                                                                                                                    );
                                                                                                                                    res
                                                                                                                                        .status(200)
                                                                                                                                        .json({
                                                                                                                                            status: 1,
                                                                                                                                            message:
                                                                                                                                                receiverIdentificationAmount +
                                                                                                                                                "XOF amount is Transferred",
                                                                                                                                        });
                                                                                                                                }
                                                                                                                            }
                                                                                                                        );
                                                                                                                    } else {
                                                                                                                        res.status(200).json({
                                                                                                                            status: 0,
                                                                                                                            message: result.toString(),
                                                                                                                        });
                                                                                                                    }
                                                                                                                });
                                                                                                        }
                                                                                                    });
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
                                        })
                                    }
                                }
                            );
                        }
                    }
                )
            }
        }
    ); //branch
});

router.post("/cashier/interBank/sendMoneyToWallet", function (req, res) {
    var today = new Date();
    today = today.toISOString();
    var s = today.split("T");
    var start = s[0] + "T00:00:00.000Z";
    var end = s[0] + "T23:59:59.999Z";
    var now = new Date().getTime();

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
        requireOTP,
        receiverMobile,
        receiverIdentificationAmount,
        isInclusive,
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
                User.findOne(
                    {
                        mobile: receiverMobile,
                    },
                    function (err, receiver) {
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
                        } else if (receiver == null) {
                            res.status(200).json({
                                status: 0,
                                message: "Receiver Not Found",
                            });
                        } else {
                            Bank.findOne({ name: receiver.bank }, (err, receiverBank) => {
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
                                } else if (receiverBank == null) {
                                    res.status(200).json({
                                        status: 0,
                                        message: "Receiver Not Found",
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
                                                                        temp = {
                                                                            mobile: receiverMobile,
                                                                        };
                                                                        data.receiver_info = JSON.stringify(temp);
                                                                        data.amount = receiverIdentificationAmount;
                                                                        data.is_inclusive = isInclusive;
                                                                        data.cashier_id = cashier._id;
                                                                        data.rule_type = "Non Wallet to Wallet";
                                                                        data.is_inter_bank = 1;
                                                                        data.inter_bank_rule_type = "IBNWW";

                                                                        //send transaction sms after actual transaction

                                                                        if (requireOTP) {
                                                                            data.require_otp = 1;
                                                                            data.otp = makeotp(6);
                                                                            content =
                                                                                data.otp +
                                                                                " - Send this OTP to the Receiver";
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
                                                                                var find = {
                                                                                    bank_id: bank._id,
                                                                                    type: "IBNWW",
                                                                                    status: 1,
                                                                                    active: 1
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
                                                                                            message: "Inter Bank Revenue Rule Not Found",
                                                                                        });
                                                                                    } else {
                                                                                        find = {
                                                                                            bank_id: bank._id,
                                                                                            trans_type: "Non Wallet to Wallet",
                                                                                            status: 1,
                                                                                            active: "Active",
                                                                                        };
                                                                                        const amount = receiverIdentificationAmount;
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
                                                                                                //End
                                                                                                var transfer = {
                                                                                                    amount: amount,
                                                                                                    isInclusive: isInclusive,
                                                                                                    cashierId: cashier._id
                                                                                                }
                                                                                                interBankSendMoneyToWallet(transfer, infra, bank, receiverBank, branch, receiver, rule1, rule2)
                                                                                                    .then(function (result) {
                                                                                                        console.log(
                                                                                                            "Result: " + result
                                                                                                        );
                                                                                                        if (result.status == 1) {
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
                                                                                                                            message =
                                                                                                                                err.message;
                                                                                                                        }
                                                                                                                        res
                                                                                                                            .status(200)
                                                                                                                            .json({
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
                                                                                                                                    Number(
                                                                                                                                        result.amount
                                                                                                                                    ) +
                                                                                                                                    Number(result.fee),
                                                                                                                                cash_in_hand:
                                                                                                                                    Number(
                                                                                                                                        cashier.cash_in_hand
                                                                                                                                    ) +
                                                                                                                                    Number(
                                                                                                                                        result.amount
                                                                                                                                    ) +
                                                                                                                                    Number(result.fee),
                                                                                                                                fee_generated:
                                                                                                                                    Number(
                                                                                                                                        result.sendFee
                                                                                                                                    ) +
                                                                                                                                    Number(
                                                                                                                                        cashier.fee_generated
                                                                                                                                    ),

                                                                                                                                total_trans:
                                                                                                                                    Number(
                                                                                                                                        cashier.total_trans
                                                                                                                                    ) + 1,
                                                                                                                            },
                                                                                                                            function (
                                                                                                                                e,
                                                                                                                                v
                                                                                                                            ) { }
                                                                                                                        );

                                                                                                                        CashierLedger.findOne(
                                                                                                                            {
                                                                                                                                cashier_id:
                                                                                                                                    cashier._id,
                                                                                                                                trans_type:
                                                                                                                                    "CR",
                                                                                                                                created_at: {
                                                                                                                                    $gte: new Date(
                                                                                                                                        start
                                                                                                                                    ),
                                                                                                                                    $lte: new Date(
                                                                                                                                        end
                                                                                                                                    ),
                                                                                                                                },
                                                                                                                            },
                                                                                                                            function (
                                                                                                                                err,
                                                                                                                                c
                                                                                                                            ) {
                                                                                                                                if (
                                                                                                                                    err ||
                                                                                                                                    c == null
                                                                                                                                ) {
                                                                                                                                    let data = new CashierLedger();
                                                                                                                                    data.amount =
                                                                                                                                        Number(
                                                                                                                                            result.amount
                                                                                                                                        ) +
                                                                                                                                        Number(
                                                                                                                                            result.fee
                                                                                                                                        );
                                                                                                                                    data.trans_type =
                                                                                                                                        "CR";
                                                                                                                                    data.transaction_details = JSON.stringify(
                                                                                                                                        {
                                                                                                                                            fee: result.fee,
                                                                                                                                        }
                                                                                                                                    );
                                                                                                                                    data.cashier_id = cashier._id;
                                                                                                                                    data.save(
                                                                                                                                        function (
                                                                                                                                            err,
                                                                                                                                            c
                                                                                                                                        ) { }
                                                                                                                                    );
                                                                                                                                } else {
                                                                                                                                    var amt =
                                                                                                                                        Number(
                                                                                                                                            c.amount
                                                                                                                                        ) +
                                                                                                                                        Number(
                                                                                                                                            result.amount
                                                                                                                                        ) +
                                                                                                                                        Number(
                                                                                                                                            result.fee
                                                                                                                                        );
                                                                                                                                    CashierLedger.findByIdAndUpdate(
                                                                                                                                        c._id,
                                                                                                                                        {
                                                                                                                                            amount: amt,
                                                                                                                                        },
                                                                                                                                        function (
                                                                                                                                            err,
                                                                                                                                            c
                                                                                                                                        ) { }
                                                                                                                                    );
                                                                                                                                }
                                                                                                                            }
                                                                                                                        );
                                                                                                                        res
                                                                                                                            .status(200)
                                                                                                                            .json({
                                                                                                                                status: 1,
                                                                                                                                message:
                                                                                                                                    receiverIdentificationAmount +
                                                                                                                                    "XOF amount is Transferred",
                                                                                                                            });
                                                                                                                    }
                                                                                                                }
                                                                                                            );
                                                                                                        } else {
                                                                                                            res.status(200).json({
                                                                                                                status: 0,
                                                                                                                message: result.toString(),
                                                                                                            });
                                                                                                        }
                                                                                                    });
                                                                                            }
                                                                                        });
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
                            })
                        }
                    }
                );
            }
        }
    ); //branch
});

router.post("/user/interBank/sendMoneyToNonWallet", JWTTokenAuth, function (req, res) {
    var now = new Date().getTime();

    const username = req.sign_creds.username;

    const {
        note,
        withoutID,
        requireOTP,
        receiverMobile,
        receiverGivenName,
        receiverFamilyName,
        receiverCountry,
        receiverEmail,
        receiverIdentificationType,
        receiverIdentificationNumber,
        receiverIdentificationValidTill,
        sending_amount,
        isInclusive,
    } = req.body;

    User.findOneAndUpdate(
        {
            username,
            status: 1,
        },
        {
            $addToSet: {
                contact_list: receiverMobile,
            },
        },
        async function (err, sender) {
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
            } else if (sender == null) {
                res.status(200).json({
                    status: 0,
                    message: "Sender not found",
                });
            } else {
                receiver = {
                    name: receiverGivenName,
                    last_name: receiverFamilyName,
                    mobile: receiverMobile,
                    email: receiverEmail,
                    country: receiverCountry,
                };
                try {
                    const bank = await Bank.findOne(
                        {
                            name: sender.bank,
                        });
                    if (bank == null) {
                        throw new Error("Bank not found")
                    }

                    const infra = await Infra.findOne(
                        {
                            _id: bank.user_id,
                        });
                    if (infra == null) {
                        throw new Error("Infra not found")
                    }
                    const find = {
                        bank_id: bank._id,
                        type: "IBWNW",
                        status: 1,
                        active: 1,
                    };
                    const rule = await InterBankRule.findOne(find);
                    if (rule == null) {
                        throw new Error("Rule not found")
                    }

                    let data = new CashierSend();
                    temp = {
                        mobile: sender.mobile,
                        note: note,
                    };
                    data.sender_info = JSON.stringify(temp);
                    temp = {
                        mobile: receiverMobile,
                        // ccode: receiverccode,
                        givenname: receiverGivenName,
                        familyname: receiverFamilyName,
                        country: receiverCountry,
                        email: receiverEmail,
                    };
                    data.receiver_info = JSON.stringify(temp);
                    temp = {
                        country: receiverCountry,
                        type: receiverIdentificationType,
                        number: receiverIdentificationNumber,
                        valid: receiverIdentificationValidTill,
                    };
                    data.receiver_id = JSON.stringify(temp);
                    data.amount = sending_amount;
                    data.is_inclusive = isInclusive;
                    const transactionCode = makeid(8);
                    data.transaction_code = transactionCode;
                    data.rule_type = "Wallet to Non Wallet";
                    data.inter_bank_rule_type = "IBWNW";
                    data.is_inter_bank = 1;

                    data.without_id = withoutID ? 1 : 0;
                    if (requireOTP) {
                        data.require_otp = 1;
                        data.otp = makeotp(6);
                        content = data.otp + " - Send this OTP to the Receiver";
                        if (sender.mobile && sender.mobile != null) {
                            sendSMS(content, sender.mobile);
                        }
                        if (sender.email && sender.email != null) {
                            sendMail(
                                content,
                                "Transaction OTP",
                                receiver.email
                            );
                        }
                    }

                    //send transaction sms after actual transaction

                    var cs = await data.save();

                    var transfer = {
                        amount: sending_amount,
                        isInclusive: isInclusive,
                        receiverFamilyName: receiverFamilyName
                    }
                    var result = await interBankSendMoneyToNWByUser(transfer, infra, bank, sender, rule)
                    console.log("Result: " + result);
                    if (result.status != 0) {
                        let content =
                            "Your Transaction Code is " +
                            transactionCode;
                        if (
                            receiverMobile &&
                            receiverMobile != null
                        ) {
                            sendSMS(content, receiverMobile);
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

                        const caSend = await CashierSend.findByIdAndUpdate(
                            cs._id,
                            {
                                status: 1,
                                fee: result.fee,
                                master_code: result.master_code
                            }
                        );
                        if (caSend == null) {
                            throw new Error("Cashier send record not found");
                        }

                        await NWUser.create(receiver);
                        res.status(200).json({
                            status: 1,
                            message:
                                sending_amount +
                                " XOF is transferred to branch",
                            balance: result.balance - (result.amount + result.fee),
                        });
                    } else {
                        res.status(200).json({
                            status: 0,
                            message: result.toString(),
                        });
                    }
                } catch (err) {
                    console.log(err);
                    var message = err.toString();
                    if (err.message) {
                        message = err.message;
                    }
                    res.status(200).json({ status: 0, message: message });
                }
            }
        });
});

router.post("/partnerCashier/interBank/claimMoney", JWTTokenAuth, function (req, res) {
    var today = new Date();
    today = today.toISOString();
    var s = today.split("T");
    var start = s[0] + "T00:00:00.000Z";
    var end = s[0] + "T23:59:59.999Z";

    const jwtusername = req.sign_creds.username;

    const {
        transferCode,
        proof,
        givenname,
        familyname,
        receiverGivenName,
        receiverFamilyName,
        mobile,
    } = req.body;

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
                                        PartnerBranch.findOne(
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
                                                    Partner.findOne({ _id: branch.partner_id }, (err, partner) => {
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
                                                        } else if (partner == null) {
                                                            res.status(200).json({
                                                                status: 0,
                                                                message: "Partner Not Found",
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
                                                                                                        var transfer = {
                                                                                                            amount: cs.amount,
                                                                                                            isInclusive: cs.is_inclusive,
                                                                                                            partnerCode: partner.code
                                                                                                        }
                                                                                                        interBankClaimByPartner(transfer, sendingBank, bank, branch, rule1, rule2)
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
                                                                                                                                PartnerCashier.findByIdAndUpdate(
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
                                                    })
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

router.post("/partnerCashier/interBank/SendMoneyToNonWallet", JWTTokenAuth, function (req, res) {
    var today = new Date();
    today = today.toISOString();
    var s = today.split("T");
    var start = s[0] + "T00:00:00.000Z";
    var end = s[0] + "T23:59:59.999Z";
    const jwtusername = req.sign_creds.username;
    const {
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
                res.status(200).json({
                    status: 0,
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                PartnerBranch.findOne(
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
                            Partner.findOne({ _id: branch.partner_id }, function (err, partner) {
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
                                } else if (partner == null) {
                                    res.status(200).json({
                                        status: 0,
                                        message: "Partner Not Found",
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
                                                            data.inter_bank_rule_type = "IBNWNW";
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
                                                                        type: "IBNWNW",
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
                                                                                    var transfer = {
                                                                                        amount: amount,
                                                                                        isInclusive: isInclusive,
                                                                                        partnerCode: partner.code,
                                                                                        cashierId: cashier._id
                                                                                    }
                                                                                    interBankSendMoneyToNWByPartner(
                                                                                        transfer,
                                                                                        infra,
                                                                                        bank,
                                                                                        branch,
                                                                                        rule1,
                                                                                        rule2)
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
                                                                                                            PartnerCashier.findByIdAndUpdate(
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
                            })
                        }
                    }
                ); //branch
            }
        }
    );
});

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
                                                                                                var transfer = {
                                                                                                    amount: cs.amount,
                                                                                                    isInclusive: cs.is_inclusive
                                                                                                }
                                                                                                interBankClaimMoney(transfer, sendingBank, bank, branch, rule1, rule2)
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
                                                    data.inter_bank_rule_type = "IBNWNW";
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
                                                                type: "IBNWNW",
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
                                                                            var transfer = {
                                                                                amount: amount,
                                                                                isInclusive: isInclusive,
                                                                                cashierId: cashier._id
                                                                            }
                                                                            interBankSendMoneyToNonWallet(transfer, infra, bank, branch, rule1, rule2)
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

router.post("/partnerCashier/interBank/checkFee", JWTTokenAuth, function (req, res) {
    const { type, amount } = req.body;
    const jwtusername = req.sign_creds.username;
    if (type == "IBNWNW" || type == "IBNWW") {
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
                        type: type,
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
                                    message: "Inter Bank " + rule.name + " Fee",
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
    } else {
        res.status(200).json({
            status: 0,
            message: "Invalid rule type"
        });
    }
})

router.post("/cashier/interBank/checkFee", function (req, res) {
    const { token, type, amount } = req.body;
    if (type == "IBNWNW" || type == "IBNWW") {
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
                        type: type,
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
                                    message: "Inter Bank " + rule.name + " Fee",
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
    } else {
        res.status(200).json({
            status: 0,
            message: "Invalid rule type"
        });
    }
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

router.post("/infra/interBank/declineShare", function (req, res) {
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
                InterBankRule.findOneAndUpdate(
                    {
                        _id: rule_id,

                    },
                    {
                        infra_approval_status: -1
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
                            Bank.findOne({ _id: rule.bank_id }, (err, bank) => {
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
                                        message: "Bank not found.",
                                    });
                                } else {
                                    var content =
                                        "Infra has declined the fee rule " +
                                        rule.name +
                                        "in Ewallet Application";
                                    sendMail(content, "Share declined by Infra", bank.email);
                                    content =
                                        "Ewallet: Infra has declined the share of fee rule " + rule.name;
                                    sendSMS(content, bank.mobile);
                                    res.status(200).json({
                                        status: 1,
                                        message: "Declined",
                                    });
                                }
                            })
                        }
                    }
                );
            }
        }
    );
});

router.post("/infra/interBank/approveShare", function (req, res) {
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
                                if (rule.status == 0) {
                                    await InterBankRule.updateOne({ _id: rule._id }, {
                                        status: 1,
                                        infra_approval_status: 1
                                    })

                                } else {
                                    await InterBankRule.updateOne({ _id: rule._id }, {
                                        $set: {
                                            infra_share: rule.edited.infra_share,
                                            infra_approval_status: 1
                                        },
                                        $unset: {
                                            edited: {}
                                        }
                                    });
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
                                "Infra has approved the share of " +
                                rule.name +
                                " rule in Ewallet Application";
                            sendMail(content, "Share approved by Infra", bank.email);
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

router.post("/bank/interBank/updateOtherBankShares", function (req, res) {
    const { token, rule_id, other_bank_share } = req.body;
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
                    },
                    {
                        $set: {
                            other_bank_share: other_bank_share,
                        },
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
                            res.status(200).json({
                                status: 1,
                                message: "Updated Bank shares in " + rule.name + " transactions fee rule",
                                rule: rule,
                            });
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
                InterBankRule.findOneAndUpdate(
                    {
                        _id: rule_id,
                    },
                    {
                        $set: {
                            name: name,
                            active: active,
                            ranges: ranges,
                            description: description,
                        }
                    }, { new: true },
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

router.post("/bank/interBank/sendShareForApproval", function (req, res) {
    const { token, rule_id, infra_share } = req.body;
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
                Infra.findById({ _id: bank.user_id }, (err, infra) => {
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
                        InterBankRule.findOneAndUpdate(
                            {
                                _id: rule_id,
                            },
                            { new: true },
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
                                        message: "Infra share can not be added.",
                                    });
                                } else {
                                    try {
                                        if (rule.status == 0) {
                                            rule = await InterBankRule.findOneAndUpdate({ _id: rule_id },
                                                {
                                                    infra_share: infra_share,
                                                    infra_approval_status: 2
                                                }, { new: true });
                                        } else {
                                            rule = await InterBankRule.findOneAndUpdate({ _id: rule_id },
                                                {
                                                    "edited.infra_share": infra_share,
                                                    infra_approval_status: 2
                                                }, { new: true });
                                        }
                                        let content =
                                            "<p>Share of an Inter Bank fee rule for " + rule.name + " transactions is sent for approval in E-Wallet application</p><p>&nbsp;</p>";
                                        sendMail(content, "Waiting for approval", infra.email);
                                        let content2 =
                                            " E-Wallet: Share of an Inter Bank fee rule for " + rule.name + " transactions needs approval"
                                        sendSMS(content2, infra.mobile);
                                        res.status(200).json({
                                            status: 1,
                                            message:
                                                "Inter Bank " + rule.name + " Rule sent for approval",
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
                })
            }
        }
    );
});

module.exports = router;