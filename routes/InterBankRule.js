const express = require("express");
const router = express.Router();

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");

const Bank = require("../models/Bank");
const Cashier = require("../models/Cashier");
const PartnerCashier = require("../models/partner/Cashier");
const Infra = require("../models/Infra");
const InterBankRule = require("../models/InterBankRule");
const JWTTokenAuth = require("./JWTTokenAuth");

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