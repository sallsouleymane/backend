//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");

//models
const Branch = require("../../models/Branch");

module.exports.jwtAuthentication = function (req, next) {
	const jwtusername = req.sign_creds.username;

	Branch.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, branch) {
			let errMsg = errorMessage(
				err,
				branch,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (errMsg.status == 0) {
				next(errMsg, null);
			} else {
				next(null, branch);
			}
		}
	);
};
