//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");

//models
const getTypeClass = require("../../routes/utils/getTypeClass");

module.exports.jwtAuthentication = function (model, req, next) {
	const jwtusername = req.sign_creds.username;

	if (model != "cashier" && model != "partnerCashier") {
		next(
			{
				status: 0,
				message:
					"Token changed or user not valid. Try to login again or contact system administrator..",
			},
			null
		);
	} else {
		const Model = getTypeClass(model);

		Model.findOne(
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
	}
};
