/* If this file is updated, also build docker for receive.js which is a rabbitmq queue receiver*/

const INIT = "INITIATED";
const WAIT = "WAITING";
const CANCEL = "CANCELLED";
const FAIL = "FAILED";
const DONE = "COMPLETED";
const REVERT = "REVERTED";

module.exports = {
	INIT: INIT,
	WAIT: WAIT,
	CANCEL: CANCEL,
	FAIL: FAIL,
	DONE: DONE,
	REVERT: REVERT,
};
