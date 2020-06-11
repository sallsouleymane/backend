const doRequest = require("../routes/utils/doRequest");
const sendSMS = require("../routes/utils/sendSMS");
const sendMail = require("../routes/utils/sendMail");
const config = require("../config.json");
const FailedTX = require("../models/FailedTXLedger");

module.exports.createWallet = async (arr) => {
	let err = [];
	await Promise.all(
		arr.map(async url => {
			let options = {
				uri: "http://" + config.blockChainIP + ":8000/createEWallet",
				method: "POST",
				json: {
					wallet_id: url,
					type: "test",
					remarks: ""
				}
			};
			let res = await doRequest(options);
			console.log(res);
			if (res.status === 0) {
				err.push(res.message);
			}
		})
	);
	return err.toString();
};

module.exports.getStatement = async arr => {
	let options = {
		uri: "http://" + config.blockChainIP + ":8000/getEWalletStatement",
		method: "GET",
		json: {
			wallet_id: arr.toString()
		}
	};

	let res = await doRequest(options);
	if (res.status && res.status === 1) {
		return res.data;
	} else {
		return [];
	}
};

module.exports.rechargeNow = async arr => {
	var err = [];
	await Promise.all(
		arr.map(async url => {
			var options = {
				uri: "http://" + config.blockChainIP + ":8000/rechargeEWallet",
				method: "POST",
				json: {
					wallet_id: url.to.toString(),
					amount: url.amount.toString(),
					remarks: "recharge"
				}
			};
			let res = await doRequest(options);
			if (res.status == 1) {
				err.push(res.Reason);
			}
		})
	).catch(errr => {
		return errr;
	});
	return err.toString();
};

module.exports.transferThis = async (t1, t2 = false, t3 = false, t4 = false) => {
	var err = [];

	var url = t1;

	var mc = url.master_code ? url.master_code : new Date().getTime();
	var cc = url.child_code ? url.child_code : new Date().getTime();

	var options = {
		uri: "http://" + config.blockChainIP + ":8000/transferBtwEWallets",
		method: "POST",
		json: {
			wallet_id1: url.from.toString(),
			wallet_id2: url.to.toString(),
			amount: url.amount.toString(),
			master_id: mc.toString(),
			child_id: cc.toString(),
			remarks: url.note.toString()
		}
	};

	let res = await doRequest(options);
	console.log("one: " + res.toString());
	if (res.status == 0) {
		if (res.message) {
			err.push(res.message);
		} else {
			err.push("Blockchain connection error");
		}
	} else {
		if (url.email1 && url.email1 != "") {
			sendMail(
				"<p>You have sent " + url.amount + " to the wallet " + url.to + "</p>",
				"Payment Sent",
				url.email1
			);
		}
		if (url.email2 && url.email2 != "") {
			sendMail(
				"<p>You have received " + url.amount + " from the wallet " + url.from + "</p>",
				"Payment Received",
				url.email2
			);
		}
		if (url.mobile1 && url.mobile1 != "") {
			sendSMS("You have sent " + url.amount + " to the wallet " + url.to, url.mobile1);
		}
		if (url.mobile2 && url.mobile2 != "") {
			sendSMS("You have received " + url.amount + " from the wallet " + url.from, url.mobile2);
		}
		if (t2) {
			url = t2;
			mc = url.master_code ? url.master_code : new Date().getTime();
			cc = url.child_code ? url.child_code : new Date().getTime();
			options = {
				uri: "http://" + config.blockChainIP + ":8000/transferBtwEWallets",
				method: "POST",
				json: {
					wallet_id1: url.from.toString(),
					wallet_id2: url.to.toString(),
					amount: url.amount.toString(),
					master_id: mc.toString(),
					child_id: cc.toString(),
					remarks: url.note.toString()
				}
			};

			res = await doRequest(options);
			console.log("two: " + res.toString());
			if (res.status == 0) {
				if (res.message) {
					err.push(res.message);
				} else {
					err.push("Blockchain connection error");
				}
			} else {
				if (url.email1 && url.email1 != "") {
					sendMail(
						"<p>You have sent " + url.amount + " to the wallet " + url.to + "</p>",
						"Payment Sent",
						url.email1
					);
				}
				if (url.email2 && url.email2 != "") {
					sendMail(
						"<p>You have received " + url.amount + " from the wallet " + url.from + "</p>",
						"Payment Received",
						url.email2
					);
				}
				if (url.mobile1 && url.mobile1 != "") {
					sendSMS("You have sent " + url.amount + " to the wallet " + url.to, url.mobile1);
				}
				if (url.mobile2 && url.mobile2 != "") {
					sendSMS("You have received " + url.amount + " from the wallet " + url.from, url.mobile2);
				}

				if (t3) {
					url = t3;
					mc = url.master_code ? url.master_code : new Date().getTime();
					cc = url.child_code ? url.child_code : new Date().getTime();
					options = {
						uri: "http://" + config.blockChainIP + ":8000/transferBtwEWallets",
						method: "POST",
						json: {
							wallet_id1: url.from.toString(),
							wallet_id2: url.to.toString(),
							amount: url.amount.toString(),
							master_id: mc.toString(),
							child_id: cc.toString(),
							remarks: url.note.toString()
						}
					};

					res = await doRequest(options);
					console.log("three: " + res.toString());
					if (res.status == 0) {
						if (res.message) {
							err.push(res.message);
						} else {
							err.push("Blockchain connection error");
						}
					} else {
						if (url.email1 && url.email1 != "") {
							sendMail(
								"<p>You have sent " + url.amount + " to the wallet " + url.to + "</p>",
								"Payment Sent",
								url.email1
							);
						}
						if (url.email2 && url.email2 != "") {
							sendMail(
								"<p>You have received " + url.amount + " from the wallet " + url.from + "</p>",
								"Payment Received",
								url.email2
							);
						}
						if (url.mobile1 && url.mobile1 != "") {
							sendSMS("You have sent " + url.amount + " to the wallet " + url.to, url.mobile1);
						}
						if (url.mobile2 && url.mobile2 != "") {
							sendSMS(
								"You have received " + url.amount + " from the wallet " + url.from,
								url.mobile2
							);
						}

						//Code By Hatim
						if (t4) {
							url = t4;
							mc = url.master_code ? url.master_code : new Date().getTime();
							cc = url.child_code ? url.child_code : new Date().getTime();
							options = {
								uri: "http://" + config.blockChainIP + ":8000/transferBtwEWallets",
								method: "POST",
								json: {
									wallet_id1: url.from.toString(),
									wallet_id2: url.to.toString(),
									amount: url.amount.toString(),
									master_id: mc.toString(),
									child_id: cc.toString(),
									remarks: url.note.toString()
								}
							};

							res = await doRequest(options);
							console.log("Four: " + res.toString());
							if (res.status == 0) {
								if (res.message) {
									err.push(res.message);
								} else {
									err.push("Blockchain connection error");
								}
							} else {
								if (url.email1 && url.email1 != "") {
									sendMail(
										"<p>You have sent " + url.amount + " to the wallet " + url.to + "</p>",
										"Payment Sent",
										url.email1
									);
								}
								if (url.email2 && url.email2 != "") {
									sendMail(
										"<p>You have received " + url.amount + " from the wallet " + url.from + "</p>",
										"Payment Received",
										url.email2
									);
								}
								if (url.mobile1 && url.mobile1 != "") {
									sendSMS("You have sent " + url.amount + " to the wallet " + url.to, url.mobile1);
								}
								if (url.mobile2 && url.mobile2 != "") {
									sendSMS(
										"You have received " + url.amount + " from the wallet " + url.from,
										url.mobile2
									);
								}
							}
						}

						//End by hatim
					}
				}
			}
		}
	}

	return err.toString();
};

module.exports.getChildStatements = async arr => {
	var options = {
		uri: "http://" + config.blockChainIP + ":8000/getChildIds",
		method: "GET",
		json: {
			master_id: arr.toString()
		}
	};

	let res = await doRequest(options);
	if (res.status && res.status == 1) {
		return res.data;
	} else {
		return [];
	}
};

module.exports.getTransactionCount = async arr => {
	var options = {
		uri: "http://" + config.blockChainIP + ":8000/getEWalletTransactionCount",
		method: "GET",
		json: {
			wallet_id: arr.toString()
		}
	};

	let res = await doRequest(options);

	if ( res.status && res.status == 1) {
		return res.data
	} else {
		return 0;
	}
};

module.exports.getBalance = async arr => {
	var options = {
		uri: "http://" + config.blockChainIP + ":8000/showEWalletBalance",
		method: "GET",
		json: {
			wallet_id: arr.toString()
		}
	};

	let res = await doRequest(options);

	if (res.status && res.status === 1) {
		return res.data.balance;
	} else {
		return 0;
	}
};

module.exports.initiateTransfer = async function (transaction, tx_id = "") {
	// var status = [];
	// await Promise.all(
	// transactions.map(async (transaction) => {

	var options = {
		uri: "http://" + config.blockChainIP + ":8000/transferBtwEWallets",
		method: "POST",
		json: {
			wallet_id1: transaction.from.toString(),
			wallet_id2: transaction.to.toString(),
			amount: transaction.amount.toString(),
			remarks: transaction.note.toString(),
			master_id: transaction.master_code.toString(),
			child_id: transaction.child_code.toString(),
		},
	};
	let res = await doRequest(options);
	if (res.status == 0) {
		if (tx_id != "") {
			await FailedTX.findOneAndUpdate({ _id: tx_id }, { status: 2});
		}
		console.log(res);
		let tx = new FailedTX();
		tx.wallet_id = transaction.from.toString();
		tx.transaction = transaction;
		tx.user_id = user_id;
		tx.message = res.message;
		tx.status = 0;
		tx.save((err) => {
			console.log(err);
		});
	} else {
		if (tx_id != "") {
			await FailedTX.findOneAndUpdate({ _id: tx_id }, { status: 1});
		}
		if (transaction.email1 && transaction.email1 != "") {
			sendMail(
				"<p>You have sent " +
					transaction.amount +
					" to the wallet " +
					transaction.to +
					"</p>",
				"Payment Sent",
				transaction.email1
			);
		}
		if (transaction.email2 && transaction.email2 != "") {
			sendMail(
				"<p>You have received " +
					transaction.amount +
					" from the wallet " +
					transaction.from +
					"</p>",
				"Payment Received",
				transaction.email2
			);
		}
		if (transaction.mobile1 && transaction.mobile1 != "") {
			sendSMS(
				"You have sent " +
					transaction.amount +
					" to the wallet " +
					transaction.to,
				transaction.mobile1
			);
		}
		if (transaction.mobile2 && transaction.mobile2 != "") {
			sendSMS(
				"You have received " +
					transaction.amount +
					" from the wallet " +
					transaction.from,
				transaction.mobile2
			);
		}
	}
	return res;
	// })
	// );
	// return status;
};
