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
const BankUser = require('./models/BankUser');
const Cashier = require('./models/Cashier');
const BankFee = require('./models/BankFee');
const CashierSend = require('./models/CashierSend');
const CashierPending = require('./models/CashierPending');
const CashierClaim = require('./models/CashierClaim');
const CashierLedger = require('./models/CashierLedger');
const CashierTransfer = require('./models/CashierTransfer');
const BranchSend = require('./models/BranchSend');
const BranchClaim = require('./models/BranchClaim');
const BranchLedger = require('./models/BranchLedger');
const CurrencyModel = require("./models/Currency")


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

function getTypeClass(key){
  switch (key) {
    case 'cashier':
      return Cashier;
      break;
    case 'bank':
      return Bank;
      break;
    case 'infra':
      return Infra;
      break;
    case 'branch':
      return Branch;
      break;
    case 'bankuser':
      return BankUser;
      break;
    case 'bankfee':
      return BankFee;
      break;
    case 'cashierledger':
      return CashierLedger;
      break;
    case 'cashierpending':
      return CashierPending;
      break;
    default:
      return null;
      break;
  }
}

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
  // var result = '';
  // var characters = '0123456789';
  // var charactersLength = characters.length;
  // for (var i = 0; i < length; i++) {
  //   result += characters.charAt(Math.floor(Math.random() * charactersLength));
  // }
  // return result;

  return "111111";
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
   return '';
}

function sendMail(content, subject, email) {
  ;
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

async function createWallet(arr, bank = '', infra = '') {
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

    if (res.status == 0) {
      err.push(res.message);
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

// async function walletTransfer(arr) {
//   var err = [];
//   await Promise.all(arr.map(async (url) => {
//     var options = {
//       uri: 'http://'+config.blockChainIP+':8000/transferBtwEWallets',
//       method: 'POST',
//       json: {
//         "wallet_id1": url.from.toString(),
//         "wallet_id2": url.to.toString(),
//         "amount": url.amount.toString(),
//         "remarks": url.note.toString()
//       }
//     };
//     console.log(options);
//     let res = await doRequest(options);
//     if (res.Error) {
//       err.push(res.Reason);
//     } else {
//       if (url.email1 && url.email1 != '') {
//         sendMail("<p>You have sent " + url.amount + " to the wallet " + url.to + "</p>", "Payment Sent", url.email1);
//       }
//       if (url.email2 && url.email2 != '') {
//         sendMail("<p>You have received " + url.amount + " from the wallet " + url.from + "</p>", "Payment Received", url.email2);
//       }
//       if (url.mobile1 && url.mobile1 != '') {
//         sendSMS("You have sent " + url.amount + " to the wallet " + url.to, url.mobile1);
//       }
//       if (url.mobile2 && url.mobile2 != '') {
//         sendSMS("You have received " + url.amount + " from the wallet " + url.from, url.mobile2);
//       }
//     }
//   }));
//   return err.toString();
// }

async function sendMoney(token, type, amt, fee) {
  var err = [];
  await Promise.all(arr.map(async (url) => {
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
    if (res.status == 0) {
      err.push(res.message);
    } else {
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
    ;
    let res = await doRequest(options);
    if (res.status == 1) {
      err.push(res.Reason);
    }

  })).catch((errr) => {
    return errr;
  });
  return err.toString();
}


async function transferThis(t1, t2 = false, t3 = false, t4 = false) {
  var err = [];

  var url = t1;

  var mc = url.master_code ? url.master_code : new Date().getTime();
  var cc = url.child_code ? url.child_code : new Date().getTime();

  var options = {
    uri: 'http://'+config.blockChainIP+':8000/transferBtwEWallets',
    method: 'POST',
    json: {
      "wallet_id1": url.from.toString(),
      "wallet_id2": url.to.toString(),
      "amount": url.amount.toString(),
      "master_id": mc.toString(),
      "child_id": cc.toString(),
      "remarks": url.note.toString()
    }
  };

  let res = await doRequest(options);
  console.log("one: "+res.toString());
  if (res.status == 0) {
    if(res.message){
      err.push(res.message);  
    }else{
      err.push("Blockchain connection error");
    }
    
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
    mc = url.master_code ? url.master_code : new Date().getTime();
    cc = url.child_code ? url.child_code : new Date().getTime();
    options = {
      uri: 'http://'+config.blockChainIP+':8000/transferBtwEWallets',
      method: 'POST',
      json: {
        "wallet_id1": url.from.toString(),
        "wallet_id2": url.to.toString(),
        "amount": url.amount.toString(),
        "master_id": mc.toString(),
        "child_id": cc.toString(),
        "remarks": url.note.toString()
      }
    };

    res = await doRequest(options);
    console.log("two: "+res.toString());
    if (res.status == 0) {
      if(res.message){
      err.push(res.message);  
    }else{
      err.push("Blockchain connection error");
    }
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
        mc = url.master_code ? url.master_code : new Date().getTime();
        cc = url.child_code ? url.child_code : new Date().getTime();
        options = {
          uri: 'http://'+config.blockChainIP+':8000/transferBtwEWallets',
          method: 'POST',
          json: {
            "wallet_id1": url.from.toString(),
            "wallet_id2": url.to.toString(),
            "amount": url.amount.toString(),
            "master_id": mc.toString(),
            "child_id": cc.toString(),
            "remarks": url.note.toString()
          }
        };

        res = await doRequest(options);
        console.log("three: "+res.toString());
        if (res.status == 0) {
          if(res.message){
            err.push(res.message);  
          }else{
            err.push("Blockchain connection error");
          }
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



        //Code By Hatim
        if (t4) {
          url = t4;
          mc = url.master_code ? url.master_code : new Date().getTime();
          cc = url.child_code ? url.child_code : new Date().getTime();
          options = {
            uri: 'http://'+config.blockChainIP+':8000/transferBtwEWallets',
            method: 'POST',
            json: {
              "wallet_id1": url.from.toString(),
              "wallet_id2": url.to.toString(),
              "amount": url.amount.toString(),
              "master_id": mc.toString(),
              "child_id": cc.toString(),
              "remarks": url.note.toString()
            }
          };
  
          res = await doRequest(options);
          console.log("three: "+res.toString());
          if (res.status == 0) {
            if(res.message){
              err.push(res.message);  
            }else{
              err.push("Blockchain connection error");
            }
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
        }
      }

        //End by hatim





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
  if (res.status && res.status == 1) {
    return res.data;
  } else {
    return [];
  }

}

async function getChildStatements(arr) {

  var options = {
    uri: 'http://'+config.blockChainIP+':8000/getChildIds',
    method: 'GET',
    json: {
      "master_id": arr.toString()
    }
  };

  let res = await doRequest(options);
  if (res.status && res.status == 1) {
    return res.data;
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

  if (res.status && res.status == 1) {
    return res.data.balance;
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



router.get('/clearDb', function (req, res) {
  const type = req.query.type;

  if (type == 'all' || type == 'infra') {
    db.dropCollection('infras', function (err, c) {});
  }
  if (type == 'all' || type == 'otp') {
    db.dropCollection('otps', function (err, c) {});
  }
  if (type == 'all' || type == 'bank') {
    db.dropCollection('banks', function (err, c) {});
  }
  if (type == 'all' || type == 'profile') {
    db.dropCollection('profiles', function (err, c) {});
  }
  if (type == 'all' || type == 'fee') {
    db.dropCollection('fees',function (err, c) {});
  }
  if (type == 'all' || type == 'document') {
    db.dropCollection('documents', function (err, c) {});
  }
  if (type == 'all' || type == 'bankfee') {
    db.dropCollection('bankfees', function (err, c) {});
  }
  if (type == 'all' || type == 'branch') {
    db.dropCollection('branches', function (err, c) {});
  }
  if (type == 'all' || type == 'cashier') {
    db.dropCollection('cashiers', function (err, c) {});
  }

  if (type == 'all' || type == 'bankuser') {
    db.dropCollection('bankusers', function (err, c) {});
  }

  if (type == 'all' || type == 'cashiersend') {
    db.dropCollection('cashiersends', function (err, c) {});
  }

  if (type == 'all' || type == 'cashierclaim') {
    db.dropCollection('cashierclaims', function (err, c) {});
  }
  
  if (type == 'all' || type == 'cashierledger') {
    db.dropCollection('cashierledgers', function (err, c) {});
  }

  if (type == 'all' || type == 'branchsend') {
    db.dropCollection('branchsends', function (err, c) {});
  }

  if (type == 'all' || type == 'branchclaim') {
    db.dropCollection('branchclaims',function (err, c) {});
  }

  if (type == 'all' || type == 'branchledger') {
    db.dropCollection('branchledgers',function (err, c) {});
  }

  res.status(200).json({
    status: 'success'
  });

});

router.post('/fileUpload', function (req, res) {
  const token = req.query.token;
  const from =req.query.from;

  let table = Infra;
  if(from && from =='bank'){
    table = Bank;
  }
  table.findOne({
    token,
    status : 1
  }, function (err, user) {
    if (err || user == null) {
      res.status(401)
        .json({
          error: "Unauthorized"
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
    ;
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




//newly added
router.post('/userSignup', (req, res) => {
  let data = new User();
  const {
    name,
    mobileNumber,
    email,
    address,
    password,
  } = req.body;

data.name = name;
data.mobile = mobileNumber;
data.email = email;
data.address = address;
data.password = password;
let otp = makeotp(6);
data.otp = otp;

 data.save((err, d) => {
    if (err) return res.status(200).json({
      error: err.toString()
    });
   
    let content = "<p>Your OTP to verify your mobile number is "+otp+"</p>";
    sendMail(content, "OTP", email);
    let content2 = "Your OTP to verify your mobile number is "+otp;
    sendSMS(content2, mobileNumber);
    // return res.status(200).json(data);
      res.status(200).json({
        status: "success"
      });

   });

  });

router.post('/userVerify', (req, res) => {
  const {
    mobileNumber,
    password,
  } = req.body;

      User.findOne({
        mobile: mobileNumber,
        otp: password
      }, function (err, b2) {
        if(err || b2 == null){
          res.status(200).json({
            error: 'OTP Missmatch'
          });
        }else{
          User.findByIdAndUpdate(b2._id, {status: 1}, function(e, b){
            if(e || b == null){
              res.status(200).json({
                error: e.toString()
              });
            }else{
              res.status(200).json({
                status: 'success'
              });  
            }
            
          });
          
        }
      });

  });

router.post('/userLogin', (req, res) => {
  const {
    mobileNumber,
    password,
  } = req.body;

      User.findOne({
        mobile: mobileNumber,
        password: password
      }, function (err, b2) {
        if(err || b2 == null){
          res.status(200).json({
            error: 'User account not found'
          });
        }else{
          let token = makeid(10);
          User.findByIdAndUpdate(b2._id, {token: token}, function(e, b){
            if(e || b == null){
              res.status(200).json({
                error: e.toString()
              });
            }else{
              if(b2.status == 0){
                let otp = makeotp(6);
                let content = "<p>Your OTP to verify your mobile number is "+otp+"</p>";
                sendMail(content, "OTP",  b2.email);
                let content2 = "Your OTP to verify your mobile number is "+otp;
                sendSMS(content2, b2.mobile);
              }
              res.status(200).json({
                status: b2.status,
                name: b2.name,
                mobile: b2.mobile,
                token: token
              });  
            }
            
          });
          
        }
      });

  });

router.post('/bankThemeUpdate', (req, res) => {
  const {
    type,
    color,
    token
  } = req.body;

      Bank.findOne({
        token:token,
        status: 1
      }, function (err, b) {
        if(err || b == null){
          res.status(401).json({
            error: 'Unauthorized'
          });
        }else{
          // let token = makeid(10);
          
          let theme = b.theme;
          if(theme && theme !=''){
            theme = JSON.parse(theme);
          }else{
            theme = {};
          }
          theme[type] = color;
          theme = JSON.stringify(theme);

          Bank.findByIdAndUpdate(b._id, {theme: theme}, function(e, b){
            if(e || b == null){
              res.status(200).json({
                error: e.toString()
              });
            }else{
              res.status(200).json({
                status: 'success'
              });  
            }
            
          });

        }
      });

  });

router.get('/getBanks', (req, res) => {
  // const {
    
  // } = req.body;

      Bank.find({
      }, function (err, b) {
        if(err || b == null){
          res.status(401).json({
            error: 'Unauthorized'
          });
        }else{
          
          res.status(200).json({
                banks: b
              });  

        }
      });

  });

router.post('/saveUserDocuments', (req, res) => {
  const {
    mobile,
    documents
  } = req.body;

      User.findOne({
        mobile:mobile
      }, function (err, b) {
        if(err || b == null){
          res.status(401).json({
            error: 'Unauthorized'
          });
        }else{
          let doc = JSON.stringify(documents);

          User.findByIdAndUpdate(b._id, {documents: doc, status: 2}, function(e, b){
            if(e || b == null){
              res.status(200).json({
                error: e.toString()
              });
            }else{
              res.status(200).json({
                status: 'success'
              });  
            }
          });

        }
      });

  });
/* General APIs End */


app.use('/api', router);
app.listen(API_PORT, () => console.log("Backend Started"));
