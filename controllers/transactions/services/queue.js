var amqp = require("amqplib/callback_api");
var config = require("../../../config.json");

module.exports.send = function (queue_name, transaction) {
	try {
		amqp.connect("amqp://" + config.rabbitmqIP, function (error0, connection) {
			if (error0) {
				console.log(error0);
			}
			connection.createChannel(function (error1, channel) {
				if (error1) {
					console.log(error1);
				}

				var queue = queue_name;
				var msg = Buffer.from(JSON.stringify(transaction));

				channel.assertQueue(queue, {
					durable: false,
				});
				channel.sendToQueue(queue, Buffer.from(msg));

				console.log(" [x] Sent %s to queue %s", msg, queue_name);
				connection.close();
			});
		});
	} catch (err) {
		console.log(err);
	}
};
