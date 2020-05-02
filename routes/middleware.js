const jwt = require('jsonwebtoken');
const secret = "jwt_secret_key_for_ewallet_of_32bit_string";

module.exports = function(req, res, next) {
  const token = 
      req.body.token ||
      req.query.token ||
      req.headers.authorization ||
      req.cookies.token;

  if (!token) {
    res.status(401).send({status: 0, error: 'Unauthorized: No token provided'});
  } else {
    jwt.verify(token, secret, function(err, decoded) {
      if (err) {
        console.log(err)
        res.status(401).send({status: 0, error: 'Unauthorized: Invalid token'});
      } else {
        req.username = decoded.username;
        req.password = decoded.password;
        next();
      }
    });
  }
}