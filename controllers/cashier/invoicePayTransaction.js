//utils
const sendSMS = require("../../routes/utils/sendSMS");
const sendMail = require("../../routes/utils/sendMail");
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const { calculateShare } = require("../../routes/utils/calculateShare");

//controllers
const cashierInvoicePay = require("../transactions/intraBank/cashierInvoicePay");

// transactions
const txstate = require("../transactions/states");

//models
const Bank = require("../../models/Bank");
const Branch = require("../../models/Branch");
const Infra = require("../../models/Infra");
const MerchantRule = require("../../models/merchant/MerchantRule");
const IBMerchantRule = require("../../models/merchant/InterBankRule");
const MerchantBranch = require("../../models/merchant/MerchantBranch");
const MerchantPosition = require("../../models/merchant/Position");
const Merchant = require("../../models/merchant/Merchant");
const Cashier = require("../../models/Cashier");
const Invoice = require("../../models/merchant/Invoice");
const InvoiceGroup = require("../../models/merchant/InvoiceGroup");
const Partner = require("../../models/partner/Partner");
const PartnerCashier = require("../../models/partner/Cashier");
const PartnerBranch = require("../../models/partner/Branch");
const InterBankRule = require("../../models/InterBankRule");

module.exports = async (req, res) => {
	// Initiate transaction state
	const master_code = await txstate.initiate();

	const { invoices, merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Cashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let errRes = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (errRes.status == 0) {
				res.status(200).json(errRes);
			} else {
				MerchantRule.findOne(
					{ merchant_id: merchant_id, type: "NWM-F", status: 1, active: 1 },
					(err, fee) => {
						let errRes = errorMessage(err, fee, "Fee rule not found");
						if (errRes.status == 0) {
							res.status(200).json(errRes);
						} else {
							MerchantRule.findOne(
								{
									merchant_id: merchant_id,
									type: "NWM-C",
									status: 1,
									active: 1,
								},
								async (err, comm) => {
									let errRes = errorMessage(
										err,
										comm,
										"Commission rule not found"
									);
									if (errRes.status == 0) {
										res.status(200).json(errRes);
									} else {
										try {
											// all the users
											let branch = await Branch.findOne({
												_id: cashier.branch_id,
												status: 1,
											});
											if (branch == null) {
												throw new Error("Cashier has invalid branch");
											}

											let bank = await Bank.findOne({
												_id: branch.bank_id,
												status: 1,
											});
											if (bank == null) {
												throw new Error("Cashier's Branch has invalid bank");
											}

											let infra = await Infra.findOne({
												_id: bank.user_id,
											});
											if (infra == null) {
												throw new Error("Cashier's bank has invalid infra");
											}

											let merchant = await Merchant.findOne({
												_id: merchant_id,
											});
											if (merchant == null) {
												throw new Error("Invoice has invalid merchant");
											}

											const today = new Date();
											await Merchant.findOneAndUpdate(
												{
													_id: merchant._id,
													last_paid_at: {
														$lte: new Date(today.setHours(00, 00, 00)),
													},
												},
												{ amount_collected: 0 }
											);

											let total_amount = await calculateTotalAmount(
												invoices,
												merchant_id
											);
											let transfer = {
												amount: total_amount,
												master_code: master_code,
											};

											var result = await cashierInvoicePay(
												transfer,
												infra,
												bank,
												branch,
												merchant,
												fee,
												comm
											);
											if (result.status == 1) {
												var c = await Cashier.updateOne(
													{ _id: cashier._id },
													{
														$inc: {
															cash_received: total_amount + result.bankFee,
															cash_in_hand: total_amount + result.bankFee,
															fee_generated: result.partnerFeeShare,
															commission_generated: result.partnerCommShare,
															total_trans: invoices.length,
														},
													}
												);
												if (c == null) {
													status_update_feedback =
														"Bank cashier's status can not be updated";
												}

												let otherInfo = {
													total_amount: total_amount,
													master_code: master_code,
													paid_by: "BC",
													payer_id: cashier._id,
												};

												let status = await updatePaymentRecords(
													req.body,
													otherInfo,
													master_code
												);
												if (status != null) {
													throw new Error(status);
												}

												txstate.reported(master_code);
												res.status(200).json(result);
											} else {
												res.status(200).json(result);
											}
										} catch (err) {
											console.log(err);
											var message = err.toString();
											if (err.message) {
												message = err.message;
											}
											res
												.status(200)
												.json({ status: 0, message: message, err: err });
										}
									}
								}
							);
						}
					}
				);
			}
		}
	);
};

async function calculateTotalAmount(invoices, merchant_id) {
	try {
		var total_amount = 0;
		for (invoice of invoices) {
			var { id, penalty } = invoice;
			var inv = await Invoice.findOne({
				_id: id,
				merchant_id: merchant_id,
				paid: 0,
				is_validated: 1,
			});
			if (inv == null) {
				throw new Error(
					"Invoice id " +
						id +
						" is already paid or not validated or it belongs to different merchant"
				);
			}
			total_amount += inv.amount + penalty;
		}
		if (total_amount < 0) {
			throw new Error("Amount is a negative value");
		}
		return total_amount;
	} catch (err) {
		throw err;
	}
}

async function updatePaymentRecords(reqData, otherData) {
	const { invoices, merchant_id } = reqData;
	const { total_amount, master_code, paid_by, payer_id } = otherData;
	var last_paid_at = new Date();
	var m = await Merchant.updateOne(
		{ _id: merchant_id },
		{
			last_paid_at: last_paid_at,
			$inc: {
				amount_collected: total_amount,
				amount_due: -total_amount,
				bills_paid: invoices.length,
			},
		}
	);
	if (m == null) {
		throw new Error("Merchant status can not be updated");
	}

	// var ms = await MerchantPosition.updateOne(
	// 	{ _id: i.creator_id },
	// 	{
	// 		last_paid_at: last_paid_at,
	// 	}
	// );
	// if (ms == null) {
	// 	status_update_feedback =
	// 		"Merchant Staff status can not be updated";
	// }

	// var mb = await MerchantBranch.updateOne(
	// 	{ _id: ms.branch_id },
	// 	{
	// 		last_paid_at: last_paid_at,
	// 		$inc: {
	// 			amount_collected: total_amount,
	// 			amount_due: -total_amount,
	// 			bills_paid: invoices.length,
	// 		},
	// 	}
	// );
	// if (mb == null) {
	// 	status_update_feedback =
	// 		"Merchant branch status can not be updated";
	// }

	for (invoice of invoices) {
		let { id, penalty } = invoice;
		let i = await Invoice.findOneAndUpdate(
			{ _id: id },
			{
				paid: 1,
				paid_by: paid_by,
				payer_id: payer_id,
				penalty: penalty,
				transaction_code: master_code,
			}
		);
		if (i == null) {
			throw new Error("Invoice paid status can not be updated");
		}

		var ig = await InvoiceGroup.updateOne(
			{ _id: i.group_id },
			{
				last_paid_at: last_paid_at,
				$inc: {
					bills_paid: 1,
				},
			}
		);
		if (ig == null) {
			throw new Error("Invoice group status can not be updated");
		}

		content =
			"E-Wallet:  Amount " +
			i.amount +
			" is paid for invoice nummber " +
			i.number +
			" for purpose " +
			i.description;
		sendSMS(content, i.mobile);
	}
	return null;
}
