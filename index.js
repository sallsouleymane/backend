const request = require('request');
const mongoose = require('mongoose');
const express = require('express');
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
const Wallet = require('./models/Wallet');
const Profile = require('./models/Profile');
const Document = require('./models/Document');

const API_PORT = 3001;
const mainFee = 10;
const app = express();
app.use(cors());
app.use(cookieParser());
app.use(express.static('public'));
const router = express.Router();

const dbRoute = 'mongodb://127.0.0.1:27017/ewallet';
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
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));


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
  console.log(content);
  let url = "http://136.243.19.2/http-api.php?username=ewallet&password=bw@2019&senderid=EWALET&route=1&number=" + mobile + "&message="+content;
  request(url, {
    json: true
  }, (err, res, body) => {
    if (err) {
      return err;
    }
    return body;
  });
}

function sendMail(content, subject, email){
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
}

async function createWallet(arr, bank, infra) {
  var err = [];
  await Promise.all(arr.map(async (url) => {
    var options = {
      uri: 'http://34.70.46.65:8000/createEWallet',
      method: 'POST',
      json: {
        "wallet_id": url,
        "type": "test",
        "remarks": ""
      }
    };
    let res = await doRequest(options);
      
      if(res.Error){
        err.push(res.Reason);
      }else{
        let data = new Wallet();
        let temp = url.split("@");
        data.address = url;
        data.type = temp[0];
        data.infra_id = infra;
        data.bank_id = bank;
        data.balance = 0;
        data.save((e, ) => {
          if (e){
            err.push("failed to create "+url);
          }
        });

      }

    }));
  return err.toString();
}




async function rechargeNow(arr) {
  var err = [];
  await Promise.all(arr.map(async (url) => {
    // err.push(Math.round(new Date().getTime()/1000));
    
    var options = {
      uri: 'http://34.70.46.65:8000/rechargeEWallet',
      method: 'POST',
      json: {
        "wallet_id": url.to.toString(),
        "amount": url.amount.toString(),
        "remarks": "recharge"
      }
    };
    console.log(options);
    let res = await doRequest(options);
      console.log("output: ");
      console.log(res);
      if(res != true){
        err.push(res.Reason);
      }

    })).catch((errr) =>{
      console.log(errr);
      return errr;
    });
  return err.toString();
}

async function transferNow(arr) {
  var err = [];
  await Promise.all(arr.map(async (url) => {
    err.push(Math.round(new Date().getTime()/1000));
    var options = {
      uri: 'http://34.70.46.65:8000/transferBtwEWallets',
      method: 'POST',
      json: {
        "wallet_id1": url.from.toString(),
        "wallet_id2": url.to.toString(),
        "amount": url.amount.toString(),
        "remarks": url.note.toString()
      }
    };
    console.log(options);
    let res = await doRequest(options);
      console.log("output: ");
      console.log(res);

      if(url.email1 && url.email1 != ''){
        sendMail("<p>You have sent "+url.amount+" to the wallet "+url.to+"</p>", "Payment Sent", url.email1);
        }
        if(url.email2 && url.email2 != ''){
        sendMail("<p>You have received "+url.amount+" from the wallet "+url.from+"</p>", "Payment Received", url.email2);
        }
        if(url.mobile1 && url.mobile1 != ''){
        sendSMS("You have sent "+url.amount+" to the wallet "+url.to, url.mobile1);
        }
        if(url.mobile2 && url.mobile2 != ''){
        sendSMS("You have received "+url.amount+" from the wallet "+url.from, url.mobile2);
        }

      if(res != true){
        err.push(res.Reason);
      }

    })).catch((errr) =>{
      console.log(errr);
      return errr;
    });
  return err.toString();
}


async function transferThis(t1, t2) {
  var err = [];

    var url = t1;
    var options = {
      uri: 'http://34.70.46.65:8000/transferBtwEWallets',
      method: 'POST',
      json: {
        "wallet_id1": url.from.toString(),
        "wallet_id2": url.to.toString(),
        "amount": url.amount.toString(),
        "remarks": url.note.toString()
      }
    };
    console.log(options);
    let res = await doRequest(options);
      console.log("output: ");
      console.log(res);
      if(res != true){
        err.push(res.Reason);
      }

    if(url.email1 && url.email1 != ''){
      sendMail("<p>You have sent "+url.amount+" to the wallet "+url.to+"</p>", "Payment Sent", url.email1);
      }
      if(url.email2 && url.email2 != ''){
      sendMail("<p>You have received "+url.amount+" from the wallet "+url.from+"</p>", "Payment Received", url.email2);
      }
      if(url.mobile1 && url.mobile1 != ''){
      sendSMS("You have sent "+url.amount+" to the wallet "+url.to, url.mobile1);
      }
      if(url.mobile2 && url.mobile2 != ''){
      sendSMS("You have received "+url.amount+" from the wallet "+url.from, url.mobile2);
      }

    url = t2;
    options = {
      uri: 'http://34.70.46.65:8000/transferBtwEWallets',
      method: 'POST',
      json: {
        "wallet_id1": url.from.toString(),
        "wallet_id2": url.to.toString(),
        "amount": url.amount.toString(),
        "remarks": url.note.toString()
      }
    };
    console.log(options);
    res = await doRequest(options);
      console.log("output: ");
      console.log(res);
      if(res != true){
        err.push(res.Reason);
      }

    if(url.email1 && url.email1 != ''){
      sendMail("<p>You have sent "+url.amount+" to the wallet "+url.to+"</p>", "Payment Sent", url.email1);
      }
      if(url.email2 && url.email2 != ''){
      sendMail("<p>You have received "+url.amount+" from the wallet "+url.from+"</p>", "Payment Received", url.email2);
      }
      if(url.mobile1 && url.mobile1 != ''){
      sendSMS("You have sent "+url.amount+" to the wallet "+url.to, url.mobile1);
      }
      if(url.mobile2 && url.mobile2 != ''){
      sendSMS("You have received "+url.amount+" from the wallet "+url.from, url.mobile2);
      }

      

  return err.toString();
}

async function getStatement(arr) {
  
  var options = {
    uri: 'http://34.70.46.65:8000/getEWalletStatement',
    method: 'GET',
    json: {
      "wallet_id": arr.toString()
    }
  };
  
  let res = await doRequest(options);
    if(res.result && res.result == "success"){
      return res.payload;
    }else{
      return [];
    }

}


async function getBalance(arr) {
  
    var options = {
      uri: 'http://34.70.46.65:8000/showEWalletBalance',
      method: 'GET',
      json: {
        "wallet_id": arr.toString()
      }
    };
    
    let res = await doRequest(options);
      
      if(res.result && res.result == "success"){
        return res.payload.balance;
      }else{
        return 0;
      }


}




function createWallset(url) {


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

router.get('/testGet', function(req, res){
return res.status(200).json(
  {
    status: 'Internal error please try again'
  }
);
});


/* Infra APIs start  */
router.post('/login', function (req, res) {
  const {
    username,
    password
  } = req.body;
  Infra.findOne({
    username,
    password
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
      let token = makeid(10);
      Infra.findByIdAndUpdate(user._id, {
        token: token
      }, (err) => {
        if (err) return res.status(400).json({
          error: err
        });

        if(user.profile_id && user.profile_id != ''){
          Profile.findOne({
            "_id" : user.profile_id
          }, function (err, profile) {
            
            var p = JSON.parse(profile.permissions);
            res.status(200).json({
              token: token,
              permissions: profile.permissions,
              name: user.name,
              initial_setup: user.initial_setup,
            });
          })
        }else{
          if(user.name == "Infra Admin"){
            res.status(200).json({
              token: token,
              permissions: 'all',
              name: user.name,
              initial_setup: user.initial_setup,
            });
          }else{
            res.status(200).json({
              token: token,
              permissions: '',
              name: user.name,
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
      const wallet_id = "infra_operational@"+ba.name;
      
      getBalance(wallet_id).then(function(result) {
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
      const wallet_id = "infra_master@"+ba.name;
      
      getBalance(wallet_id).then(function(result) {
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
      console.log(user_id);
      Bank.countDocuments({
        "user_id" : user_id
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
    }
  });
});

router.post('/addBank', (req, res) => {
  let data = new Bank();
  const {
    name,
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

            data.name = name;
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

              let content = "<p>Your bank is added in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://35.204.144.169/bank'>http://35.204.144.169/bank</a></p><p><p>Your username: " + data.username + "</p><p>Your password: " + data.password + "</p>";
              sendMail(content, "Bank Account Created", email);
              
              return res.status(200).json(data);
            });
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

router.post('/editBank', (req, res) => {
  let data = new Bank();
  const {
    bank_id,
    name,
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

            data.name = name;
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
            Bank.findByIdAndUpdate(bank_id, {
              name: name,
              address1: address1,
              state: state,
              zip: zip,
              ccode: ccode,
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

              // let content = "<p>Your bank is added in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://35.204.144.169/bank'>http://35.204.144.169/bank</a></p><p><p>Your username: " + data.username + "</p><p>Your password: " + data.password + "</p>";
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
            var c = {create_bank, edit_bank, create_fee};
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
                error: err.toString()
              });
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
            Infra.findOneAndUpdate({"_id" : _id}, {
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
    const {amount, bank} = req.query;
  Infra.findOne({
    name: "Infra Admin"
  }, function (err, infra) {
    const infra_email = infra.email;
    const infra_mobile = infra.mobile;

    if(err) return res.status(401);
    Bank.findOne({
      name: bank
    }, function (err, ba) {
      const bank_email = ba.email;
      const bank_mobile = ba.mobile;
      if(err) return res.status(401);

      let data = {};
      let fee = (amount*mainFee/100);
      let fee3 = (fee*10/100);
      data.amount = (amount-fee).toString();
      data.from = "recharge";
      data.to = ("testuser@"+ba.name).toString();  

      rechargeNow([data]).then(function(result) {
        let data2 = {};
        data2.amount = fee.toString();
        data2.from = "testuser@"+ba.name;
        data2.to = "operational@"+ba.name;  
        data2.note = "recharge commission";
        data2.email2 = bank_email;
        data2.mobile2 = bank_mobile;

        let data3 = {};
        data3.amount = fee3.toString();
        data3.from = "operational@"+ba.name; 
        data3.to = "infra_operational@"+ba.name; 
        data3.note = "commission";
        data3.email1 = bank_email ;
        data3.email2 = infra_email;
        data3.mobile1 = bank_mobile;
        data3.mobile2 = infra_mobile;

        // transferNow([data2, data3]).then(function(result) {
         
        // });
        transferThis(data2, data3).then(function(result) {
         
        });

        res.status(200).json({
          status: result + " Transfer initiated and will be notified via email and sms"
        });
      });
     
  });
  
});
});

router.post('/createRules', (req, res) => {
  let data = new Fee();
  const {
    name,
    trans_type,
    active,
    trans_from,
    trans_to,
    transcount_from,
    transcount_to,
    token,
    fixed_amount,
    percentage,
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
      data.bank_id = bank_id;
      data.user_id = user._id;
      data.name = name;
      data.trans_type = trans_type;
      data.active = active;
      data.trans_from = trans_from;
      data.trans_to = trans_to;
      data.transcount_from = transcount_from;
      data.transcount_to = transcount_to;
      data.fixed_amount = fixed_amount;
      data.percentage = percentage;


      data.save((err, ) => {
        if (err) return res.status(400).json({
          error: err
        });

        res.status(200)
          .json({
            success: true
          });
      });

    }

  });
});

router.post('/getBank', function (req, res) {
  //res.send("hi");
  const {
    token, bank_id
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

router.post('/getWalletsOperational', function (req, res) {
  //res.send("hi");
  const {
    token, bank_id
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
              from: 'infra_operational@'+bank.name,
              to: 'infra_master@'+bank.name,
            });
        }
      });

});


router.post('/getWalletsMaster', function (req, res) {
  //res.send("hi");
  const {
    token, bank_id
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
              from: 'infra_master@'+bank.name,
              to: 'master@'+bank.name,
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
      if(user.name =="Infra Admin"){
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
    }else{
      Fee.find({
        user_id,
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

router.post('/getDocs', function (req, res) {
  //res.send("hi");
  const {
    bank_id
  } = req.body;
  Document.find({
    bank_id
  }, function (err, user) {
    if(err) {
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
    _id : bank_id
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

      Fee.findByIdAndUpdate(id, {
        status: 1
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
        status: 2
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
      if(user.name =="Infra Admin"){
        Bank.find({
          
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
      }else{
        Bank.find({
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
                banks: bank
              });
          }
        });
      }


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
  data.password = password;
  data.mobile = mobile;
  data.email = email;
  data.ccode = ccode;

  data.save((err, ) => {
    if (err) return res.json({
      error: err
    });
    let content = "<p>Your Infra account is activated in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://35.204.144.169'>http://35.204.144.169</a></p><p><p>Your username: " + data.username + "</p><p>Your password: " + data.password + "</p>";   
   let result = sendMail(content, "Infra Account Created", data.email);
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
    }  else if (bank.status == -1) {
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

        createWallet(['testuser@'+bank.name, 'operational@'+bank.name, 'escrow@'+bank.name, 'master@'+bank.name, 'infra_operational@'+bank.name, 'infra_master@'+bank.name], bank._id, bank.user_id).then(function(result) {
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
    page
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
      if(page == 'editBank'){
        Bank.findOne({
          username
        }, function (err, bank) {
          data.mobile = bank.mobile;
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
        });

      }else{
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
      }
      console.log(data);
      

    
    }
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
  
  if(auth == "infra"){
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
          name : bank,
        }, function (err, b) {
          const bank_email = b.email;
          const bank_mobile = b.mobile;
          var total_trans = b.total_trans ? b.total_trans : 0;
          var temp = amount*10/100;
          var fee = temp;
          var oamount = amount - fee;
          var fee3 = 0;

          Fee.findOne({
            bank_id : b._id,
            trans_type: "Wallet to Wallet",
            transcount_from: { $lte : total_trans},
            transcount_to: { $gte : total_trans},
            trans_from: { $lte : fee},
            trans_to: { $gte : fee}
          }, function (err, fe) {
            if(!fe){
              var temp = fee*10/100;
              fee3 = temp;
            }else{
              if(fe.fixed_amount && fe.fixed_amount > 0){
                fee3 = fe.fixed_amount;
              }else{
                var temp = fee*fe.percentage/100;
                fee3 = temp;
              }
            }
            
          
            
            let data = {};
            data.amount = oamount.toString();
            data.from = from;
            data.to = to;  
            data.note = note;
            data.email1 = infra_email;
            data.email2 = infra_email;
            data.mobile1 = infra_mobile;
            data.mobile2 = infra_mobile;

            let data2 = {};
            data2.amount = fee.toString();
            data2.from = from;
            data2.to = "operational@"+bank;  
            data2.note = "commission";
            data2.email1 = infra_email;
            data2.email2 = bank_email;
            data2.mobile1 = infra_mobile;
            data2.mobile2 = bank_mobile;

            let data3 = {};
            data3.amount = fee3.toString();
            data3.from = "operational@"+bank; 
            data3.to = "infra_operational@"+bank;  
            data3.note = "operational commission";
            data3.email1 = bank_email;
            data3.email2 = infra_email;
            data3.mobile1 = bank_mobile;
            data3.mobile2 = infra_mobile;


            transferNow([data, data2, data3]).then(function(result) {
              
            });
            res.status(200).json({
              status: 'success'
            });
          });
          
          
         });
        // const wallet_id = "infra_master@"+ba.name;
        
        // getBalance(wallet_id).then(function(result) {
        //   res.status(200).json({
        //     status: 'success',
        //     balance: result
        //   });
        // });
      }
    });
  }else{
    res.status(200)
    .json({
      status : null
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
          "_id" : bank_id,
        }, function (err, b) {
          const wallet = "infra_"+from+"@"+b.name;
          
          getStatement(wallet).then(function(result) {
            res.status(200).json({
              status: 'success',
              history: result
            });
          });

         });
      }
    });

});

router.get('/clearDb', function (req, res) {
  const type = req.query.type;

  if(type == 'all' || type == 'infra'){
    Infra.remove({}, function (err, c) {
    });
  }
  if(type == 'all' || type == 'bank'){
    Bank.remove({}, function (err, c) {
    });
  }
  if(type == 'all' || type == 'fee'){
    Fee.remove({}, function (err, c) {
    });
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
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir);
        }

        var oldpath = files.file.path;
        var newpath = dir + "/" + files.file.name;
        var savepath = user._id + "/" + files.file.name;

        fs.readFile(oldpath, function (err, data) {
          if (err) res.status(402);

          fs.writeFile(newpath, data, function (err) {
            if (err) res.status(402);
            res.status(200)
              .json({
                name: savepath
              });
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

      });
    }
  });
});
/* General APIs End */


app.use('/api', router);
app.listen(API_PORT, () => console.log(`LISTENING ON PORT ${API_PORT}`));
