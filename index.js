const mongoose = require('mongoose');
const express = require('express');
var formidable = require('formidable');
var path = require('path');     //used for file path
var fs = require('fs-extra')
var cors = require('cors');
const bodyParser = require('body-parser');
const logger = require('morgan');
const Data = require('./data');
const User = require('./models/User');
const Bank = require('./models/Bank');
const nodemailer = require("nodemailer");
//const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
// const withAuth = require('./middleware');
const API_PORT = 3001;

function makeid(length) {
  var result           = '';
  var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for ( var i = 0; i < length; i++ ) {
     result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
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


const app = express();
app.use(cors());
app.use(cookieParser());
app.use(express.static( 'public'));
const router = express.Router();
//const secret = 'mysecretsshhh';
// this is our MongoDB database
const dbRoute =
  'mongodb://127.0.0.1:27017/ewallet';

// connects our back end code with the database
mongoose.connect(dbRoute, { useNewUrlParser: true });

let db = mongoose.connection;

db.once('open', () => console.log('connected to the database'));

// checks if connection with the database is successful
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// (optional) only made for logging and
// bodyParser, parses the request body to be a readable json format
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(logger('dev'));


router.post('/login', function(req, res) {
  const { username, password } = req.body;
   User.findOne({ username, password }, function(err, user) {

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
      User.findByIdAndUpdate(user._id, {token: token}, (err) => {
        if (err) return res.status(400).json({ error: err });
        res.status(200).json({ token: token, name: user.name});
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


router.post('/bankLogin', function(req, res) {
  const { username, password } = req.body;
   Bank.findOne({ username, password }, function(err, bank) {

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

      User.findByIdAndUpdate(bank._id, {token: token}, (err) => {
        if (err) return res.status(400).json({ error: err });
        res.status(200).json({ token: token, name: bank.name, initial_setup: bank.initial_setup, username: bank.username });
      });
      
     }
  });
});

router.post('/getDashStats', function(req, res) {
  const { token } = req.body;
  User.findOne({ token }, function(err, user) {
    if (err) {
      res.status(401)
      .json({
      error: err
    });
    }else{
      const user_id = user._id;
      Bank.estimatedDocumentCount({ user_id }, function(err, bank) {  
        if (err) {
          res.status(402)
          .json({
          error: err
        });
        }else{
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
  const { name, address1, address2, mobile, email, token, logo, contract } = req.body;
  User.findOne({ token }, function(err, user) {
    if (err) {
      res.status(401)
      .json({
      error: err
    });
    }else{
      if (name == '' || address1 == '' || address2 == '' || mobile == '' || email == '' ) {
        return res.status(402)
        .json({
        error: 'Please provide valid inputs'
      });
      }
      
      data.name = name;
      data.address1 = address1;
      data.address2 = address2;
      data.mobile = mobile;
      data.username = mobile;
      data.email = email;
      data.user_id = user._id;
      data.logo = logo;
      data.contract = contract;
      data.password = makeid(10);

      
  
      data.save((err, ) => {
        if (err) return res.json({error: err });
        let content  = "<p>Your bank is added in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://35.204.144.169/bank'>http://34.90.64.186/bank</a></p><p><p>Your username: "+data.username+"</p><p>Your password: "+data.password+"</p>";

        let info = transporter.sendMail({
          from: '"E-Wallet" <no-reply@ewallet.com>', // sender address
          to: email, // list of receivers
          subject: "Bank Account Created", // Subject line
          text: "", // plain text body
          html: content // html body
        });
        return res.status(200).json(data);
      });
    }
});
});

router.post('/getBanks', function(req, res) {
//res.send("hi");
  const { token } = req.body;
  User.findOne({ token }, function(err, user) {
    if (err) {
      res.status(401)
      .json({
      error: err
    });
    }else{
      const user_id = user._id;
      Bank.find({ user_id }, function(err, bank) {
        if (err) {
          res.status(404)
          .json({
          error: err
        });
        }else{
          res.status(200)
          .json({
            banks: bank
          });
        }
    });

    }
});
});

router.post('/checkToken', function(req, res) {
  const { token } = req.body;
  User.findOne({ token }, function(err, user) {
    if (err) {
      res.status(401)
      .json({
      error: err
    });
    }else{
      res.status(200)
      .json({
        error: null
      });
    }
});
});

router.post('/logout', function(req, res) {
  const { token } = req.body;
  User.findOne({ token }, function(err, user) {
    if (err) {
      res.status(401)
      .json({
      error: err
    });
    }else{
      res.status(200)
      .json({
        error: null
      });
    }
});
});

router.post('/fileUpload', function(req, res) {
console.log(req.query);
  const  token  = req.query.token;

  User.findOne({ token }, function(err, user) {
    if (err) {
      res.status(401)
        .json({
        error: err
      });
    }else{
      var form = new formidable.IncomingForm();
      const dir = __dirname + '/public/uploads/'+user._id;
      form.parse(req, function (err, fields, files) {
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        console.log(files.file);
        var oldpath = files.file.path;
        var newpath = dir + "/" + files.file.name;
        var savepath = user._id+"/"+files.file.name;

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

// router.get('/logout', withAuth, function(req, res) {
//   cookies.set('token', {expires: Date.now()});
//   res.sendStatus(200);
// });


// this is our get method
// this method fetches all available data in our database
router.get('/getData', (req, res) => {
  Data.find((err, data) => {
    if (err) return res.json({ success: false, error: err });
    return res.json({ success: true, data: data });
  });
});

// this is our update method
// this method overwrites existing data in our database
router.post('/updateData', (req, res) => {
  const { id, update } = req.body;
  Data.findByIdAndUpdate(id, update, (err) => {
    if (err) return res.json({ success: false, error: err });
    return res.json({ success: true });
  });
});

// this is our delete method
// this method removes existing data in our database
router.delete('/deleteData', (req, res) => {
  const { id } = req.body;
  Data.findByIdAndRemove(id, (err) => {
    if (err) return res.send(err);
    return res.json({ success: true });
  });
});

// this is our create methid
// this method adds new data in our database
router.post('/putData', (req, res) => {
  let data = new Data();

  const { id, message } = req.body;

  if ((!id && id !== 0) || !message) {
    return res.json({
      success: false,
      error: 'INVALID INPUTS',
    });
  }
  data.message = message;
  data.id = id;
  data.save((err) => {
    if (err) return res.json({ success: false, error: err });
    return res.json({ success: true });
  });
});

// append /api for our http requests
app.use('/api', router);

// launch our backend into a port
app.listen(API_PORT, () => console.log(`LISTENING ON PORT ${API_PORT}`));
