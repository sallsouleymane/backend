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
const Infra = require("../../models/Infra");
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
const Merchant = require("../../models/merchant/Merchant");
const User = require("../../models/User");

router.post("/partnerCashier/getDetails", jwtTokenAuth, function (req, res) {
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
        PartnerUser.findOne({ _id: cashier.partner_user_id }, function (
          err,
          user
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
              cashier: cashier,
              user: user,
            });
          }
        });
      }
    }
  );
});

router.post("/partnerCashier/sendMoneyToWallet", jwtTokenAuth, function (
  req,
  res
) {
  var today = new Date();
  today = today.toISOString();
  var s = today.split("T");
  var start = s[0] + "T00:00:00.000Z";
  var end = s[0] + "T23:59:59.999Z";
  var now = new Date().getTime();

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
                          _id: partner.bank_id,
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

                                  var mns = branch.mobile.slice(-2);
                                  var mnr = bank.mobile.slice(-2);
                                  var master_code = mns + "" + mnr + "" + now;
                                  var child_code = mns + "" + mnr + "" + now;
                                  data.master_code = master_code;
                                  data.child_code = child_code;

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
                                      sendMail(
                                        content,
                                        "Transaction OTP",
                                        email
                                      );
                                    }
                                  }

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
                                      const branchOpWallet =
                                        branch.code +
                                        "_partnerbranch_operational@" +
                                        bank.name;
                                      const receiverWallet =
                                        receiverMobile + "@" + receiver.bank;
                                      const bankOpWallet =
                                        "operational@" + bank.name;
                                      const infraOpWallet =
                                        "infra_operational@" + bank.name;

                                      const find = {
                                        bank_id: bank._id,
                                        trans_type: "Non Wallet to Wallet",
                                        status: 1,
                                        active: "Active",
                                      };

                                      const amount = receiverIdentificationAmount;
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
                                            message: "Revenue Rule Not Found",
                                          });
                                        } else {
                                          var fee = 0;
                                          var temp;
                                          fe.ranges.map((range) => {
                                            if (
                                              amount >= range.trans_from &&
                                              amount <= range.trans_to
                                            ) {
                                              temp =
                                                (amount * range.percentage) /
                                                100;
                                              fee = temp + range.fixed_amount;

                                              oamount = Number(amount);

                                              if (isInclusive) {
                                                oamount = oamount - fee;
                                              }

                                              let trans1 = {};
                                              trans1.from = branchOpWallet;
                                              trans1.to = receiverWallet;
                                              trans1.amount = oamount;
                                              trans1.note =
                                                "Cashier Send Money";
                                              trans1.email1 = branch.email;
                                              trans1.email2 = receiver.email;
                                              trans1.mobile1 = branch.mobile;
                                              trans1.mobile2 = receiver.mobile;
                                              trans1.from_name = branch.name;
                                              trans1.to_name = receiver.name;
                                              trans1.user_id = cashier._id;
                                              trans1.master_code = master_code;
                                              trans1.child_code =
                                                child_code + "1";

                                              let trans2 = {};
                                              trans2.from = branchOpWallet;
                                              trans2.to = bankOpWallet;
                                              trans2.amount = fee;
                                              trans2.note =
                                                "Cashier Send Money Fee";
                                              trans2.email1 = branch.email;
                                              trans2.email2 = bank.email;
                                              trans2.mobile1 = branch.mobile;
                                              trans2.mobile2 = bank.mobile;
                                              trans2.from_name = branch.name;
                                              trans2.to_name = bank.name;
                                              trans2.user_id = cashier._id;
                                              trans2.master_code = master_code;
                                              now = new Date().getTime();
                                              child_code =
                                                mns + "" + mnr + "" + now;
                                              trans2.child_code =
                                                child_code + "2";

                                              blockchain
                                                .getBalance(branchOpWallet)
                                                .then(function (bal) {
                                                  if (
                                                    Number(bal) +
                                                      Number(
                                                        branch.credit_limit
                                                      ) >=
                                                    oamount + fee
                                                  ) {
                                                    console.log(fe);
                                                    const {
                                                      infra_share,
                                                      partner_share,
                                                      specific_partner_share,
                                                    } = fe.revenue_sharing_rule;

                                                    var infraShare = 0;
                                                    var temp =
                                                      (fee *
                                                        Number(
                                                          infra_share.percentage
                                                        )) /
                                                      100;
                                                    var infraShare =
                                                      temp +
                                                      Number(infra_share.fixed);

                                                    let trans3 = {};
                                                    trans3.from = bankOpWallet;
                                                    trans3.to = infraOpWallet;
                                                    trans3.amount = infraShare;
                                                    trans3.note =
                                                      "Cashier Send Money Infra Fee";
                                                    trans3.email1 = bank.email;
                                                    trans3.email2 = infra.email;
                                                    trans3.mobile1 =
                                                      bank.mobile;
                                                    trans3.mobile2 =
                                                      infra.mobile;
                                                    trans3.from_name =
                                                      bank.name;
                                                    trans3.to_name = infra.name;
                                                    trans3.user_id = "";
                                                    trans3.master_code = master_code;
                                                    mns = bank.mobile.slice(-2);
                                                    mnr = infra.mobile.slice(
                                                      -2
                                                    );
                                                    now = new Date().getTime();
                                                    child_code =
                                                      mns +
                                                      "" +
                                                      mnr +
                                                      "" +
                                                      now +
                                                      "3";
                                                    trans3.child_code = child_code;

                                                    //Code by Hatim

                                                    //what i need
                                                    //branchId
                                                    //feeId

                                                    let feeObject = partner_share;
                                                    let sendFee = 0;

                                                    if (
                                                      specific_partner_share.length >
                                                      0
                                                    ) {
                                                      feeObject = specific_partner_share.filter(
                                                        (bwsf) =>
                                                          bwsf.branch_code ==
                                                          branch.bcode
                                                      )[0];
                                                    }
                                                    const { send } = feeObject;
                                                    sendFee =
                                                      (send * fee) / 100;
                                                    let trans4 = {};
                                                    trans4.from = bankOpWallet;
                                                    trans4.to = branchOpWallet;
                                                    //cacluat the revene here and replace with fee below.
                                                    trans4.amount = Number(
                                                      Number(sendFee).toFixed(2)
                                                    );
                                                    // trans4.amount = 1 ;
                                                    trans4.note =
                                                      "Bank Send Revenue Branch for Sending money";
                                                    trans4.email1 = bank.email;
                                                    trans4.email2 =
                                                      branch.email;
                                                    trans4.mobile1 =
                                                      branch.mobile;
                                                    trans4.mobile2 =
                                                      bank.mobile;
                                                    trans4.from_name =
                                                      bank.name;
                                                    trans4.to_name =
                                                      branch.name;
                                                    trans4.user_id = "";
                                                    trans4.master_code = master_code;
                                                    now = new Date().getTime();
                                                    child_code =
                                                      mns + "" + mnr + "" + now;
                                                    trans4.child_code =
                                                      child_code + "4";
                                                    //End
                                                    console.log(
                                                      sendFee,
                                                      feeObject,
                                                      partner_share,
                                                      specific_partner_share,
                                                      branch.bcode
                                                    );

                                                    blockchain
                                                      .transferThis(
                                                        trans1,
                                                        trans2,
                                                        trans3,
                                                        trans4
                                                      )
                                                      .then(function (result) {
                                                        console.log(
                                                          "Result: " + result
                                                        );
                                                        if (
                                                          result.length <= 0
                                                        ) {
                                                          CashierSend.findByIdAndUpdate(
                                                            d._id,
                                                            {
                                                              status: 1,
                                                              fee: fee,
                                                            },
                                                            (err) => {
                                                              if (err) {
                                                                console.log(
                                                                  err
                                                                );
                                                                var message = err;
                                                                if (
                                                                  err.message
                                                                ) {
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
                                                                        oamount
                                                                      ) +
                                                                      Number(
                                                                        fee
                                                                      ),
                                                                    cash_in_hand:
                                                                      Number(
                                                                        cashier.cash_in_hand
                                                                      ) +
                                                                      Number(
                                                                        oamount
                                                                      ) +
                                                                      Number(
                                                                        fee
                                                                      ),
                                                                    fee_generated:
                                                                      Number(
                                                                        sendFee
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
                                                                  ) {}
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
                                                                          oamount
                                                                        ) +
                                                                        Number(
                                                                          fee
                                                                        );
                                                                      data.trans_type =
                                                                        "CR";
                                                                      data.transaction_details = JSON.stringify(
                                                                        {
                                                                          fee: fee,
                                                                        }
                                                                      );
                                                                      data.cashier_id =
                                                                        cashier._id;
                                                                      data.save(
                                                                        function (
                                                                          err,
                                                                          c
                                                                        ) {}
                                                                      );
                                                                    } else {
                                                                      var amt =
                                                                        Number(
                                                                          c.amount
                                                                        ) +
                                                                        Number(
                                                                          oamount
                                                                        ) +
                                                                        Number(
                                                                          fee
                                                                        );
                                                                      CashierLedger.findByIdAndUpdate(
                                                                        c._id,
                                                                        {
                                                                          amount: amt,
                                                                        },
                                                                        function (
                                                                          err,
                                                                          c
                                                                        ) {}
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
      }
    }
  );
});

router.post("/partnerCashier/sendMoney", jwtTokenAuth, function (req, res) {
  var today = new Date();
  today = today.toISOString();
  var s = today.split("T");
  var start = s[0] + "T00:00:00.000Z";
  var end = s[0] + "T23:59:59.999Z";
  var now = new Date().getTime();

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
                    _id: partner.bank_id,
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

                            var mns = branch.mobile.slice(-2);
                            var mnr = bank.mobile.slice(-2);
                            var master_code = mns + "" + mnr + "" + now;
                            var child_code = mns + "" + mnr + "" + now;
                            data.master_code = master_code;
                            data.child_code = child_code;

                            //send transaction sms after actual transaction

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
                                const branchOpWallet =
                                  branch.code +
                                  "_partnerbranch_operational@" +
                                  bank.name;
                                const bankEsWallet = "escrow@" + bank.name;
                                const bankOpWallet = "operational@" + bank.name;
                                const infraOpWallet =
                                  "infra_operational@" + bank.name;

                                const find = {
                                  bank_id: bank._id,
                                  trans_type: "Non Wallet to Non Wallet",
                                  status: 1,
                                  active: "Active",
                                };

                                const amount = receiverIdentificationAmount;
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
                                      message: "Revenue Rule Not Found",
                                    });
                                  } else {
                                    var fee = 0;
                                    var temp;
                                    fe.ranges.map((range) => {
                                      if (
                                        amount >= range.trans_from &&
                                        amount <= range.trans_to
                                      ) {
                                        temp =
                                          (amount * range.percentage) / 100;
                                        fee = temp + range.fixed_amount;

                                        oamount = Number(amount);

                                        if (isInclusive) {
                                          oamount = oamount - fee;
                                        }
                                        let trans1 = {};
                                        trans1.from = branchOpWallet;
                                        trans1.to = bankEsWallet;
                                        trans1.amount = oamount;
                                        trans1.note = "Cashier Send Money";
                                        trans1.email1 = branch.email;
                                        trans1.email2 = bank.email;
                                        trans1.mobile1 = branch.mobile;
                                        trans1.mobile2 = bank.mobile;
                                        trans1.from_name = branch.name;
                                        trans1.to_name = bank.name;
                                        trans1.user_id = cashier._id;
                                        trans1.master_code = master_code;
                                        trans1.child_code = child_code + "1";

                                        let trans2 = {};
                                        trans2.from = branchOpWallet;
                                        trans2.to = bankOpWallet;
                                        trans2.amount = fee;
                                        trans2.note = "Cashier Send Money Fee";
                                        trans2.email1 = branch.email;
                                        trans2.email2 = bank.email;
                                        trans2.mobile1 = branch.mobile;
                                        trans2.mobile2 = bank.mobile;
                                        trans2.from_name = branch.name;
                                        trans2.to_name = bank.name;
                                        trans2.user_id = cashier._id;
                                        trans2.master_code = master_code;
                                        now = new Date().getTime();
                                        child_code = mns + "" + mnr + "" + now;
                                        trans2.child_code = child_code + "2";

                                        blockchain
                                          .getBalance(branchOpWallet)
                                          .then(function (bal) {
                                            if (
                                              Number(bal) +
                                                Number(branch.credit_limit) >=
                                              oamount + fee
                                            ) {
                                              console.log(fe);
                                              const {
                                                infra_share,
                                                partner_share,
                                                specific_partner_share,
                                              } = fe.revenue_sharing_rule;

                                              var infraShare = 0;
                                              var temp =
                                                (fee *
                                                  Number(
                                                    infra_share.percentage
                                                  )) /
                                                100;
                                              var infraShare =
                                                temp +
                                                Number(infra_share.fixed);

                                              let trans3 = {};
                                              trans3.from = bankOpWallet;
                                              trans3.to = infraOpWallet;
                                              trans3.amount = infraShare;
                                              trans3.note =
                                                "Cashier Send Money Infra Fee";
                                              trans3.email1 = bank.email;
                                              trans3.email2 = infra.email;
                                              trans3.mobile1 = bank.mobile;
                                              trans3.mobile2 = infra.mobile;
                                              trans3.from_name = bank.name;
                                              trans3.to_name = infra.name;
                                              trans3.user_id = "";
                                              trans3.master_code = master_code;
                                              mns = bank.mobile.slice(-2);
                                              mnr = infra.mobile.slice(-2);
                                              now = new Date().getTime();
                                              child_code =
                                                mns + "" + mnr + "" + now + "3";
                                              trans3.child_code = child_code;

                                              //Code by Hatim

                                              //what i need
                                              //branchId
                                              //feeId

                                              let feeObject = partner_share;
                                              let sendFee = 0;

                                              if (
                                                specific_partner_share.length >
                                                0
                                              ) {
                                                feeObject = specific_partner_share.filter(
                                                  (bwsf) =>
                                                    bwsf.branch_code ==
                                                    branch.code
                                                )[0];
                                              }
                                              const { send } = feeObject;
                                              sendFee = (send * fee) / 100;
                                              let trans4 = {};
                                              trans4.from = bankOpWallet;
                                              trans4.to = branchOpWallet;
                                              //cacluat the revene here and replace with fee below.
                                              trans4.amount = Number(
                                                Number(sendFee).toFixed(2)
                                              );
                                              // trans4.amount = 1 ;
                                              trans4.note =
                                                "Bank Send Revenue Branch for Sending money";
                                              trans4.email1 = branch.email;
                                              trans4.email2 = bank.email;
                                              trans4.mobile1 = branch.mobile;
                                              trans4.mobile2 = bank.mobile;
                                              trans4.from_name = branch.name;
                                              trans4.to_name = bank.name;
                                              trans4.user_id = "";
                                              trans4.master_code = master_code;
                                              now = new Date().getTime();
                                              child_code =
                                                mns + "" + mnr + "" + now;
                                              trans4.child_code =
                                                child_code + "4";
                                              //End
                                              console.log(
                                                sendFee,
                                                feeObject,
                                                partner_share,
                                                specific_partner_share,
                                                branch.code
                                              );

                                              blockchain
                                                .transferThis(
                                                  trans1,
                                                  trans2,
                                                  trans3,
                                                  trans4
                                                )
                                                .then(function (result) {
                                                  console.log(
                                                    "Result: " + result
                                                  );
                                                  if (result.length <= 0) {
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
                                                      d._id,
                                                      {
                                                        status: 1,
                                                        fee: fee,
                                                      },
                                                      (err) => {
                                                        if (err) {
                                                          console.log(err);
                                                          var message = err;
                                                          if (err.message) {
                                                            message =
                                                              err.message;
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
                                                                Number(
                                                                  oamount
                                                                ) +
                                                                Number(fee),
                                                              cash_in_hand:
                                                                Number(
                                                                  cashier.cash_in_hand
                                                                ) +
                                                                Number(
                                                                  oamount
                                                                ) +
                                                                Number(fee),
                                                              fee_generated:
                                                                Number(
                                                                  sendFee
                                                                ) +
                                                                Number(
                                                                  cashier.fee_generated
                                                                ),

                                                              total_trans:
                                                                Number(
                                                                  cashier.total_trans
                                                                ) + 1,
                                                            },
                                                            function (e, v) {}
                                                          );
                                                        }

                                                        CashierLedger.findOne(
                                                          {
                                                            cashier_id:
                                                              cashier._id,
                                                            trans_type: "CR",
                                                            created_at: {
                                                              $gte: new Date(
                                                                start
                                                              ),
                                                              $lte: new Date(
                                                                end
                                                              ),
                                                            },
                                                          },
                                                          function (err, c) {
                                                            if (
                                                              err ||
                                                              c == null
                                                            ) {
                                                              let data = new CashierLedger();
                                                              data.amount =
                                                                Number(
                                                                  oamount
                                                                ) + Number(fee);
                                                              data.trans_type =
                                                                "CR";
                                                              data.transaction_details = JSON.stringify(
                                                                {
                                                                  fee: fee,
                                                                }
                                                              );
                                                              data.cashier_id =
                                                                cashier._id;
                                                              data.save(
                                                                function (
                                                                  err,
                                                                  c
                                                                ) {}
                                                              );
                                                            } else {
                                                              var amt =
                                                                Number(
                                                                  c.amount
                                                                ) +
                                                                Number(
                                                                  oamount
                                                                ) +
                                                                Number(fee);
                                                              CashierLedger.findByIdAndUpdate(
                                                                c._id,
                                                                { amount: amt },
                                                                function (
                                                                  err,
                                                                  c
                                                                ) {}
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
                          } //infra
                        }
                      );
                    }
                  }
                );
              }
            }
          ); //branch
        });
      }
    }
  );
});

router.post("/partnerCashier/claimMoney", jwtTokenAuth, function (req, res) {
  var today = new Date();
  today = today.toISOString();
  var s = today.split("T");
  var start = s[0] + "T00:00:00.000Z";
  var end = s[0] + "T23:59:59.999Z";

  const {
    transferCode,
    proof,
    givenname,
    familyname,
    receiverGivenName,
    receiverFamilyName,
    mobile,
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
        Partner.findOne({ _id: cashier.partner_id }, (err, partner) => {
          CashierSend.findOne(
            {
              transaction_code: transferCode,
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
                      Bank.findOne(
                        {
                          _id: partner.bank_id,
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
                                  let data = new CashierClaim();
                                  data.transaction_code = transferCode;
                                  data.proof = proof;
                                  data.cashier_id = cashier._id;
                                  data.amount = otpd.amount;
                                  data.fee = otpd.fee;
                                  data.sender_name =
                                    givenname + " " + familyname;
                                  data.sender_mobile = mobile;
                                  data.receiver_name =
                                    receiverGivenName +
                                    " " +
                                    receiverFamilyName;
                                  var mns = bank.mobile.slice(-2);
                                  var mnr = branch.mobile.slice(-2);
                                  var now = new Date().getTime();
                                  var child_code = mns + "" + mnr + "" + now;
                                  var master_code = otpd.master_code;
                                  data.master_code = master_code;
                                  data.child_code = child_code + "1";

                                  const oamount = otpd.amount;
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
                                      const branchOpWallet =
                                        branch.code +
                                        "_partnerbranch_operational@" +
                                        bank.name;
                                      const bankEsWallet =
                                        "escrow@" + bank.name;
                                      let trans1 = {};
                                      trans1.from = bankEsWallet;
                                      trans1.to = branchOpWallet;
                                      trans1.amount = oamount;
                                      trans1.note = "Cashier claim Money";
                                      trans1.email1 = bank.email;
                                      trans1.email2 = branch.email;
                                      trans1.mobile1 = bank.mobile;
                                      trans1.mobile2 = branch.mobile;
                                      trans1.from_name = bank.name;
                                      trans1.to_name = branch.name;
                                      trans1.user_id = "";
                                      trans1.master_code = master_code;
                                      trans1.child_code = child_code;

                                      //Code by hatim

                                      //req
                                      //branchId
                                      //feeId
                                      //bankFee

                                      const find = {
                                        bank_id: partner.bank_id,
                                        trans_type: otpd.rule_type,
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
                                            message: "Revenue Rule Not Found",
                                          });
                                        } else {
                                          let fee = 0;

                                          fe.ranges.map((range) => {
                                            if (
                                              oamount >= range.trans_from &&
                                              oamount <= range.trans_to
                                            ) {
                                              temp =
                                                (oamount * range.percentage) /
                                                100;
                                              fee = temp + range.fixed_amount;
                                            }

                                            const {
                                              partner_share,
                                              specific_partner_share,
                                            } = fe.revenue_sharing_rule;
                                            let feeObject = partner_share;
                                            let claimFee = 0;

                                            if (
                                              specific_partner_share.length > 0
                                            ) {
                                              feeObject = specific_partner_share.filter(
                                                (bwsf) =>
                                                  bwsf.branch_code ==
                                                  branch.code
                                              )[0];
                                            }

                                            const { claim } = feeObject;
                                            claimFee = (claim * fee) / 100;

                                            const bankOpWallet =
                                              "operational@" + bank.name;
                                            let trans2 = {};
                                            trans2.from = bankOpWallet;
                                            trans2.to = branchOpWallet;
                                            //Replace the amount with the Claim Revenue below
                                            trans2.amount = claimFee;
                                            trans2.note =
                                              "Revenue for claim Money";
                                            trans2.email1 = branch.email;
                                            trans2.email2 = bank.email;
                                            trans2.mobile1 = branch.mobile;
                                            trans2.mobile2 = bank.mobile;
                                            trans2.from_name = branch.name;
                                            trans2.to_name = bank.name;
                                            trans2.user_id = "";
                                            trans2.master_code = master_code;
                                            trans2.child_code =
                                              data.child_code + "2";

                                            //End of hatim Code

                                            blockchain
                                              .transferThis(trans1, trans2)
                                              .then(function (result) {
                                                if (result.length <= 0) {
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
                                                              ) +
                                                              Number(oamount),
                                                            cash_in_hand:
                                                              Number(
                                                                cashier.cash_in_hand
                                                              ) -
                                                              Number(oamount),
                                                            fee_generated:
                                                              Number(
                                                                cashier.fee_generated
                                                              ) +
                                                              Number(claimFee),

                                                            total_trans:
                                                              Number(
                                                                cashier.total_trans
                                                              ) + 1,
                                                          },
                                                          function (e, v) {}
                                                        );
                                                        CashierLedger.findOne(
                                                          {
                                                            cashier_id:
                                                              cashier._id,
                                                            trans_type: "DR",
                                                            created_at: {
                                                              $gte: new Date(
                                                                start
                                                              ),
                                                              $lte: new Date(
                                                                end
                                                              ),
                                                            },
                                                          },
                                                          function (err, c) {
                                                            if (
                                                              err ||
                                                              c == null
                                                            ) {
                                                              let data = new CashierLedger();
                                                              data.amount = Number(
                                                                oamount
                                                              );
                                                              data.trans_type =
                                                                "DR";
                                                              data.cashier_id =
                                                                cashier._id;
                                                              data.save(
                                                                function (
                                                                  err,
                                                                  c
                                                                ) {}
                                                              );
                                                            } else {
                                                              var amt =
                                                                Number(
                                                                  c.amount
                                                                ) +
                                                                Number(oamount);
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
                                                  console.log(
                                                    result.toString()
                                                  );
                                                  res.status(200).json({
                                                    status: 0,
                                                    message:
                                                      "Something went wrong, please try again",
                                                  });
                                                }
                                              });
                                          });
                                        }
                                      });
                                    }
                                  }); //save
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
      }
    }
  );
});

router.post("/partnerCashier/listMerchants", jwtTokenAuth, function (req, res) {
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
          Merchant.find(
            { bank_id: partner.bank_id, status: 1 },
            "-password",
            (err, merchants) => {
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
                  message: "Merchants List",
                  list: merchants,
                });
              }
            }
          );
        });
      }
    }
  );
});

router.post("/partnerCashier/addClosingBalance", jwtTokenAuth, (req, res) => {
  const { denomination, total, note } = req.body;
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
        let data = new CashierLedger();
        data.amount = total;
        data.cashier_id = cashier._id;
        data.trans_type = "CB";
        let td = {
          denomination,
          note,
        };
        data.transaction_details = JSON.stringify(td);

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
              {
                closing_balance: total,
                closing_time: new Date(),
                is_closed: true,
              },
              function (e, v) {}
            );

            return res
              .status(200)
              .json({ status: 1, message: "Added closing balance" });
          }
        });
      }
    }
  );
});

router.post("/partnerCashier/getClosingBalance", jwtTokenAuth, function (
  req,
  res
) {
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
        let cb = 0,
          c = cashier;
        cb = c.closing_balance;
        da = c.closing_time;
        var diff = Number(cb) - Number(cashier.cash_in_hand);
        res.status(200).json({
          cashInHand: cashier.cash_in_hand,
          balance1: cb,
          balance2: diff,
          lastdate: da,
          transactionStarted: c.transaction_started,
          isClosed: c.is_closed,
        });
      }
    }
  );
});

router.post("/partnerCashier/getIncomingTransfer", jwtTokenAuth, function (
  req,
  res
) {
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
        CashierTransfer.find(
          {
            receiver_id: cashier._id,
            status: 0,
          },
          (e, data) => {
            res.status(200).json({
              status: 1,
              result: data,
            });
          }
        );
      }
    }
  );
});

router.post("/partnerCashier/getTransfers", jwtTokenAuth, function (req, res) {
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
        CashierTransfer.find({
          $or: [{ sender_id: cashier._id }, { receiver_id: cashier._id }],
        }).exec(function (err, b) {
          res.status(200).json({
            status: 1,
            history: b,
          });
        });
      }
    }
  );
});

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
                    {
                      $inc: { cash_in_hand: -Number(amount) },
                      cash_transferred: amount,
                    },
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

router.post("/partnerCashier/acceptIncoming", jwtTokenAuth, function (
  req,
  res
) {
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
            $inc: { cash_in_hand: Number(amount) },
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
                message: "Receiving partner cashier not found.",
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
                    message: "Accepted incoming cash",
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

router.post("/partnerCashier/cancelTransfer", jwtTokenAuth, function (
  req,
  res
) {
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
                      message: "No record of cashier transfer found",
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
                            message: "Sending cashier not found",
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

router.post("/partnerCashier/getUserByMobile", jwtTokenAuth, function (
  req,
  res
) {
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
    }
  );
});

router.post("/partnerCashier/checkNonWaltoWalFee", jwtTokenAuth, function (
  req,
  res
) {
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

router.post("/partnerCashier/getCashierTransLimit", jwtTokenAuth, function (
  req,
  res
) {
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

router.post("/partnerCashier/verifyOTPClaim", jwtTokenAuth, function (
  req,
  res
) {
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

router.post("/partnerCashier/sendMoneyPending", jwtTokenAuth, function (
  req,
  res
) {
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
        });
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
