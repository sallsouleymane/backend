//utils
const { errorMessage } = require("../../routes/utils/errorHandler");

//models
const User = require("../../models/User");

module.exports.jwtAuthentication = function (req, next) {
	const jwtusername = req.sign_creds.username;

	User.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let errMsg = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (errMsg.status == 0) {
				next(errMsg, null);
			} else {
				next(null, user);
			}
		}
	);
};
