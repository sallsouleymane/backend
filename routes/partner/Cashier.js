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
const Fee = require("../../models/Fee");
const CashierSend = require("../../models/CashierSend");
const CashierPending = require("../../models/CashierPending");
const CashierClaim = require("../../models/CashierClaim");
const CashierLedger = require("../../models/CashierLedger");
const CashierTransfer = require("../../models/CashierTransfer");
const OTP = require("../../models/OTP");

router.post("/partnerCashier/transferMoney", jwtTokenAuth, function (req, res) {
  const { otpId, otp, amount, receiver_id, receiver_name } = req.body;
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
        OTP.findOne(
          {
            _id: otpId,
            otp: otp,
          },
          function (err, otpd) {
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
            } else if (otpd == null) {
              res.status(200).json({
                status: 0,
                message: "OTP Missmatch",
              });
            } else {
              let data = new CashierTransfer();
              data.amount = amount;
              data.sender_id = cashier._id;
              data.receiver_id = receiver_id;
              data.sender_name = cashier.name;
              data.receiver_name = receiver_name;
              data.save((err) => {
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
                    { $inc: { cash_in_hand: -Number(amount) }, cash_transferred: amount },
                    function (e, d) {
                      if (e) {
                        return res.status(200).json({
                          status: 0,
                          message: e.toString(),
                        });
                      } else {
                        res.status(200).json({
                          status: 1,
                          message: "Money transferred record saved",
                        });
                      }
                    }
                  );
                }
              });
            }
          }
        );
      }
    }
  ); //branch
});

router.post("/partnerCashier/acceptIncoming", jwtTokenAuth, function (req, res) {
  const { receiver_id, amount, transfer_id } = req.body;
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
        PartnerCashier.findByIdAndUpdate(
          {
            _id: receiver_id,
          },
          {
            $inc: { cash_in_hand: Number(amount) }
          },
          function (err, u) {
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
            } else if (u == null) {
              res.status(200).json({
                status: 0,
                message:
                  "Receiving partner cashier not found.",
              });
            } else {
              CashierTransfer.findByIdAndUpdate(
                transfer_id,
                {
                  status: 1,
                },
                (e, data) => {
                  res.status(200).json({
                    status: 1,
                    message: "Accepted incoming cash"
                  });
                }

              );
            }
          }
        );
      }
    }
  );
});

router.post("/partnerCashier/cancelTransfer", jwtTokenAuth, function (req, res) {
  const { otpId, otp, transfer_id } = req.body;

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
        OTP.findOne(
          {
            _id: otpId,
            otp: otp,
          },
          function (err, otpd) {
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
            } else if (otpd == null) {
              res.status(200).json({
                status: 0,
                message: "OTP Missmatch",
              });
            } else {
              CashierTransfer.findOneAndUpdate(
                {
                  _id: transfer_id,
                },
                { status: -1 },
                function (err, item) {
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
                  } else if (item == null) {
                    res.status(200).json({
                      status: 0,
                      message:
                        "No record of cashier transfer found",
                    });
                  } else {
                    PartnerCashier.findOne(
                      {
                        _id: item.sender_id,
                      },
                      {
                        $inc: { cash_in_hand: Number(item.amount) },
                      },
                      function (err, u) {
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
                        } else if (u == null) {
                          res.status(200).json({
                            status: 0,
                            message:
                              "Sending cashier not found",
                          });
                        } else {
                          res.status(200).json({
                            status: 1,
                            message: "Cancelled transfer",
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
      }
    }
  ); //branch
});

router.post("/partnerCashier/getUserByMobile", jwtTokenAuth, function (req, res) {
  const { mobile } = req.body;
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
        PartnerUser.findOne({ mobile }, "-password", function (err, user) {
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
              message: "User not found",
            });
          } else {
            res.status(200).json({
              status: 1,
              data: user,
            });
          }
        });
      }
    });
});

router.post("/partnerCashier/checkNonWaltoWalFee", jwtTokenAuth, function (req, res) {
  var { amount } = req.body;
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
        Partner.findOne(
          {
            _id: cashier.partner_id,
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
                message: "Partner not Found",
              });
            } else {
              const find = {
                bank_id: partner.bank_id,
                trans_type: "Non Wallet to Wallet",
                status: 1,
                active: "Active",
              };
              Fee.findOne(find, function (err, fe) {
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
                } else if (fe == null) {
                  res.status(200).json({
                    status: 0,
                    message: "Transaction cannot be done at this time",
                  });
                } else {
                  amount = Number(amount);
                  var temp;
                  fe.ranges.map((range) => {
                    console.log(range);
                    if (
                      amount >= range.trans_from &&
                      amount <= range.trans_to
                    ) {
                      temp = (amount * range.percentage) / 100;
                      fee = temp + range.fixed_amount;
                      res.status(200).json({
                        status: 1,
                        fee: fee,
                      });
                    }
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

router.post("/partnerCashier/getCashierTransLimit", jwtTokenAuth, function (req, res) {
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
        let limit =
          Number(cashier.max_trans_amt) -
          (Number(cashier.cash_received) + Number(cashier.cash_paid));
        limit = limit < 0 ? 0 : limit;
        res.status(200).json({
          limit: limit,
          closingTime: cashier.closing_time,
          transactionStarted: cashier.transaction_started,
          cashInHand: cashier.cash_in_hand,
          isClosed: cashier.is_closed,
        });
      }
    }
  );
});

router.post("/partnerCashier/verifyOTPClaim", jwtTokenAuth, function (req, res) {
  const { transferCode, otp } = req.body;
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
        CashierSend.findOne(
          {
            transaction_code: transferCode,
            otp: otp,
          },
          function (err, otpd) {
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
            } else if (otpd == null) {
              res.status(200).json({
                status: 0,
                message: "OTP Missmatch",
              });
            } else {
              res.status(200).json({
                status: 1,
                message: "Claim OTP verified",
              });
            }
          }
        );
      }
    }
  );
});

router.post("/partnerCashier/verifyClaim", jwtTokenAuth, function (req, res) {
  const { otpId, otp } = req.body;
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
        OTP.findOne(
          {
            _id: otpId,
            otp: otp,
          },
          function (err, otpd) {
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
            } else if (otpd == null) {
              res.status(200).json({
                status: 0,
                message: "OTP Missmatch",
              });
            } else {
              res.status(200).json({
                status: 1,
                message: "Cashier verify claim success",
              });
            }
          }
        );
      }
    }
  );
});


router.post("/partnerCashier/sendMoneyPending", jwtTokenAuth, function (req, res) {
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
    livefee,
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
  } = req.body;

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
        let data = new CashierPending();
        let temp = {
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
          livefee,
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
        };
        data.sender_name = givenname + " " + familyname;
        data.receiver_name = receiverGivenName + " " + receiverFamilyName;
        data.amount = receiverIdentificationAmount;
        data.transaction_details = JSON.stringify(temp);
        data.cashier_id = cashier._id;

        let pending = Number(cashier.pending_trans) + 1;

        data.save((err, d) => {
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
              { pending_trans: pending },
              function (e, d) {
                if (e && d == null) {
                  res.status(200).json({
                    status: 0,
                    message: e.toString(),
                  });
                } else {
                  res.status(200).json({
                    status: 1,
                    message: "Pending to send money record saved.",
                  });
                }
              }
            );
          }
        }); //save
      }
    }
  );
});

router.post("/partnerCashier/getClaimMoney", jwtTokenAuth, function (req, res) {
  const { transferCode } = req.body;
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
        CashierClaim.findOne(
          {
            transaction_code: transferCode,
            status: 1,
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
                      message: "Record Not Found",
                    });
                  } else {
                    res.status(200).json({
                      row: cs,
                    });
                  }
                }
              );
            } else {
              res.status(200).json({
                status: 0,
                message: "This transaction was already claimed",
              });
            }
          }
        );
      }
    }
  );
});

router.post("/partnerCashier/checkFee", jwtTokenAuth, function (req, res) {
  var { amount } = req.body;
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
        Partner.findOne({ _id: cashier.partner_id }, (err, partner) => {
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
            return res.status(200).json({
              status: 0,
              message: "Bank not Found",
            });
          }
          const find = {
            bank_id: partner.bank_id,
            trans_type: "Non Wallet to Non Wallet",
            status: 1,
            active: "Active",
          };
          Fee.findOne(find, function (err, fe) {
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
            } else if (fe == null) {
              return res.status(200).json({
                status: 0,
                message: "Transaction cannot be done at this time",
              });
            } else {
              amount = Number(amount);
              var temp;
              fe.ranges.map((range) => {
                console.log(range);
                if (amount >= range.trans_from && amount <= range.trans_to) {
                  temp = (amount * range.percentage) / 100;
                  fee = temp + range.fixed_amount;
                  res.status(200).json({
                    status: 1,
                    fee: fee,
                  });
                }
              });
            }
          });

        })
      }
    }
  );
});

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

router.post("/partnerCashier/openBalance", jwtTokenAuth, (req, res) => {
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
