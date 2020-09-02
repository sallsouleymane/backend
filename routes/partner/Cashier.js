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
const PartnerBranch = require("../../models/partner/Branch");
const PartnerCashier = require("../../models/partner/Cashier");
const PartnerUser = require("../../models/partner/User");
const FailedTX = require("../../models/FailedTXLedger");

router.post("/partnerCashier/getHistory", jwtTokenAuth, function (req, res) {
  const { from } = req.body;
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
        res.status(200).json({
          status: 0,
          message:
            "Token changed or user not valid. Try to login again or contact system administrator.",
        });
      } else {
        Partner.findOne({ _id: cashier.partner_id }, (err, partner) => {
          Bank.findOne({ _id: partner.bank_id }, (err, bank) => {
            PartnerBranch.findOne({ _id: cashier.branch_id }, (err, branch) => {
              const wallet =
                branch.code + "_partnerbranch_" + from + "@" + bank.name;
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
        });
      }
    }
  );
});

router.post("/partnerCashier/getBranchByName", jwtTokenAuth, function (
  req,
  res
) {
  const { name } = req.body;
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
        res.status(200).json({
          status: 0,
          message:
            "Token changed or user not valid. Try to login again or contact system administrator.",
        });
      } else {
        PartnerBranch.findOne(
          {
            name: name,
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
                message: "Not found",
              });
            } else {
              Partner.findOne(
                {
                  _id: branch.partner_id,
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
                      message: "Not found",
                    });
                  } else {
                    var obj = {};
                    obj["logo"] = partner.logo;
                    obj["partnerName"] = partner.name;
                    obj["name"] = branch.name;
                    obj["mobile"] = branch.mobile;
                    obj["_id"] = branch._id;
                    obj["partnerCode"] = partner.code;

                    res.status(200).json({
                      status: 1,
                      branch: obj,
                    });
                  }
                }
              );
            }
          }
        );
      }
    }
  );
});

router.post("/partnerCashier/getDashStats", jwtTokenAuth, function (req, res) {
  const jwtusername = req.sign_creds.username;
  PartnerCashier.findOne(
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
        res.status(200).json({
          status: 0,
          message:
            "Token changed or user not valid. Try to login again or contact system administrator.",
        });
      } else {
        res.status(200).json({
          openingBalance: user.opening_balance,
          closingBalance: user.closing_balance,
          cashPaid: user.cash_paid,
          cashReceived: user.cash_received,
          cashInHand: user.cash_in_hand,
          feeGenerated: user.fee_generated,
          commissionGenerated: user.commission_generated,
          closingTime: user.closing_time,
          transactionStarted: user.transaction_started,
          branchId: user.branch_id,
          isClosed: user.is_closed,
        });
      }
    }
  );
});

router.post("/partnerCashier/openCashierBalance", jwtTokenAuth, (req, res) => {
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
        res.status(200).json({
          status: 0,
          message:
            "Token changed or user not valid. Try to login again or contact system administrator.",
        });
      } else {
        var bal =
          Number(cashier.closing_balance) > 0
            ? cashier.closing_balance
            : cashier.opening_balance;
        upd = {
          opening_balance: bal,
          cash_received: 0,
          fee_generated: 0,
          cash_paid: 0,
          closing_balance: 0,
          closing_time: null,
          transaction_started: true,
          is_closed: false,
        };

        PartnerCashier.findByIdAndUpdate(cashier._id, upd, (err) => {
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
              message: "Partner Cashier account is open now",
            });
          }
        });
      }
    }
  );
});

module.exports = router;
