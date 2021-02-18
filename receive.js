var amqp = require("amqplib/callback_api");
const execute = require("./controllers/transactions/services/execute");

const queue_name = process.env.QUEUE_NAME;
const connection_url = process.env.QUEUE_CONN_URL;

amqp.connect(connection_url, function (error0, connection) {
	try {
		if (error0) {
			throw error0;
		}
		console.log("Connected to ", connection_url);
		require("./dbConfig");
		connection.createChannel(function (error1, channel) {
			if (error1) {
				throw error1;
			}

			var queue = queue_name;

			channel.assertQueue(queue, {
				durable: false,
			});

			console.log(
				" [*] Waiting for messages in %s. To exit press CTRL+C",
				queue
			);

			channel.consume(
				queue,
				async function (msg) {
					console.log(
						" [x] Received %s from queue %s",
						msg.content.toString(),
						queue
					);
					let transaction = JSON.parse(msg.content.toString());
					console.log("Executing ", transaction);
					await execute(transaction, queue);
					console.log("Done");
				},
				{
					noAck: true,
				}
			);
		});
	} catch (err) {
		console.log(err);
	}
});
