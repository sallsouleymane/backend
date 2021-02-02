var amqp = require("amqplib/callback_api");

module.exports.send = function (queue_name, transaction) {
	amqp.connect("amqp://localhost", function (error0, connection) {
		if (error0) {
			throw error0;
		}
		connection.createChannel(function (error1, channel) {
			if (error1) {
				throw error1;
			}

			var queue = queue_name;
			var msg = Buffer.from(JSON.stringify(transaction));

			channel.assertQueue(queue, {
				durable: false,
			});
			channel.sendToQueue(queue, Buffer.from(msg));

			console.log(" [x] Sent %s to queue %s", msg, queue_name);
		});
		setTimeout(function () {
			connection.close();
			process.exit(0);
		}, 500);
	});
};
