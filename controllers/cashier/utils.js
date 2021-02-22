//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");

//models
const Cashier = require("../../models/Cashier");

module.exports.jwtAuthentication = function (req, next) {
	const jwtusername = req.sign_creds.username;

	Cashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let errMsg = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (errMsg.status == 0) {
				next(errMsg, null);
			} else {
				next(null, cashier);
			}
		}
	);
};
