const jwt = require("jsonwebtoken");
const secret = "jwt_secret_key_for_ewallet_of_32bit_string";

module.exports = function (req, res, next) {
	const token =
		req.body.token ||
		req.query.token ||
		req.headers.authorization ||
		req.cookies.token;

	if (!token) {
		res
			.status(200)
			.send({ status: 10, message: "Unauthorized: No token provided" });
	} else {
		jwt.verify(token, secret, function (err, decoded) {
			if (err) {
				console.log(err);
				res
					.status(200)
					.send({ status: 10, message: "Unauthorized: Invalid token" });
			} else {
				req.sign_creds = decoded.sign_creds;
				next();
			}
		});
	}
};
