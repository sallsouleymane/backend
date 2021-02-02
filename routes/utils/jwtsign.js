const jwt = require("jsonwebtoken");
const secret = "jwt_secret_key_for_ewallet_of_32bit_string";
module.exports = function (sign_creds) {
	var token = jwt.sign(
		{
			sign_creds: sign_creds,
		},
		secret
		// {
		// 	expiresIn: "365d"
		// }
	);
	return token;
};
