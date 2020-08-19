const express = require("express");
const router = express.Router();

const config = require("../config.json");
const jwtTokenAuth = require("./JWTTokenAuth");

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const makeid = require("./utils/idGenerator");
const makeotp = require("./utils/makeotp");
const blockchain = require("../services/Blockchain");

//models
const Bank = require("../models/Bank");
const Merchant = require("../models/merchant/Merchant");
const MerchantBranch = require("../models/merchant/MerchantBranch");
const MerchantStaff = require("../models/merchant/MerchantStaff");
const MerchantCashier = require("../models/merchant/MerchantCashier");
const Zone = require("../models/merchant/Zone");
const Subzone = require("../models/merchant/Subzone");
const InvoiceGroup = require("../models/merchant/InvoiceGroup");
const FailedTX = require("../models/FailedTXLedger");
const Offering = require("../models/merchant/Offering");
const Tax = require("../models/merchant/Tax");
const MerchantSettings = require("../models/merchant/MerchantSettings");
const Customer = require("../models/merchant/Customer");

router.post("/partner/activate", function (req, res) {
    const { token } = req.body;
    Bank.findOne(
        {
            token,
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
            } else if (!bank) {
                res.status(200).json({
                    status: 0,
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                createWallet([
                    "testuser@" + bank.name,
                    "operational@" + bank.name,
                    "escrow@" + bank.name,
                    "master@" + bank.name,
                    "infra_operational@" + bank.name,
                    "infra_master@" + bank.name,
                ]).then(function (result) {
                    if (result != "" && !result.includes("wallet already exists")) {
                        console.log(result);
                        res.status(200).json({
                            status: 0,
                            message: "Blockchain service was unavailable. Please try again.",
                            result: result,
                        });
                    } else {
                        Bank.findByIdAndUpdate(
                            bank._id,
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
                                    res.status(200).json({
                                        status: "activated",
                                        walletStatus: result,
                                    });
                                }
                            }
                        );
                    }
                });
            }
        }
    );
});

module.exports = router;