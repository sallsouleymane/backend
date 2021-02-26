//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");

//models
const MerchantPosition = require("../../models/merchant/Position");

module.exports.jwtAuthentication = function (req, next) {
	const jwtusername = req.sign_creds.username;

	MerchantPosition.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, position) {
			let errMsg = errorMessage(
				err,
				position,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (errMsg.status == 0) {
				next(errMsg, null);
			} else {
				next(null, position);
			}
		}
	);
};
