const TxState = require("../../models/TxState");

function initiate() {
	tx = { master_code: master_code, state: "INIT" };
	TxState.save(tx);
}

function waitingForCompletion() {
	tx = { state: "WFC" };
	TxState.update({ master_code: master_code }, tx);
}

function completed() {
	tx = { master_code: master_code, state: "WFC" };
	TxState.update(tx);
}
