var amqp = require("amqplib/callback_api");
const execute = require("./controllers/transactions/services/execute");
const TxState = require("./models/TxState");

// const queue_name = process.argv[2];
// const connection_url = process.argv[3];

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
				durable: true,
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
					let content = JSON.parse(msg.content.toString());

					// let childTrans = await TxState.findOne(
					// 	{
					// 		_id: transaction.master_code,
					// 		"childTx.transaction.child_code": transaction.child_code,
					// 	},
					// 	{ "childTx.$": 1 }
					// );
					// console.log(childTrans);

					// let txArr = tx.childTx;
					// var childTrans = txArr.find(
					// 	(childTx) =>
					// 		childTx.transaction.child_code == child_code && childTx.state == 0
					// );
					// console.log(childTrans);
					console.log("Executing ", transaction);
					let result = await execute(
						[content.transaction],
						content.category,
						queue
					);
					console.log(result);
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
