const express = require("express");
const router = express.Router();

const config = require("../../config.json");
const jwtTokenAuth = require("../JWTTokenAuth");

//utils
const sendSMS = require("../utils/sendSMS");
const sendMail = require("../utils/sendMail");
const makeid = require("../utils/idGenerator");
const makeotp = require("../utils/makeotp");
const blockchain = require("../../services/Blockchain");

//models
const Bank = require("../../models/Bank");
const Partner = require("../../models/partner/Partner");
const PartnerBranch = require("../../models/partner/Branch")
const PartnerCashier = require("../../models/partner/Cashier")
const PartnerUser = require("../../models/partner/User");
const FailedTX = require("../../models/FailedTXLedger");


router.post("/partnerBranch/transferMasterToOp", jwtTokenAuth, function (req, res) {
    const { amount } = req.body;
    const jwtusername = req.sign_creds.username;
    PartnerBranch.findOne(
        {
            username: jwtusername,
            status: 1,
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
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                Partner.findOne(
                    {
                        _id: branch.partner_id,
                        status: 1,
                    },
                    function (err, partner) {
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
                                message: "Partner not found.",
                            });
                        } else {
                            Bank.findOne(
                                {
                                    _id: partner.bank_id,
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
                                            message: "Bank not found.",
                                        });
                                    } else {
                                        const masterWallet = branch.code + "_partnerbranch_master@" + bank.name;
                                        const opWallet = branch.code + "_partnerbranch_operational@" + bank.name;
                                        const trans = {
                                            from: masterWallet,
                                            to: opWallet,
                                            amount: Number(amount),
                                            note: "Master to operational",
                                            email1: branch.email,
                                            mobile1: branch.mobile,
                                            from_name: branch.name,
                                            to_name: branch.name,
                                            master_code: "",
                                            child_code: ""
                                        }
                                        blockchain.initiateTransfer(trans).then((result) => {
                                            res.status(200).json(result)
                                        });
                                    }
                                });
                        }
                    });
            }
        });
});

router.post("/partnerBranch/SetupUpdate", jwtTokenAuth, function (req, res) {
    const { password } = req.body;
    const jwtusername = req.sign_creds.username;
    PartnerBranch.findOne(
        {
            username: jwtusername,
            status: 1,
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
            } else if (!branch) {
                res.status(200).json({
                    status: 0,
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                PartnerBranch.findByIdAndUpdate(
                    branch._id,
                    {
                        password: password,
                        initial_setup: true,
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
                            res.status(200).json({
                                status: 1,
                                message: "Updated successfully",
                            });
                        }
                    }
                );
            }
        }
    );
});

router.post("/partnerBranch/getHistoryTotal", jwtTokenAuth, function (req, res) {
    const { from } = req.body;
    const jwtusername = req.sign_creds.username;
    PartnerBranch.findOne(
        {
            username: jwtusername,
            status: 1,
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
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                Partner.findOne({ _id: branch.partner_id }, (err, partner) => {
                    Bank.findOne({ _id: partner.bank_id }, (err, bank) => {
                        const wallet = branch.code + "_partnerbranch_" + from + "@" + bank.name;
                        blockchain.getTransactionCount(wallet).then(function (count) {
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
                                    count: count,
                                });
                            }
                        });
                    });
                });
            }
        }
    );
});

router.post("/partnerBranch/getHistory", jwtTokenAuth, function (req, res) {
    const { from } = req.body;
    const jwtusername = req.sign_creds.username;
    PartnerBranch.findOne(
        {
            username: jwtusername,
            status: 1,
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
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                Partner.findOne({ _id: branch.partner_id }, (err, partner) => {
                    Bank.findOne({ _id: partner.bank_id }, (err, bank) => {
                        const wallet = branch.code + "_partnerbranch_" + from + "@" + bank.name;
                        blockchain.getStatement(wallet).then(function (history) {
                            FailedTX.find({ wallet_id: wallet }, (err, failed) => {
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
                                        history: history,
                                        failed: failed,
                                    });
                                }
                            });
                        });

                    });
                });
            }
        }
    );
});

router.post("/partnerBranch/editCashier", jwtTokenAuth, (req, res) => {
    const {
        cashier_id,
        name,
        code,
        working_from,
        working_to,
        per_trans_amt,
        max_trans_amt,
        max_trans_count,
    } = req.body;
    const jwtusername = req.sign_creds.username;
    PartnerBranch.findOne(
        {
            username: jwtusername,
            status: 1,
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
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                PartnerCashier.findByIdAndUpdate(
                    cashier_id,
                    {
                        name: name,
                        working_from: working_from,
                        working_to: working_to,
                        per_trans_amt: per_trans_amt,
                        code: code,
                        max_trans_count: max_trans_count,
                        max_trans_amt: max_trans_amt,
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
                            return res.status(200).json({ status: 1, message: "Partner Cashier edited successfully" });
                        }
                    }
                );
            }
        });
});

router.post("/partnerBranch/updateCashierUser", jwtTokenAuth, function (req, res) {
    const { cashier_id, user_id } = req.body;
    const jwtusername = req.sign_creds.username;
    PartnerBranch.findOne(
        {
            username: jwtusername,
            status: 1,
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
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                PartnerCashier.countDocuments(
                    { partner_user_id: user_id },
                    function (err, count) {
                        if (count > 0) {
                            res.status(200).json({
                                status: 0,
                                message: "User is already assigned to this or another cashier",
                            });
                        } else {
                            PartnerCashier.findByIdAndUpdate(cashier_id, { partner_user_id: user_id }, function (
                                err,
                                cashier
                            ) {
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
                                        row: cashier,
                                    });
                                }
                            });
                        }
                    }
                );
            }
        }
    );
});

router.post("/partnerBranch/getDetailsByName", jwtTokenAuth, function (req, res) {
    const { name } = req.body;
    const jwtusername = req.sign_creds.username;
    PartnerBranch.findOne(
        {
            username: jwtusername,
            status: 1,
            name: name
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
                    message:
                        "Branch not found or login session expired",
                });
            } else {
                res.status(200).json({
                    status: 1,
                    branch: branch
                });
            }
        });
});

router.post("/partnerBranch/getDashStats", jwtTokenAuth, function (req, res) {

    const jwtusername = req.sign_creds.username;
    PartnerBranch.findOne(
        {
            username: jwtusername,
            status: 1,
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
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                PartnerCashier.countDocuments(
                    {
                        branch_id: branch._id,
                    },
                    (err, count) => {
                        if (count == null || !count) {
                            count = 0;
                        }
                        PartnerCashier.aggregate(
                            [
                                {
                                    $group: {
                                        _id: null,
                                        total: {
                                            $sum: "$cash_in_hand",
                                        },
                                    },
                                },
                            ],
                            (err, aggregate) => {
                                let cin = 0;
                                if (
                                    aggregate != undefined &&
                                    aggregate != null &&
                                    aggregate.length > 0
                                ) {
                                    cin = aggregate[0].total;
                                }

                                res.status(200).json({
                                    status: 1,
                                    totalCashier: count,
                                    cashInHand: cin,
                                });
                            }
                        );
                    }
                );
            }
        }
    );
});

module.exports = router;