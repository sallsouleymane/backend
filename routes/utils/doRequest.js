/* If this file is updated, also build docker for receive.js which is a rabbitmq queue receiver*/

const request = require("request");
module.exports = (options) => {
	return new Promise(function (resolve, reject) {
		request(options, function (error, res, body) {
			if (!error && res.statusCode === 200) {
				resolve(body);
			} else {
				reject(error);
			}
		});
	});
};
