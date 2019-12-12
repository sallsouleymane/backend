const request = require('request');
const mongoose = require('mongoose');
const express = require('express');
var formidable = require('formidable');
var path = require('path'); //used for file path
var fs = require('fs-extra')
var cors = require('cors');
const bodyParser = require('body-parser');
const logger = require('morgan');
const Data = require('./data');
const Infra = require('./models/Infra');
const Fee = require('./models/Fee');
const User = require('./models/User');
const Bank = require('./models/Bank');
const OTP = require('./models/OTP');
const nodemailer = require("nodemailer");
//const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
// const withAuth = require('./middleware');
const API_PORT = 3001;


const app = express();
app.use(cors());
app.use(cookieParser());
app.use(express.static('public'));
const router = express.Router();

const dbRoute = 'mongodb://127.0.0.1:27017/ewallet';
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

function sendSMS(url) {
  request(url, {
    json: true
  }, (err, res, body) => {
    if (err) {
      return err;
    }
    return body;
  });
}
// async function createWallet(arr){
//   arr.forEach(url => { 
//     var options = {
//       uri: 'http://34.70.46.65:8000/createEWallet',
//       method: 'POST',
//       json: {
//         "wallet_id": url,
//         "type": "test",
//         "remarks": ""
//       }
//     };

//     request(options, function (error, response, body) {
//       if (!error && response.statusCode == 200) {
//         console.log(body);
//         if(body.Error){
//           await body.Error;
//         }else{
//           return "";
//         }
//       }else{
//         return 'Network Error';
//       }
//       await 
//     });
    
//   });
//   await printString("A")
//   await printString("B")
//   await printString("C")
// }
function doRequest(url) {
  var options = {
    uri: 'http://34.70.46.65:8000/createEWallet',
    method: 'POST',
    json: {
      "wallet_id": url,
      "type": "test",
      "remarks": ""
    }
  };
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

async function createWallet(arr) {
  var err = [];
  await Promise.all(arr.map(async (url) => {
    let res = await doRequest(url);
      console.log(res);
      if(res.Error){
        err.push(res.Reason);
      }
    }));
  return err.toString();
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
        res.status(200).json({
          token: token,
          name: user.name,
          initial_setup: user.initial_setup,
        });
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
      Bank.estimatedDocumentCount({
        user_id
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
      const user_id = user._id;
      OTP.findOne({
        user_id,
        otp
      }, function (err, otpd) {
        if (err) {
          res.status(401)
            .json({
              error: err
            });
        } else {
          console.log(otpd.otp+ " "+ otp);
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

            data.save((err, ) => {
              if (err) return res.json({
                error: "Duplicate entry!"
              });
              let content = "<p>Your bank is added in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://35.204.144.169/bank'>http://35.204.144.169/bank</a></p><p><p>Your username: " + data.username + "</p><p>Your password: " + data.password + "</p>";

              let info = transporter.sendMail({
                from: '"E-Wallet" <no-reply@ewallet.com>', // sender address
                to: email, // list of receivers
                subject: "Bank Account Created", // Subject line
                text: "", // plain text body
                html: content // html body
              });
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
      console.log(bank_id);
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
  });
});

router.post('/setupUpdate', function (req, res) {
  const {
    username,
    password,
    email,
    mobile,
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
      console.log(bank);
      Infra.findByIdAndUpdate(bank._id, {
        username: username,
        password: password,
        email: email,
        mobile: mobile,
        initial_setup: true
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
        status: 0
      }, (err) => {
        if (err) return res.status(400).json({
          error: err
        });

        createWallet(['operational@'+bank.name, 'escrow@'+bank.name, 'master@'+bank.name, 'infra_operational@'+bank.name, 'infra_master@'+bank.name]).then(function(result) {
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
      // console.log(bank);
      data.user_id = bank._id;
      data.otp = makeotp(6);
      data.page = 'bankForgotPassword';
      data.mobile = mobile;

      data.save((err, ) => {
        if (err) return res.status(400).json({
          error: err
        });
        sendSMS("http://136.243.19.2/http-api.php?username=ewallet&password=bw@2019&senderid=kmindz&route=1&number=" + mobile + "&message=Your OTP to change password is " + data.otp);
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
    name,
    mobile,
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
      data.mobile = mobile;

      data.save((err, ) => {
        if (err) return res.json({
          error: err
        });
        res.status(200)
          .json({
            otp: true
          });
      });
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