//utils
const sendSMS = require("../../routes/utils/sendSMS");
const sendMail = require("../../routes/utils/sendMail");
const makeotp = require("../../routes/utils/makeotp");

//models
const CashierSend = require("../../models/CashierSend");

module.exports = function (reqData, otherData, next) {
	const {
		givenname,
		familyname,
		note,
		senderIdentificationCountry,
		senderIdentificationType,
		senderIdentificationNumber,
		senderIdentificationValidTill,
		address1,
		state,
		zip,
		ccode,
		country,
		email,
		mobile,
		withoutID,
		requireOTP,
		receiverMobile,
		receiverccode,
		receiverGivenName,
		receiverFamilyName,
		receiverCountry,
		receiverEmail,
		receiverIdentificationCountry,
		receiverIdentificationType,
		receiverIdentificationNumber,
		receiverIdentificationValidTill,
		receiverIdentificationAmount,
		isInclusive,
	} = reqData;

	const {
		cashierId,
		userId,
		branchType,
		branchId,
		transactionCode,
		ruleType,
		masterCode,
	} = otherData;

	let data = new CashierSend();
	let temp = {
		ccode: ccode,
		mobile: mobile,
		givenname: givenname,
		familyname: familyname,
		address1: address1,
		state: state,
		zip: zip,
		country: country,
		email: email,
		note: note,
	};
	data.sender_info = JSON.stringify(temp);
	temp = {
		country: senderIdentificationCountry,
		type: senderIdentificationType,
		number: senderIdentificationNumber,
		valid: senderIdentificationValidTill,
	};
	data.sender_id = JSON.stringify(temp);
	temp = {
		mobile: receiverMobile,
		ccode: receiverccode,
		givenname: receiverGivenName,
		familyname: receiverFamilyName,
		country: receiverCountry,
		email: receiverEmail,
	};
	data.receiver_info = JSON.stringify(temp);
	temp = {
		country: receiverIdentificationCountry,
		type: receiverIdentificationType,
		number: receiverIdentificationNumber,
		valid: receiverIdentificationValidTill,
	};
	data.receiver_id = JSON.stringify(temp);
	data.amount = receiverIdentificationAmount;
	data.is_inclusive = isInclusive;
	data.cashier_id = cashierId;
	data.user_id = userId;
	data.send_branch_type = branchType;
	data.send_branch_id = branchId;
	data.transaction_code = transactionCode;
	data.rule_type = ruleType;
	data.master_code = masterCode;

	//send transaction sms after actual transaction

	data.without_id = withoutID ? 1 : 0;
	if (requireOTP) {
		data.require_otp = 1;
		data.otp = makeotp(6);
		content = data.otp + " - Send this OTP to the Receiver";
		if (mobile && mobile != null) {
			sendSMS(content, mobile);
		}
		if (email && email != null) {
			sendMail(content, "Transaction OTP", email);
		}
	}

	data.save((err, d) => {
		return next(err, d);
	});
};
