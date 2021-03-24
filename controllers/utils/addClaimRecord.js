//models
const CashierClaim = require("../../models/CashierClaim");

module.exports = function (reqData, otherData, next) {
	const {
		transferCode,
		proof,
		givenname,
		familyname,
		receiverGivenName,
		receiverFamilyName,
		mobile,
	} = reqData;

	const { cashierId, sendRecord } = otherData;

	let data = new CashierClaim();
	data.transaction_code = transferCode;
	data.proof = proof;
	data.cashier_id = cashierId;
	data.amount = sendRecord.amount;
	data.fee = sendRecord.fee;
	data.is_inclusive = sendRecord.is_inclusive;
	data.sender_name = givenname + " " + familyname;
	data.sender_mobile = mobile;
	data.receiver_name = receiverGivenName + " " + receiverFamilyName;
	data.master_code = sendRecord.master_code;

	data.save((err, cashierClaimObj) => {
		return next(err, cashierClaimObj);
	});
};
