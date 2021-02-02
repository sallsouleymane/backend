var amqp = require("amqplib/callback_api");
var util = require("util");
const execute = require("./controllers/transactions/services/execute");

const queue_name = process.argv[2];

amqp.connect("amqp://localhost", function (error0, connection) {
	if (error0) {
		throw error0;
	}
	connection.createChannel(function (error1, channel) {
		if (error1) {
			throw error1;
		}

		var queue = queue_name;

		channel.assertQueue(queue, {
			durable: false,
		});

		console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", queue);

		channel.consume(
			queue,
			async function (msg) {
				console.log(
					" [x] Received %s from queue %s",
					msg.content.toString(),
					queue
				);
				let transaction = JSON.parse(msg.content.toString());
				let res = await execute(transaction, queue);
				if (res.status == 1) {
					channel.ack(msg);
				}
			},
			{
				noAck: false,
			}
		);
	});
});
