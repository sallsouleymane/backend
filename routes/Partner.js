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
const Partner = require("../models/partner/Partner");

router.post("/partner/activate", jwtTokenAuth, function (req, res) {
    Partner.findOne(
        {
            username,
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
            } else if (!partner) {
                res.status(200).json({
                    status: 0,
                    message:
                        "Token changed or user not valid. Try to login again or contact system administrator.",
                });
            } else {
                createWallet([
                    "_partner_operational@" + bank.name,
                    "_partner_master@" + bank.name,
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