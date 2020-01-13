const request = require('request');
const mongoose = require('mongoose');
const express = require('express');
const config = require('./config.json');

var formidable = require('formidable');
var path = require('path');
var fs = require('fs-extra')
var cors = require('cors');
const bodyParser = require('body-parser');
const logger = require('morgan');
const nodemailer = require("nodemailer");
const cookieParser = require('cookie-parser');

const Infra = require('./models/Infra');
const Fee = require('./models/Fee');
const User = require('./models/User');
const Bank = require('./models/Bank');
const OTP = require('./models/OTP');
const Profile = require('./models/Profile');
const Document = require('./models/Document');
const Branch = require('./models/Branch');

const API_PORT = 3001;
const mainFee = config.mainFee;
const defaultFee = config.defaultFee;
const defaultAmt = config.defaultAmt;

const app = express();
app.use(cors());
app.use(cookieParser());
app.use(express.static('public'));
const router = express.Router();

const dbRoute = 'mongodb://'+config.dbHost+':'+config.dbPort+'/'+config.dbName;
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
mongoose.set('useUnifiedTopology', true);
mongoose.connect(dbRoute, {
  useNewUrlParser: true
});

let db = mongoose.connection;
db.once('open', () => console.log('connected to the database'));
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

app.use(logger('dev'));
app.use(bodyParser.json({
  limit: '50mb'
}));
app.use(bodyParser.urlencoded({
  limit: '50mb',
  extended: true
}));


function makeid(length) {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function makeotp(length) {
  var result = '';
  var characters = '0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function sendSMS(content, mobile) {
  let url = "http://136.243.19.2/http-api.php?username=ewallet&password=bw@2019&senderid=EWALET&route=1&number=" + mobile + "&message=" + content;
  request(url, {
    json: true
  }, (err, res, body) => {
    if (err) {
      return err;
    }
    return body;
  });
}

function sendMail(content, subject, email) {
  console.log(content);
  let info = transporter.sendMail({
    from: '"E-Wallet" <no-reply@ewallet.com>', // sender address
    to: email, // list of receivers
    subject: subject, // Subject line
    text: "", // plain text body
    html: content // html body
  });
  return info;
}

function doRequest(options) {
  return new Promise(function (resolve, reject) {
    request(options, function (error, res, body) {
      if (!error && res.statusCode == 200) {
        resolve(body);
      } else {
        reject(error);
      }
    });
  });
  // return new Promise(resolve => {
  //   setTimeout(() => {
  //     resolve(options);
  //   }, 2000);
  // });
}

async function fileUpload(path) {
  const options = {
    method: "POST",
    uri: 'http://'+config.blockChainIP+':5001/api/v0/add',
    headers: {
      "Content-Type": "multipart/form-data"
    },
    formData: {
      "file": fs.createReadStream(path)
    }
  };
  let res = await doRequest(options);
  return res;
}

async function createWallet(arr, bank, infra) {
  var err = [];
  await Promise.all(arr.map(async (url) => {
    var options = {
      uri: 'http://'+config.blockChainIP+':8000/createEWallet',
      method: 'POST',
      json: {
        "wallet_id": url,
        "type": "test",
        "remarks": ""
      }
    };
    let res = await doRequest(options);

    if (res.Error) {
      err.push(res.Reason);
    } else {
      // let data = {};
      // let temp = url.split("@");
      // data.address = url;
      // data.type = temp[0];
      // data.infra_id = infra;
      // data.bank_id = bank;
      // data.balance = 0;
      // data.save((e, ) => {
      //   if (e) {
      //     err.push("failed to create " + url);
      //   }
      // });
    }

  }));
  return err.toString();
}




async function rechargeNow(arr) {
  var err = [];
  await Promise.all(arr.map(async (url) => {
    var options = {
      uri: 'http://'+config.blockChainIP+':8000/rechargeEWallet',
      method: 'POST',
      json: {
        "wallet_id": url.to.toString(),
        "amount": url.amount.toString(),
        "remarks": "recharge"
      }
    };
    console.log(options);
    let res = await doRequest(options);
    if (res != true) {
      err.push(res.Reason);
    }

  })).catch((errr) => {
    return errr;
  });
  return err.toString();
}


async function transferThis(t1, t2 = false, t3 = false) {
  var err = [];

  var url = t1;
  var options = {
    uri: 'http://'+config.blockChainIP+':8000/transferBtwEWallets',
    method: 'POST',
    json: {
      "wallet_id1": url.from.toString(),
      "wallet_id2": url.to.toString(),
      "amount": url.amount.toString(),
      "remarks": url.note.toString()
    }
  };

  let res = await doRequest(options);
  if (res != true) {
    err.push(res.Reason);
  }else{
    if (url.email1 && url.email1 != '') {
      sendMail("<p>You have sent " + url.amount + " to the wallet " + url.to + "</p>", "Payment Sent", url.email1);
    }
    if (url.email2 && url.email2 != '') {
      sendMail("<p>You have received " + url.amount + " from the wallet " + url.from + "</p>", "Payment Received", url.email2);
    }
    if (url.mobile1 && url.mobile1 != '') {
      sendSMS("You have sent " + url.amount + " to the wallet " + url.to, url.mobile1);
    }
    if (url.mobile2 && url.mobile2 != '') {
      sendSMS("You have received " + url.amount + " from the wallet " + url.from, url.mobile2);
    }
    if (t2) {
    url = t2;
    options = {
      uri: 'http://'+config.blockChainIP+':8000/transferBtwEWallets',
      method: 'POST',
      json: {
        "wallet_id1": url.from.toString(),
        "wallet_id2": url.to.toString(),
        "amount": url.amount.toString(),
        "remarks": url.note.toString()
      }
    };

    res = await doRequest(options);
    console.log("output 2: ");
    console.log(res);
    if (res != true) {
      err.push(res.Reason);
    }else{
      if (url.email1 && url.email1 != '') {
        sendMail("<p>You have sent " + url.amount + " to the wallet " + url.to + "</p>", "Payment Sent", url.email1);
      }
      if (url.email2 && url.email2 != '') {
        sendMail("<p>You have received " + url.amount + " from the wallet " + url.from + "</p>", "Payment Received", url.email2);
      }
      if (url.mobile1 && url.mobile1 != '') {
        sendSMS("You have sent " + url.amount + " to the wallet " + url.to, url.mobile1);
      }
      if (url.mobile2 && url.mobile2 != '') {
        sendSMS("You have received " + url.amount + " from the wallet " + url.from, url.mobile2);
      }


      if (t3) {
        url = t3;
        options = {
          uri: 'http://'+config.blockChainIP+':8000/transferBtwEWallets',
          method: 'POST',
          json: {
            "wallet_id1": url.from.toString(),
            "wallet_id2": url.to.toString(),
            "amount": url.amount.toString(),
            "remarks": url.note.toString()
          }
        };

        res = await doRequest(options);
        console.log("output 3: ");
        console.log(res);
        if (res != true) {
          err.push(res.Reason);
        }

        if (url.email1 && url.email1 != '') {
          sendMail("<p>You have sent " + url.amount + " to the wallet " + url.to + "</p>", "Payment Sent", url.email1);
        }
        if (url.email2 && url.email2 != '') {
          sendMail("<p>You have received " + url.amount + " from the wallet " + url.from + "</p>", "Payment Received", url.email2);
        }
        if (url.mobile1 && url.mobile1 != '') {
          sendSMS("You have sent " + url.amount + " to the wallet " + url.to, url.mobile1);
        }
        if (url.mobile2 && url.mobile2 != '') {
          sendSMS("You have received " + url.amount + " from the wallet " + url.from, url.mobile2);
        }
    }


    }
  }
  }





  return err.toString();
}

async function getStatement(arr) {

  var options = {
    uri: 'http://'+config.blockChainIP+':8000/getEWalletStatement',
    method: 'GET',
    json: {
      "wallet_id": arr.toString()
    }
  };

  let res = await doRequest(options);
  if (res.result && res.result == "success") {
    return res.payload;
  } else {
    return [];
  }

}


async function getBalance(arr) {

  var options = {
    uri: 'http://'+config.blockChainIP+':8000/showEWalletBalance',
    method: 'GET',
    json: {
      "wallet_id": arr.toString()
    }
  };

  let res = await doRequest(options);

  if (res.result && res.result == "success") {
    return res.payload.balance;
  } else {
    return 0;
  }

}

async function getTransactionCount(arr) {

  var options = {
    uri: 'http://'+config.blockChainIP+':8000/getEWalletTransactionCount',
    method: 'GET',
    json: {
      "wallet_id": arr.toString()
    }
  };

  let res = await doRequest(options);

  if (res.result && res.result == "success") {
    return res.payload;
  } else {
    return 0;
  }

}

let transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: "beyond.ewallet@gmail.com", // generated ethereal user
    pass: "beyondWallet2019" // generated ethereal password
  }
});

router.get('/testGet', function (req, res) {
  return res.status(200).json({
    status: 'Internal error please try again'
  });
});


/* Infra APIs start  */
router.post('/login', function (req, res) {
  const {
    username,
    password
  } = req.body;

  Infra.findOne({
    username: { $regex : new RegExp(username, "i") },
    password
  }, function (err, user) {
    console.log(user);
    if (err) {
      res.status(500)
        .json({
          error: 'Internal error please try again'
        });
    } else if (!user) {
      res.status(401)
        .json({
          error: 'Incorrect username or password'
        });
    } else {
      let token = makeid(10);
      Infra.findByIdAndUpdate(user._id, {
        token: token
      }, (err) => {
        if (err) return res.status(400).json({
          error: err
        });

        if (user.profile_id && user.profile_id != '') {
          Profile.findOne({
            "_id": user.profile_id
          }, function (err, profile) {

            var p = JSON.parse(profile.permissions);
            res.status(200).json({
              token: token,
              permissions: profile.permissions,
              name: user.name,
              isAdmin: user.isAdmin,
              initial_setup: user.initial_setup,
            });
          })
        } else {
          if (user.isAdmin) {
            res.status(200).json({
              token: token,
              permissions: 'all',
              name: user.name,
              isAdmin: user.isAdmin,
              initial_setup: user.initial_setup,
            });
          } else {
            res.status(200).json({
              token: token,
              permissions: '',
              name: user.name,
              isAdmin: user.isAdmin,
              initial_setup: user.initial_setup,
            });
          }

        }

      });



      // Issue token
      //  const payload = { username };
      //  const token = jwt.sign(payload, secret, {
      //    expiresIn: '1h'
      //  });
      //  res.cookie('token', token, { httpOnly: true })
      //    .sendStatus(200);

      //  user.isCorrectPassword(password, function(err, same) {

      //       if (err) {
      //         res.status(500)
      //           .json({
      //             error: 'Internal error please try again'
      //         });
      //       } else if (!same) {
      //         res.status(401)
      //           .json({
      //             error: 'Incorrect email or password 3'
      //         });
      //       } else {
      //         res.status(200)
      //         .json({
      //           error: 'Isdf'
      // });
      //         // Issue token
      //         // const payload = { email };
      //         // const token = jwt.sign(payload, secret, {
      //         //   expiresIn: '1h'
      //         // });
      //         // res.cookie('token', token, { httpOnly: true })
      //         //   .sendStatus(200);
      //         res.status(200)
      //         .json({
      //           success: 'Success'
      //       });
      //    }
      //});
    }
  });
});

router.post('/getPermission', function (req, res) {
  const {
   token
  } = req.body;

  Infra.findOne({
    token
  }, function (err, user) {

    if (err) {
      res.status(500)
        .json({
          error: 'Internal error please try again'
        });
    } else if (!user) {
      res.status(401)
        .json({
          error: 'Incorrect username or password'
        });
    } else {

      if (user.profile_id && user.profile_id != '') {
        Profile.findOne({
          "_id": user.profile_id
        }, function (err, profile) {

          var p = JSON.parse(profile.permissions);
          res.status(200).json({
            token: token,
            permissions: p,
            name: user.name,
            isAdmin: user.isAdmin,
            initial_setup: user.initial_setup,
          });
        })
      } else {
        if (user.isAdmin) {
          res.status(200).json({
            token: token,
            permissions: 'all',
            name: user.name,
            isAdmin: user.isAdmin,
            initial_setup: user.initial_setup,
          });
        } else {
          res.status(200).json({
            token: token,
            permissions: '',
            name: user.name,
            isAdmin: user.isAdmin,
            initial_setup: user.initial_setup,
          });
        }

      }

    }
  });
});

router.get('/checkInfra', function (req, res) {

  Infra.countDocuments({}, function (err, c) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {

      res.status(200)
        .json({
          infras: c
        });

    }
  });
});

router.get('/getInfraOperationalBalance', function (req, res) {
  const {
    bank
  } = req.query;
  Bank.findOne({
    "_id": bank
  }, function (err, ba) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {
      const wallet_id = "infra_operational@" + ba.name;

      getBalance(wallet_id).then(function (result) {
        res.status(200).json({
          status: 'success',
          balance: result
        });
      });

    }
  });
});

router.get('/getBankOperationalBalance', function (req, res) {
  const {
    bank
  } = req.query;
  console.log(bank);
  Bank.findOne({
    token: bank
  }, function (err, ba) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {
      const wallet_id = "operational@" + ba.name;

      getBalance(wallet_id).then(function (result) {
        res.status(200).json({
          status: 'success',
          balance: result
        });
      });

    }
  });
});

router.get('/getInfraMasterBalance', function (req, res) {
  const {
    bank
  } = req.query;
  Bank.findOne({
    "_id": bank
  }, function (err, ba) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {
      const wallet_id = "infra_master@" + ba.name;

      getBalance(wallet_id).then(function (result) {
        res.status(200).json({
          status: 'success',
          balance: result
        });
      });
    }
  });
});

router.post('/getDashStats', function (req, res) {
  const {
    token
  } = req.body;
  Infra.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {

      const user_id = user._id;
      // console.log(user_id);
      // if (user.isAdmin) {
        Bank.countDocuments({
        }, function (err, bank) {
          if (err) {
            res.status(402)
              .json({
                error: err
              });
          } else {
            res.status(200)
              .json({
                totalBanks: bank
              });
          }
        });
      // } else {
      //   Bank.countDocuments({
      //     "user_id": user_id
      //   }, function (err, bank) {
      //     if (err) {
      //       res.status(402)
      //         .json({
      //           error: err
      //         });
      //     } else {
      //       res.status(200)
      //         .json({
      //           totalBanks: bank
      //         });
      //     }
      //   });
      // }


    }
  });
});

router.post('/addBank', (req, res) => {
  let data = new Bank();
  const {
    name,
    bcode,
    address1,
    state,
    zip,
    country,
    ccode,
    mobile,
    email,
    token,
    logo,
    contract,
    otp_id,
    otp
  } = req.body;
  Infra.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {
      // const user_id = user._id;
      OTP.findOne({
        "_id": otp_id,
        otp: otp
      }, function (err, otpd) {
        if (err) {
          res.status(401)
            .json({
              error: err
            });
        } else {
          if (!otpd) {
            res.status(401)
              .json({
                error: 'OTP Missmatch'
              });
          }else{
          if (otpd.otp == otp) {

            if (name == '' || address1 == '' || state == '' || mobile == '' || email == '') {
              return res.status(402)
                .json({
                  error: 'Please provide valid inputs'
                });
            }

            data.name = name;
            data.bcode = bcode;
            data.address1 = address1;
            data.state = state;
            data.country = country;
            data.zip = zip;
            data.ccode = ccode;
            data.mobile = mobile;
            data.username = mobile;
            data.email = email;
            data.user_id = user._id;
            data.logo = logo;
            data.contract = contract;
            data.password = makeid(10);

            data.save((err, d) => {
              if (err) return res.json({
                error: "Duplicate entry!"
              });

              let data2 = new Document();
              data2.bank_id = d._id;
              data2.contract = contract;
              data2.save((err, ) => {

              });

              let content = "<p>Your bank is added in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://"+config.mainIP+"/bank'>http://"+config.mainIP+"/bank</a></p><p><p>Your username: " + data.username + "</p><p>Your password: " + data.password + "</p>";
              sendMail(content, "Bank Account Created", email);
              let content2 = "Your bank is added in E-Wallet application Login URL: http://"+config.mainIP+"/bank Your username: " + data.username + " Your password: " + data.password;
              sendSMS(content2, mobile);

              return res.status(200).json(data);
            });
          } else {
            res.status(200)
              .json({
                error: 'OTP Missmatch'
              });
          }
        }
        }
      });
    }

  });
});

router.post('/addBranch', (req, res) => {
  let data = new Branch();
  const {
    name,
    bcode,
    username,
    credit_limit,
    address1,
    state,
    zip,
    country,
    ccode,
    mobile,
    email,
    token
  } = req.body;

  Bank.findOne({
    token
  }, function (err, bank) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {

            data.name = name;
            data.bcode = bcode;
            if(credit_limit == '' || credit_limit == null){
              data.credit_limit = credit_limit;
            }
            data.username = username;
            data.address1 = address1;
            data.state = state;
            data.country = country;
            data.zip = zip;
            data.ccode = ccode;
            data.mobile = mobile;
            data.email = email;
            data.bank_id = bank._id;
            data.password = makeid(10);

            data.save((err, d) => {
              if (err) return res.json({
                error: "Duplicate entry!"
              });

              let content = "<p>Your bracnch is added in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://"+config.mainIP+"/branch'>http://"+config.mainIP+"/branch</a></p><p><p>Your username: " + data.username + "</p><p>Your password: " + data.password + "</p>";
              sendMail(content, "Bank Account Created", email);
              let content2 = "Your branch is added in E-Wallet application Login URL: http://"+config.mainIP+"/branch Your username: " + data.username + " Your password: " + data.password;
              sendSMS(content2, mobile);
              return res.status(200).json(data);
            });

        }
      });
});


router.post('/editBank', (req, res) => {
  let data = new Bank();
  const {
    bank_id,
    name,
    bcode,
    address1,
    state,
    zip,
    country,
    ccode,
    mobile,
    email,
    token,
    logo,
    contract,
    otp_id,
    otp
  } = req.body;

  Infra.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {
      // const user_id = user._id;
      OTP.findOne({
        _id: otp_id,
        otp: otp
      }, function (err, otpd) {
        if (err || !otpd) {
          res.status(401)
            .json({
              error: err
            });
        } else {
          if (otpd.otp == otp) {

            if (name == '' || address1 == '' || state == '' || mobile == '' || email == '') {
              return res.status(402)
                .json({
                  error: 'Please provide valid inputs'
                });
            }

            data.name = name;
            data.address1 = address1;
            data.state = state;
            data.country = country;
            data.bcode = bcode;
            data.zip = zip;
            data.ccode = ccode;
            data.mobile = mobile;
            data.username = mobile;
            data.email = email;
            data.user_id = user._id;
            data.logo = logo;
            data.contract = contract;
            data.password = makeid(10);
            Bank.findByIdAndUpdate(bank_id, {
              name: name,
              address1: address1,
              state: state,
              zip: zip,
              ccode: ccode,
              bcode: bcode,
              country: country,
              mobile: mobile,
              email: email,
              logo: logo,
              contract: contract
            }, (err) => {
              if (err) return res.status(400).json({
                error: err
              });

              let data2 = new Document();
              data2.bank_id = bank_id;
              data2.contract = contract;
              data2.save((err, ) => {

              });
              return res.status(200).json(data);
            });
            // data.save((err, ) => {
            //   if (err) return res.json({
            //     error: "Duplicate entry!"
            //   });

            // let content = "<p>Your bank is added in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://"+config.mainIP+"/bank'>http://"+config.mainIP+"/bank</a></p><p><p>Your username: " + data.username + "</p><p>Your password: " + data.password + "</p>";
            // sendMail(content, "Bank Account Created", email);

            //return res.status(200).json(data);
            //});
          } else {
            res.status(200)
              .json({
                error: 'OTP Missmatch'
              });
          }
        }
      });
    }

  });
});


router.post('/editBranch', (req, res) => {
  let data = new Branch();
  const {
    branch_id,
    name,
    username,
    credit_limit,
    bcode,
    address1,
    state,
    zip,
    country,
    ccode,
    mobile,
    email,
    token
  } = req.body;

  Bank.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {


            Branch.findByIdAndUpdate(branch_id, {
              name: name,
              credit_limit: credit_limit,
              username: username,
              address1: address1,
              state: state,
              zip: zip,
              ccode: ccode,
              bcode: bcode,
              country: country,
              mobile: mobile,
              email: email
            }, (err) => {
              if (err) return res.status(400).json({
                error: err
              });

              return res.status(200).json(data);
            });

    }

  });
});

router.post('/editBankBank', (req, res) => {
  let data = new Bank();
  const {
    bank_id,
    name,
    bcode,
    address1,
    state,
    zip,
    country,
    ccode,
    mobile,
    email,
    token,
    logo,
    contract,
    otp_id,
    otp
  } = req.body;

  // const user_id = user._id;
  OTP.findOne({
    _id: otp_id,
    otp: otp
  }, function (err, otpd) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {
      if (otpd.otp == otp) {

        if (name == '' || address1 == '' || state == '' || mobile == '' || email == '') {
          return res.status(402)
            .json({
              error: 'Please provide valid inputs'
            });
        }

        Bank.findByIdAndUpdate(bank_id, {
          name: name,
          bcode: bcode,
          address1: address1,
          state: state,
          zip: zip,
          ccode: ccode,
          bcode: bcode,
          mobile: mobile,
          country: country,
          email: email,
          logo: logo,
          contract: contract
        }, (err) => {
          if (err) return res.status(400).json({
            error: err
          });

          let data2 = new Document();
          data2.bank_id = bank_id;
          data2.contract = contract;
          data2.save((err, ) => {

          });
          return res.status(200).json({
            success: true
          });
        });
        // data.save((err, ) => {
        //   if (err) return res.json({
        //     error: "Duplicate entry!"
        //   });

        // let content = "<p>Your bank is added in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://"+config.mainIP+"/bank'>http://"+config.mainIP+"/bank</a></p><p><p>Your username: " + data.username + "</p><p>Your password: " + data.password + "</p>";
        // sendMail(content, "Bank Account Created", email);

        //return res.status(200).json(data);
        //});
      } else {
        res.status(200)
          .json({
            error: 'OTP Missmatch'
          });
      }
    }
  });

});

router.post('/addProfile', (req, res) => {
  let data = new Profile();
  const {
    pro_name,
    pro_description,
    create_bank,
    edit_bank,
    create_fee,
    token
  } = req.body;
  Infra.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {
      const user_id = user._id;

      data.name = pro_name;
      data.description = pro_description;
      var c = {
        create_bank,
        edit_bank,
        create_fee
      };
      data.permissions = JSON.stringify(c);
      data.user_id = user_id;

      data.save((err, ) => {
        if (err) return res.json({
          error: err.toString()
        });


        return res.status(200).json({
          success: "True"
        });
      });

    }

  });
});


router.post('/editProfile', (req, res) => {
  let data = new Profile();
  const {
    pro_name,
    pro_description,
    create_bank,
    edit_bank,
    create_fee,
    profile_id,
    token
  } = req.body;
  Infra.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {


      var _id = profile_id;
      console.log(_id);
      var c = {
        create_bank,
        edit_bank,
        create_fee
      };
      let c2 = JSON.stringify(c);
      Profile.findOneAndUpdate({
        "_id": _id
      }, {
        name: pro_name,
        description: pro_description,
        permissions: c2
      }, (err, d) => {
        if (err) return res.status(400).json({
          error: err
        });
        console.log(d);
        return res.status(200).json({
          success: true
        });
      });

    }

  });
});


router.post('/addInfraUser', (req, res) => {
  let data = new Infra();
  const {
    name,
    email,
    mobile,
    username,
    password,
    profile_id,
    logo,
    token
  } = req.body;
  Infra.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {

      data.name = name;
      data.email = email;
      data.mobile = mobile;
      data.username = username;
      data.password = password;
      data.profile_id = profile_id;
      data.logo = logo;
      console.log(data);
      data.save((err, ) => {
        if (err) return res.json({
          error: "Email / Username/ Mobile already exist!"
        });
        let content = "<p>Your have been added as Infra in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://"+config.mainIP+"/'>http://"+config.mainIP+"/</a></p><p><p>Your username: " + username + "</p><p>Your password: " + password + "</p>";
        sendMail(content, "Infra Account Created", email);
        let content2 = "Your have been added as Infra in E-Wallet application Login URL: http://"+config.mainIP+" Your username: " + username + " Your password: " + password;
        sendSMS(content2, mobile);
        return res.status(200).json({
          success: "True"
        });
      });

    }

  });
});

router.post('/editInfraUser', (req, res) => {
  const {
    name,
    email,
    mobile,
    username,
    password,
    profile_id,
    logo,
    user_id,
    token
  } = req.body;
  Infra.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {


      var _id = user_id;
      console.log(_id);
      Infra.findOneAndUpdate({
        "_id": _id
      }, {
        name: name,
        email: email,
        mobile: mobile,
        username: username,
        password: password,
        profile_id: profile_id,
        logo: logo
      }, (err, d) => {
        if (err) return res.status(400).json({
          error: err
        });
        console.log(d);
        return res.status(200).json({
          success: true
        });
      });

    }

  });
});

router.get('/infraTopup', (req, res) => {
  const {
    amount,
    bank
  } = req.query;
  Infra.findOne({
    name: "Infra Admin"
  }, function (err, infra) {
    const infra_email = infra.email;
    const infra_mobile = infra.mobile;

    if (err) return res.status(401);
    Bank.findOne({
      name: bank
    }, function (err, ba) {

      const bank_email = ba.email;
      const bank_mobile = ba.mobile;
      if (err) return res.status(401);

      let data = {};

      let fee = (amount * mainFee / 100);
      var temp = fee * defaultFee / 100;
       let fee3 = temp + defaultAmt;

      data.amount = (amount - fee).toString();
      data.from = "recharge";
      data.to = ("testuser@" + ba.name).toString();
      const bank = ba.name;

      getTransactionCount(data.to).then(function (count) {
        count = Number(count)+1;
        Fee.findOne({
         bank_id: ba._id,
         trans_type: "Wallet to Wallet",
         status: 1,
         active: 'Active'
   }, function (err, fe) {

     if (!fe || fe == null) {
      res.status(200).json({
        status: "No revenue rule found, transaction Failed!"
      });
     } else {
       var ranges = JSON.parse(fe.ranges);
       if(ranges.length > 0){

       ranges.map(function(v) {

         if(Number(count) >= Number(v.trans_from) && Number(count) <= Number(v.trans_to)){
           var temp = fee * Number(v.percentage) / 100;
           fee3 = temp + Number(v.fixed_amount);
           console.log(fee3);
         }

       });
     }
     rechargeNow([data]).then(function (result) {

      let data2 = {};
      data2.amount = fee.toString();
      data2.from = "testuser@"+bank;
      data2.to = "operational@" + bank;
      data2.note = "commission";
      data2.email2 = bank_email;
      data2.mobile2 = bank_mobile;

      let data3 = {};
      data3.amount = fee3.toString();
      data3.from = "operational@" + bank;
      data3.to = "infra_operational@" + bank;
      data3.note = "operational commission";
      data3.email1 = bank_email;
      data3.email2 = infra_email;
      data3.mobile1 = bank_mobile;
      data3.mobile2 = infra_mobile;

      // console.log(data);
      // console.log(data2);
      // console.log(data3);
      // transferNow([data, data2, data3]).then(function(result) {

      // });
      transferThis(data2, data3).then(function (result) {
        console.log(result);
        });
        res.status(200).json({
         status: result + " Transfer initiated and will be notified via email and sms"
       });

      });
     }

       // res.status(200).json({
       //   status: fee3
       // });


    });

     });

      // rechargeNow([data]).then(function (result) {

      //   let data2 = {};
      //   data2.amount = fee.toString();
      //   data2.from = "testuser@" + ba.name;
      //   data2.to = "operational@" + ba.name;
      //   data2.note = "recharge commission";
      //   data2.email2 = bank_email;
      //   data2.mobile2 = bank_mobile;

      //   let data3 = {};
      //   data3.amount = fee3.toString();
      //   data3.from = "operational@" + ba.name;
      //   data3.to = "infra_operational@" + ba.name;
      //   data3.note = "commission";
      //   data3.email1 = bank_email;
      //   data3.email2 = infra_email;
      //   data3.mobile1 = bank_mobile;
      //   data3.mobile2 = infra_mobile;

      //   // transferNow([data2, data3]).then(function(result) {

      //   // });
      //   transferThis(data2, data3).then(function (result) {
      //     console.log(result);
      //   });

      //   res.status(200).json({
      //     status: result + " Transfer initiated and will be notified via email and sms"
      //   });
      // });

    });

  });
});

router.post('/createRules', (req, res) => {
  let data = new Fee();
  const {
    name,
    trans_type,
    active,
    ranges,
    bank_id,
    token
  } = req.body;
  Infra.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {

      Bank.findOne({
        "_id": bank_id
      }, function (err, bank) {
        if (err) {
          res.status(401)
            .json({
              error: err
            });
        } else {
          data.bank_id = bank_id;
          data.user_id = user._id;
          data.name = name;
          data.trans_type = trans_type;
          data.active = active;
          data.ranges = JSON.stringify(ranges);
          data.editedRanges = JSON.stringify(ranges);

          Fee.findOne({
            "trans_type": trans_type,
            "bank_id" : bank_id
          }, function (err, fee) {
            if(fee == null){
              data.save((err, ) => {
                if (err) return res.status(400).json({
                  error: err
                });
                let content = "<p>New fee rule has been added for your bank in E-Wallet application</p><p>&nbsp;</p><p>Fee Name: " + name + "</p>";
                let result = sendMail(content, "New Rule Added", bank.email);
                let content2 = "New fee rule has been added for your bank in E-Wallet application Fee Name: " + name;
                sendSMS(content2, bank.mobile);
                res.status(200)
                  .json({
                    success: true
                  });
              });

            }else{
              res.status(400)
              .json({
                error: "This rule type already exists for this bank"
              });
            }

          });
        }
      });
    }
  });
});

router.post('/editRule', (req, res) => {

  const {
    name,
    trans_type,
    active,
    ranges,
    token,
    bank_id,
    rule_id

  } = req.body;
  Infra.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {

      Bank.findOne({
        "_id": bank_id
      }, function (err, bank) {
        if (err) {
          res.status(401)
            .json({
              error: err
            });
        } else {

          // Fee.findOne({
          //   "trans_type": trans_type,
          //   "bank_id" : bank_id
          // }, function (err, fee) {


          // });

          Fee.findByIdAndUpdate({
            "_id": rule_id
          }, {
            name: name,
            trans_type: trans_type,
            active: active,
            editedRanges: JSON.stringify(ranges),
            edit_status: 0
          }, (err) => {
            if (err) return res.status(400).json({
              error: err
            });
            let content = "<p>Rule " + name + " has been updated, check it out</p>";
            let result = sendMail(content, "Rule Updated", bank.email);
            let content2 = "Rule " + name + " has been updated, check it out";
            sendSMS(content2, bank.mobile);
            res.status(200).json({
              status: true
            });
          });
        }

      });
    }

  });
});

router.post('/getBank', function (req, res) {
  //res.send("hi");
  const {
    token,
    bank_id
  } = req.body;
  Infra.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {

      Bank.findOne({
        _id: bank_id
      }, function (err, bank) {
        if (err) {
          res.status(404)
            .json({
              error: err
            });
        } else {
          res.status(200)
            .json({
              banks: bank
            });
        }
      });

    }
  });
});

router.post('/getBranch', function (req, res) {
  //res.send("hi");
  const {
    token,
    branch_id
  } = req.body;
  Bank.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {

      Branch.findOne({
        _id: branch_id
      }, function (err, branch) {
        if (err) {
          res.status(404)
            .json({
              error: err
            });
        } else {
          res.status(200)
            .json({
              branches: branch
            });
        }
      });

    }
  });
});

router.post('/getWalletsOperational', function (req, res) {
  //res.send("hi");
  const {
    token,
    bank_id
  } = req.body;


  Bank.findOne({
    "_id": bank_id
  }, function (err, bank) {
    if (err) {
      res.status(500)
        .json({
          error: err
        });
    } else {
      res.status(200)
        .json({
          from: 'infra_operational@' + bank.name,
          to: 'infra_master@' + bank.name,
        });
    }
  });

});


router.post('/getWalletsMaster', function (req, res) {
  //res.send("hi");
  const {
    token,
    bank_id
  } = req.body;


  Bank.findOne({
    "_id": bank_id
  }, function (err, bank) {
    if (err) {
      res.status(500)
        .json({
          error: err
        });
    } else {
      res.status(200)
        .json({
          from: 'infra_master@' + bank.name,
          to: 'master@' + bank.name,
        });
    }
  });

});

router.post('/getRules', function (req, res) {
  //res.send("hi");
  const {
    token,
    bank_id
  } = req.body;
  Infra.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {
      const user_id = user._id;
      // if (user.isAdmin) {
        Fee.find({
          bank_id
        }, function (err, rules) {
          if (err) {
            res.status(404)
              .json({
                error: err
              });
          } else {
            res.status(200)
              .json({
                rules: rules
              });
          }
        });
      // } else {
      //   Fee.find({
      //     user_id,
      //     bank_id
      //   }, function (err, rules) {
      //     if (err) {
      //       res.status(404)
      //         .json({
      //           error: err
      //         });
      //     } else {
      //       res.status(200)
      //         .json({
      //           rules: rules
      //         });
      //     }
      //   });
      // }

    }
  });
});

router.post('/getRule', function (req, res) {
  //res.send("hi");
  const {
    token,
    rule_id
  } = req.body;
  Infra.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {
      const user_id = user._id;

      Fee.findOne({
        "_id": rule_id
      }, function (err, rules) {
        if (err) {
          res.status(404)
            .json({
              error: err
            });
        } else {
          res.status(200)
            .json({
              rules: rules
            });
        }
      });



    }
  });
});

// router.post('/getDocs', function (req, res) {
//   //res.send("hi");
//   const {
//     token,
//     bank_id
//   } = req.body;
//   Infra.findOne({
//     token
//   }, function (err, user) {
//     if (err) {
//       res.status(401)
//         .json({
//           error: err
//         });
//     } else {
//       const user_id = user._id;
//       Document.find({
//         bank_id
//       }, function (err, rules) {
//         console.log(rules);
//         if (err) {
//           res.status(404)
//             .json({
//               error: err
//             });
//         } else {
//           res.status(200)
//             .json({
//               docs: rules
//             });
//         }
//       });

//     }
//   });
// });

router.post('/bankStatus', function (req, res) {
  //res.send("hi");
  const {
    token,
    status,
    bank_id
  } = req.body;

  Infra.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {

      Bank.findByIdAndUpdate(bank_id, {
        status: status
      }, (err) => {
        if (err) return res.status(400).json({
          error: err
        });
        res.status(200).json({
          status: true
        });
      });

    }
  });

});

router.post('/branchStatus', function (req, res) {
  //res.send("hi");
  const {
    token,
    status,
    branch_id
  } = req.body;

  Bank.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {

      Branch.findByIdAndUpdate(branch_id, {
        status: status
      }, (err) => {
        if (err) return res.status(400).json({
          error: err
        });
        res.status(200).json({
          status: true
        });
      });

    }
  });

});

router.post('/getDocs', function (req, res) {
  //res.send("hi");
  const {
    bank_id
  } = req.body;
  Document.find({
    bank_id
  }, function (err, user) {
    if (err) {
      res.status(404)
        .json({
          error: err
        });
    }
    res.status(200)
      .json({
        docs: user
      });
  });
});

router.post('/getBankRules', function (req, res) {
  //res.send("hi");
  const {
    bank_id
  } = req.body;
  Bank.findOne({
    _id: bank_id
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {
      Fee.find({
        bank_id
      }, function (err, rules) {
        if (err) {
          res.status(404)
            .json({
              error: err
            });
        } else {
          res.status(200)
            .json({
              rules: rules
            });
        }
      });

    }
  });
});

router.post('/approveFee', function (req, res) {
  //res.send("hi");
  const {
    token,
    id
  } = req.body;
  Bank.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {

      Fee.findOne({
        "_id": id
      }, function (err, fee) {
      Fee.findByIdAndUpdate(id, {
        status: 1,
        edit_status: 1,
        ranges: fee.editedRanges
      }, (err) => {
        if (err) return res.status(402).json({
          error: err
        });
        res.status(200)
          .json({
            success: 'Updated successfully'
          });
      });
      });


    }
  });
});

router.post('/declineFee', function (req, res) {
  //res.send("hi");
  const {
    token,
    id
  } = req.body;
  Bank.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {

      Fee.findByIdAndUpdate(id, {
        status: 2,
        edit_status: 2
      }, (err) => {
        if (err) return res.status(402).json({
          error: err
        });
        res.status(200)
          .json({
            success: 'Updated successfully'
          });
      });

    }
  });
});

router.post('/getBanks', function (req, res) {
  //res.send("hi");
  const {
    token
  } = req.body;
  Infra.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {
      const user_id = user._id;
      // if (user.isAdmin) {
        Bank.find({}, function (err, bank) {
          if (err) {
            res.status(404)
              .json({
                error: err
              });
          } else {
            res.status(200)
              .json({
                banks: bank
              });
          }
        });
      // } else {
      //   Bank.find({
      //     user_id
      //   }, function (err, bank) {
      //     if (err) {
      //       res.status(404)
      //         .json({
      //           error: err
      //         });
      //     } else {
      //       res.status(200)
      //         .json({
      //           banks: bank
      //         });
      //     }
      //   });
      // }


    }
  });
});

router.post('/getBranches', function (req, res) {

  const {
    token
  } = req.body;
  Bank.findOne({
    token
  }, function (err, bank) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {
      const bank_id = bank._id;
      // if (user.isAdmin) {
        Branch.find({bank_id : bank_id}, function (err, branch) {
          if (err) {
            res.status(404)
              .json({
                error: err
              });
          } else {
            res.status(200)
              .json({
                branches: branch
              });
          }
        });

    }
  });
});

router.post('/getRoles', function (req, res) {
  //res.send("hi");
  const {
    token
  } = req.body;
  Infra.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {
      const user_id = user._id;
      Profile.find({
        user_id
      }, function (err, bank) {
        if (err) {
          res.status(404)
            .json({
              error: err
            });
        } else {
          res.status(200)
            .json({
              roles: bank
            });
        }
      });

    }
  });
});

router.post('/getInfraUsers', function (req, res) {
  //res.send("hi");
  const {
    token
  } = req.body;
  Infra.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {
      const user_id = user._id;
      Infra.find({

      }, function (err, bank) {
        if (err) {
          res.status(404)
            .json({
              error: err
            });
        } else {
          res.status(200)
            .json({
              users: bank
            });
        }
      });

    }
  });
});

router.post('/getProfile', function (req, res) {
  //res.send("hi");
  const {
    token
  } = req.body;
  Infra.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {

          res.status(200)
            .json({
              users: user
            });


    }
  });
});

router.post('/editInfraProfile', function (req, res) {
  const {
    name,
    username,
    email,
    mobile,
    password,
    ccode,
    token
  } = req.body;
  Infra.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {
      let upd = {};
      console.log(password);
      if(password == '' || password == undefined || password == null){
        upd = {
          name: name,
          email: email,
          mobile: mobile,
          username: username,
          ccode: ccode,
        };
      }else{
        upd = {
          name: name,
          email: email,
          mobile: mobile,
          password: password,
          username: username,
          ccode: ccode,
        };
      }

      Infra.findByIdAndUpdate(user._id, upd, (err) => {
        if (err) return res.status(400).json({
          error: err
        });
        res.status(200).json({
          success: true
        });
      });
    }
  });
});

router.post('/setupUpdate', function (req, res) {
  let data = new Infra();
  const {
    username,
    password,
    email,
    mobile,
    ccode
  } = req.body;

  data.name = "Infra Admin";
  data.username = username;
  console.log(username);
  data.password = password;
  data.mobile = mobile;
  data.email = email;
  data.ccode = ccode;
  data.isAdmin = true;

  data.save((err, ) => {
    if (err) return res.json({
      error: err.toString()
    });
    let content = "<p>Your Infra account is activated in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://"+config.mainIP+"'>http://"+config.mainIP+"</a></p><p><p>Your username: " + data.username + "</p><p>Your password: " + data.password + "</p>";
    let result = sendMail(content, "Infra Account Activated", data.email);
    let content2 = "Your Infra account is activated in E-Wallet application. Login URL: http://"+config.mainIP+" Your username: " + data.username + " Your password: " + data.password;
    sendSMS(content2, mobile);
    res.status(200)
      .json({
        success: true
      });
  });

});
/* Infra APIs end  */


/* Bank APIs start */
router.post('/bankLogin', function (req, res) {
  const {
    username,
    password
  } = req.body;
  Bank.findOne({
    username,
    password
  }, function (err, bank) {

    if (err) {
      res.status(500)
        .json({
          error: 'Internal error please try again'
        });
    } else if (!bank) {
      res.status(401)
        .json({
          error: 'Incorrect username or password'
        });
    } else if (bank.status == -1) {
      res.status(401)
        .json({
          error: 'Your account has been blocked, pls contact the admin!'
        });
    } else {
      let token = makeid(10);

      Bank.findByIdAndUpdate(bank._id, {
        token: token
      }, (err) => {
        if (err) return res.status(400).json({
          error: err
        });
        res.status(200).json({
          token: token,
          name: bank.name,
          initial_setup: bank.initial_setup,
          username: bank.username,
          status: bank.status,
          contract: bank.contract,
          logo: bank.logo,
          id: bank._id
        });
      });

    }
  });
});

router.post('/bankActivate', function (req, res) {
  const {
    token
  } = req.body;
  Bank.findOne({
    token
  }, function (err, bank) {
    if (err) {
      res.status(500)
        .json({
          error: 'Internal error please try again'
        });
    } else if (!bank) {
      res.status(401)
        .json({
          error: 'Account not found'
        });
    } else {
      Bank.findByIdAndUpdate(bank._id, {
        status: 1
      }, (err) => {
        if (err) return res.status(400).json({
          error: err
        });

        createWallet(['testuser@' + bank.name, 'operational@' + bank.name, 'escrow@' + bank.name, 'master@' + bank.name, 'infra_operational@' + bank.name, 'infra_master@' + bank.name], bank._id, bank.user_id).then(function (result) {
          res.status(200).json({
            status: 'activated',
            walletStatus: result
          });
        });



      });

    }
  });
});

router.post('/bankSetupUpdate', function (req, res) {
  const {
    username,
    password,
    token
  } = req.body;
  Bank.findOne({
    token
  }, function (err, bank) {
    if (err) {
      res.status(500)
        .json({
          error: 'Internal error please try again'
        });
    } else if (!bank) {
      res.status(401)
        .json({
          error: 'Incorrect username or password'
        });
    } else {
      Bank.findByIdAndUpdate(bank._id, {
        username: username,
        password: password,
        initial_setup: true
      }, (err) => {
        if (err) return res.status(400).json({
          error: err
        });
        res.status(200)
          .json({
            success: 'Updated successfully'
          });
      });
    }
  });
});

router.post('/infraSetupUpdate', function (req, res) {
  const {
    username,
    password,
    token
  } = req.body;
  Infra.findOne({
    token
  }, function (err, bank) {
    if (err) {
      res.status(500)
        .json({
          error: 'Internal error please try again'
        });
    } else if (!bank) {
      res.status(401)
        .json({
          error: 'Incorrect username or password'
        });
    } else {
      Infra.findByIdAndUpdate(bank._id, {
        username: username,
        password: password
      }, (err) => {
        if (err) return res.status(400).json({
          error: err
        });
        res.status(200)
          .json({
            success: 'Updated successfully'
          });
      });
    }
  });
});

router.post('/bankForgotPassword', function (req, res) {
  //res.send("hi");
  let data = new OTP();
  const {
    mobile
  } = req.body;
  Bank.findOne({
    mobile: mobile
  }, function (err, bank) {
    if (err || bank == null) {
      res.status(401)
        .json({
          error: 'Account not found!'
        });
    } else {
      data.user_id = bank._id;
      data.otp = makeotp(6);
      data.page = 'bankForgotPassword';
      data.mobile = mobile;

      data.save((err, ) => {
        if (err) return res.status(400).json({
          error: err
        });

        let content = "Your OTP to change password is " + data.otp;
        sendSMS(content, mobile);
        sendMail(content, "OTP", bank.email);

        res.status(200)
          .json({
            mobile: mobile,
            username: bank.username
          });
      });
    }
  });
});

router.post('/forgotPassword', function (req, res) {
  //res.send("hi");
  let data = new OTP();
  const {
    mobile
  } = req.body;
  Infra.findOne({
    mobile: mobile
  }, function (err, bank) {
    if (err || bank == null) {
      res.status(401)
        .json({
          error: 'Account not found!'
        });
    } else {

      data.user_id = bank._id;
      data.otp = makeotp(6);
      data.page = 'forgotPassword';
      data.mobile = mobile;

      data.save((err, ) => {
        if (err) return res.status(400).json({
          error: err
        });

        let content = "Your OTP to change password is " + data.otp
        sendSMS(content, mobile);
        sendMail(content, "OTP", bank.email);

        res.status(200)
          .json({
            mobile: mobile,
            username: bank.username
          });
      });
    }
  });
});
/* Bank APIs end */


/* General APIs Start */
router.post('/generateOTP', function (req, res) {
  let data = new OTP();
  const {
    token,
    username,
    page,
    name,
    email,
    mobile,
    bcode
  } = req.body;
  Infra.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {

      data.user_id = user._id;
      data.otp = makeotp(6);
      data.page = page;
      if (page == 'editBank') {
        Bank.findOne({
          username
        }, function (err, bank) {
          data.mobile = bank.mobile;
          data.save((err, ot) => {
            if (err) return res.json({
              error: err
            });

            let content = "Your OTP to edit Bank is " + data.otp;
            sendSMS(content, bank.mobile);
            sendMail(content, "OTP", bank.email);

            res.status(200)
              .json({
                id: ot._id
              });
          });
        });

      } else {
        Bank.find({ $or:[ {'name':name}, {'email':email}, {'mobile':mobile}, {'bcode':bcode} ]}, function (err, bank) {
          console.log(err);
          console.log(bank);
          if(bank == null || bank == undefined || bank.length == 0){
            data.mobile = user.mobile;

            data.save((err, ot) => {
              if (err) return res.json({
                error: err
              });

              let content = "Your OTP to add Bank is " + data.otp;
              sendSMS(content, user.mobile);
              sendMail(content, "OTP", user.email);

              res.status(200)
                .json({
                  id: ot._id
                });
            });
          }else{
            res.status(400)
            .json({
              error: 'Duplicate Entry'
            });
          }
        });

      }

    }
  });
});


router.post('/generateOTPBank', function (req, res) {
  let data = new OTP();
  const {
    token,
    username,
    page
  } = req.body;

  Bank.findOne({
    username
  }, function (err, bank) {
    data.user_id = "0";
    data.otp = makeotp(6);
    data.page = "bankbankinfo";
    data.mobile = bank.mobile;
    data.save((err, ot) => {
      if (err) return res.json({
        error: err
      });

      let content = "Your OTP to edit Bank is " + data.otp;
      sendSMS(content, bank.mobile);
      sendMail(content, "OTP", bank.email);

      res.status(200)
        .json({
          id: ot._id
        });
    });
  });


});


router.post('/verifyOTP', function (req, res) {
  const {
    mobile,
    otp
  } = req.body;
  OTP.findOne({
    mobile,
    otp
  }, function (err, ot) {
    if (err || ot == null) {
      res.status(401)
        .json({
          error: 'Invalid OTP!'
        });
    } else {
      if (ot.otp == otp && ot.mobile == mobile) {
        let token = makeid(10);
        Bank.findByIdAndUpdate(ot.user_id, {
          token: token
        }, (err) => {
          if (err) return res.json({
            success: false,
            error: err
          });
          res.status(200)
            .json({
              token: token
            });
        });

      } else {
        res.status(402)
          .json({
            error: 'Invalid OTP!'
          });
      }
    }
  });
});

router.post('/InfraVrifyOTP', function (req, res) {
  const {
    mobile,
    otp
  } = req.body;
  OTP.findOne({
    mobile,
    otp
  }, function (err, ot) {
    if (err || ot == null) {
      res.status(401)
        .json({
          error: 'Invalid OTP!'
        });
    } else {
      if (ot.otp == otp && ot.mobile == mobile) {
        let token = makeid(10);
        Infra.findByIdAndUpdate(ot.user_id, {
          token: token
        }, (err) => {
          if (err) return res.json({
            success: false,
            error: err
          });
          res.status(200)
            .json({
              token: token
            });
        });

      } else {
        res.status(402)
          .json({
            error: 'Invalid OTP!'
          });
      }
    }
  });
});

router.post('/checkToken', function (req, res) {
  const {
    token
  } = req.body;
  User.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {
      res.status(200)
        .json({
          error: null
        });
    }
  });
});

router.post('/logout', function (req, res) {
  const {
    token
  } = req.body;
  User.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {
      res.status(200)
        .json({
          error: null
        });
    }
  });
});

router.post('/transferMoney', function (req, res) {
  const {
    from,
    to,
    note,
    amount,
    auth,
    token
  } = req.body;

  if (auth == "infra") {
    Infra.findOne({
      token
    }, function (err, f) {
      if (err) {
        res.status(401)
          .json({
            error: err
          });
      } else {
        const infra_email = f.email;
        const infra_mobile = f.mobile;

        var c = to.split("@");
        const bank = c[1];
        Bank.findOne({
          name: bank,
        }, function (err, b) {

          const bank_email = b.email;
          const bank_mobile = b.mobile;
          var total_trans = b.total_trans ? b.total_trans : 0;
          var temp = amount * mainFee / 100;
          var fee = temp;
          //var oamount = amount - fee;
          var oamount = amount;

          var fee3 = 0;

          //    getTransactionCount(from).then(function (count) {
          //      count = Number(count)+1;
          //      Fee.findOne({
          //       bank_id: b._id,
          //       trans_type: "Wallet to Wallet",
          //       status: 1
          // }, function (err, fe) {



            // if (!fe || fe == null) {
            //   var temp = fee * defaultFee / 100;
            //   fee3 = temp + defaultAmt;
            // } else {
            //   var ranges = JSON.parse(fe.ranges);
            //   if(ranges.length > 0){

            //   ranges.map(function(v) {

            //     if(Number(count) >= Number(v.trans_from) && Number(count) <= Number(v.trans_to)){
            //       var temp = fee * Number(v.percentage) / 100;
            //       fee3 = temp + Number(v.fixed_amount);
            //       console.log(fee3);
            //     }

            //   });
            // }else{
            //   var temp = fee * defaultFee / 100;
            //   fee3 = temp + defaultAmt;
            // }
            // }

              // res.status(200).json({
              //   status: fee3
              // });

            let data = {};
            data.amount = oamount.toString();
            data.from = from;
            data.to = to;
            data.note = note;
            data.email1 = infra_email;
            data.email2 = infra_email;
            data.mobile1 = infra_mobile;
            data.mobile2 = infra_mobile;

            // let data2 = {};
            // data2.amount = fee.toString();
            // data2.from = from;
            // data2.to = "operational@" + bank;
            // data2.note = "commission";
            // data2.email1 = infra_email;
            // data2.email2 = bank_email;
            // data2.mobile1 = infra_mobile;
            // data2.mobile2 = bank_mobile;

            // let data3 = {};
            // data3.amount = fee3.toString();
            // data3.from = "operational@" + bank;
            // data3.to = "infra_operational@" + bank;
            // data3.note = "operational commission";
            // data3.email1 = bank_email;
            // data3.email2 = infra_email;
            // data3.mobile1 = bank_mobile;
            // data3.mobile2 = infra_mobile;

            // console.log(data);
            // console.log(data2);
            // console.log(data3);
            // transferNow([data, data2, data3]).then(function(result) {

            // });
            transferThis(data).then(function (result) {
              console.log(result);
              });
              res.status(200).json({
                status: 'success'
              });

            // });

            // });



        });

      }
    });
  } else {
    res.status(200)
      .json({
        status: null
      });
  }


});

router.post('/checkFee', function (req, res) {
  const {
    from,
    to,
    amount,
    auth,
    token
  } = req.body;

  if (auth == "infra") {
    Infra.findOne({
      token
    }, function (err, f) {
      if (err) {
        res.status(401)
          .json({
            error: err
          });
      } else {
        var temp = amount * mainFee / 100;
        var fee = temp;
        res.status(200).json({
          fee: fee
        });


      }
    });
  } else {
    res.status(200)
      .json({
        fee: null
      });
  }


});


router.post('/getInfraHistory', function (req, res) {
  const {
    from,
    bank_id,
    token
  } = req.body;

  Infra.findOne({
    token
  }, function (err, f) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {

      Bank.findOne({
        "_id": bank_id,
      }, function (err, b) {
        const wallet = "infra_" + from + "@" + b.name;

        getStatement(wallet).then(function (result) {
          res.status(200).json({
            status: 'success',
            history: result
          });
        });

      });
    }
  });

});

router.post('/getBankHistory', function (req, res) {
  const {
    from,
    token
  } = req.body;

  Bank.findOne({
    token
  }, function (err, b) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {

      // Bank.findOne({
      //   "_id": f._id,
      // }, function (err, b) {
        const wallet = from + "@" + b.name;

        getStatement(wallet).then(function (result) {
          res.status(200).json({
            status: 'success',
            history: result
          });
        });

      // });
    }
  });

});

router.get('/clearDb', function (req, res) {
  const type = req.query.type;

  if (type == 'all' || type == 'infra') {
    Infra.remove({}, function (err, c) {});
  }
  if (type == 'all' || type == 'otp') {
    OTP.remove({}, function (err, c) {});
  }
  if (type == 'all' || type == 'bank') {
    Bank.remove({}, function (err, c) {});
  }
  if (type == 'all' || type == 'profile') {
    Profile.remove({}, function (err, c) {});
  }
  if (type == 'all' || type == 'fee') {
    Fee.remove({}, function (err, c) {});
  }
  if (type == 'all' || type == 'document') {
    Document.remove({}, function (err, c) {});
  }

  res.status(200).json({
    status: 'success'
  });

});

router.post('/fileUpload', function (req, res) {
  const token = req.query.token;

  Infra.findOne({
    token
  }, function (err, user) {
    if (err) {
      res.status(401)
        .json({
          error: err
        });
    } else {

      var form = new formidable.IncomingForm();
      const dir = __dirname + '/public/uploads/' + user._id;
      form.parse(req, function (err, fields, files) {

        var fn = files.file.name.split('.').pop();
    fn = fn.toLowerCase();

    if(fn != "jpeg" && fn != "png" && fn != "jpg" ){
      res.status(200).json({
        error: "Only JPG / PNG files are accepted"
      });
    }else{

        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir);
        }

        var oldpath = files.file.path;
        var newpath = dir + "/" + files.file.name;
        var savepath = user._id + "/" + files.file.name;

        fs.readFile(oldpath, function (err, data) {
          if (err) res.status(402);

          fs.writeFile(newpath, data, function (err) {
            if (err) {
              res.status(402).json({
              error: 'File upload error'
            });
          }else{
            res.status(200)
              .json({
                name: savepath
              });
            }
          });

          fs.unlink(oldpath, function (err) {});
        });
        // fs.renameSync(oldpath, newpath, function (err) {
        //   if (err) {
        //     res.status(402);
        //   }else{
        //     res.status(200)
        //     .json({
        //       name: newpath
        //     });
        //   }
        // });
      }
      });
    }
  });
});

router.post('/ipfsUpload', function (req, res) {
  const token = req.query.token;

  var form = new formidable.IncomingForm();

  form.parse(req, function (err, fields, files) {
    var fn = files.file.name.split('.').pop();
    fn = fn.toLowerCase();
    console.log(fn);
    if(fn != "pdf"){
      res.status(200).json({
        error: "Only PDF files are accepted"
      });
    }else{

    var oldpath = files.file.path;
    fileUpload(oldpath).then(function (result) {
      var out;
      if (result) {
        result = JSON.parse(result);
        if(!result.Hash || result.Hash == undefined){
          res.status(200).json({
            error: "File Upload Error"
          });
        }else{
          res.status(200).json({
            name: result.Hash
          });
        }

      }else{
        res.status(200).json({
          error: "File Upload Error"
        });
      }

    });
  }

  });
});
/* General APIs End */


app.use('/api', router);
app.listen(API_PORT, () => console.log(`LISTENING ON PORT ${API_PORT}`));
