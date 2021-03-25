/* If this file is updated, also build docker for receive.js which is a rabbitmq queue receiver*/

const doRequest = require("../routes/utils/doRequest");
const config = require("../config.json");

module.exports.createWallet = async (arr) => {
	try {
		console.log("Blockchain service: createWallet " + arr);
		let err = [];
		await Promise.all(
			arr.map(async (url) => {
				let options = {
					uri: "http://" + config.blockChainIP + ":8000/createEWallet",
					method: "POST",
					json: {
						wallet_id: url,
						type: "test",
						remarks: "",
					},
				};
				let res = await doRequest(options);
				if (res.status === 0) {
					console.log(res);
					err.push(res.message);
				}
			})
		);
		return err.toString();
	} catch (err) {
		throw err;
	}
};

module.exports.getStatement = async (arr, user_id = "") => {
	try {
		console.log("Blockchain service: getStatement " + arr);
		let options = {
			uri: "http://" + config.blockChainIP + ":8000/getEWalletStatement",
			method: "POST",
			json: {
				wallet_id: arr.toString(),
				user_id: user_id,
			},
		};

		let res = await doRequest(options);
		if (res.status && res.status === 1) {
			return res.data;
		} else {
			console.log(res);
			return [];
		}
	} catch (err) {
		throw err;
	}
};

module.exports.rechargeNow = async (arr) => {
	try {
		console.log("Blockchain service: rechargeNow " + arr);
		var err = [];
		await Promise.all(
			arr.map(async (url) => {
				var options = {
					uri: "http://" + config.blockChainIP + ":8000/rechargeEWallet",
					method: "POST",
					json: {
						wallet_id: url.to.toString(),
						amount: url.amount.toString(),
						remarks: "recharge",
					},
				};
				let res = await doRequest(options);
				if (res.status == 1) {
					err.push(res.Reason);
				} else {
					console.log(res);
				}
			})
		);
		return err.toString();
	} catch (err) {
		throw err;
	}
};

module.exports.getChildStatements = async (arr) => {
	try {
		console.log("Blockchain service: getChildStatements " + arr);
		var options = {
			uri: "http://" + config.blockChainIP + ":8000/getChildIds",
			method: "POST",
			json: {
				master_id: arr.toString(),
			},
		};

		let res = await doRequest(options);
		console.log(res);
		if (res.status && res.status == 1) {
			return res.data;
		} else {
			return [];
		}
	} catch (err) {
		throw err;
	}
};

module.exports.getTransactionCount = async (arr) => {
	try {
		console.log("Blockchain service: getTransactionCount " + arr);
		var options = {
			uri: "http://" + config.blockChainIP + ":8000/getEWalletTransactionCount",
			method: "POST",
			json: {
				wallet_id: arr.toString(),
			},
		};

		let res = await doRequest(options);
		if (res.status && res.status == 1) {
			return res.data;
		} else {
			console.log(res);
			return 0;
		}
	} catch (err) {
		throw err;
	}
};

module.exports.getBalance = async (arr) => {
	try {
		console.log("Blockchain service: getBalance " + arr);
		var options = {
			uri: "http://" + config.blockChainIP + ":8000/showEWalletBalance",
			method: "POST",
			json: {
				wallet_id: arr.toString(),
			},
		};

		let res = await doRequest(options);
		if (res.status && res.status === 1) {
			return res.data.balance;
		} else {
			console.log(res);
			return 0;
		}
	} catch (err) {
		throw err;
	}
};

module.exports.initiateTransfer = async function (transaction) {
	try {
		console.log("Blockchain service: initiateTransfer " + transaction);

		var options = {
			uri: "http://" + config.blockChainIP + ":8000/transferBtwEWallets",
			method: "POST",
			json: {
				transaction_type: transaction.transaction_type
					? transaction.transaction_type
					: "",
				wallet_from: transaction.from.toString(),
				wallet_to: transaction.to.toString(),
				amount: transaction.amount.toString(),
				from_name: transaction.from_name,
				to_name: transaction.to_name,
				sender_id: transaction.sender_id,
				receiver_id: transaction.receiver_id,
				remarks: transaction.note.toString(),
				master_id: transaction.master_code.toString(),
				child_id: transaction.child_code.toString(),
			},
		};
		let res = await doRequest(options);
		console.log(res);
		return res;
	} catch (err) {
		throw err;
	}
};

module.exports.initiateMultiTransfer = async function (transactions) {
	try {
		console.log("Blockchain service: initiateMultiTransfer " + transactions);
		let argument = transactions.map((transaction) => {
			return {
				transaction_type: transaction.transaction_type
					? transaction.transaction_type
					: "",
				from_wallet: transaction.from.toString(),
				to_wallet: transaction.to.toString(),
				amount: transaction.amount.toString(),
				from_name: transaction.from_name,
				to_name: transaction.to_name,
				sender_id: transaction.sender_id,
				receiver_id: transaction.receiver_id,
				remarks: transaction.note.toString(),
				master_id: transaction.master_code.toString(),
				child_id: transaction.child_code.toString(),
			};
		});

		var options = {
			uri: "http://" + config.blockChainIP + ":8000/multipleTransfers",
			method: "POST",
			json: { transfers: argument },
		};
		let res = await doRequest(options);
		console.log(res);
		return res;
	} catch (err) {
		throw err;
	}
};
