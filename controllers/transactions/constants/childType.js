/* If this file is updated, also build docker for receive.js which is a rabbitmq queue receiver*/

// Below code must be five characters only including dash(-)

const AMOUNT = "-AMNT";
const REVENUE = "-REVE";
const INFRA_FIXED = "-INFX";
const INFRA_PERCENT = "-INPR"; // infra percent
const SENDER = "-SEND"; //sender share
const CLAIMER = "-CLAM"; //claimer share
const BANK_MASTER = "-BAMA"; //bank master
const INFRA_MASTER = "-INMA"; //infra master
const CLAIM_MASTER = "-CLMA"; //claimer master
const SEND_MASTER = "-SEMA"; // sender master
const PARTNER_SHARE = "-PASH"; //Partner share
const INTER_BANK_PERCENT = "-IBPR";
const INTER_BANK_FIXED = "-IBFX";
const INTER_BANK_MASTER = "-IBMA";
const REVERT = "-RVRT";

module.exports = {
	AMOUNT: AMOUNT,
	REVENUE: REVENUE,
	INFRA_FIXED: INFRA_FIXED,
	INFRA_PERCENT: INFRA_PERCENT,
	SENDER: SENDER,
	CLAIMER: CLAIMER,
	BANK_MASTER: BANK_MASTER,
	INFRA_MASTER: INFRA_MASTER,
	CLAIM_MASTER: CLAIM_MASTER,
	SEND_MASTER: SEND_MASTER,
	PARTNER_SHARE: PARTNER_SHARE,
	OTHER_BANK_SHARE: OTHER_BANK_SHARE,
	INTER_BANK_PERCENT: INTER_BANK_PERCENT,
	INTER_BANK_FIXED: INTER_BANK_FIXED,
	INTER_BANK_MASTER: INTER_BANK_MASTER,
	REVERT: REVERT,
};
