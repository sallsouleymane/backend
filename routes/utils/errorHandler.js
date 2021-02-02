module.exports.errorMessage = function (
	err,
	user,
	userMessage,
	condition = false
) {
	var cond;
	if (condition) {
		cond = user != null;
	} else {
		cond = user == null;
	}
	if (err) {
		return module.exports.catchError(err);
	} else if (cond) {
		return {
			status: 0,
			message: userMessage,
		};
	} else {
		return {
			status: 1,
		};
	}
};

module.exports.catchError = function (err) {
	console.log(err);
	var message = err;
	if (err && err.message) {
		message = err.message;
	}
	return {
		status: 0,
		message: message,
	};
};
