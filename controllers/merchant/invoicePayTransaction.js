//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const invoicesTotalAmount = require("../utils/invoicesTotalAmount");
const updateInvoiceRecord = require("../utils/updateInvoiceRecord");

//controllers
const merchantInvoicePay = require("../transactions/intraBank/merchantInvoicePay");

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
const User = require("../../models/User");
const Invoice = require("../../models/merchant/Invoice");
const InvoiceGroup = require("../../models/merchant/InvoiceGroup");
const Partner = require("../../models/partner/Partner");
const PartnerCashier = require("../../models/partner/Cashier");
const PartnerBranch = require("../../models/partner/Branch");
const InterBankRule = require("../../models/InterBankRule");

module.exports = async (req, res) => {
	// Initiate transaction state
	const master_code = await txstate.initiate();
	const { invoices } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantPosition.findOne(
		{
			username: jwtusername,
			type: "cashier",
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
				Merchant.findOne({ _id: cashier.merchant_id }, (err, merchant) => {
					let errRes = errorMessage(
						err,
						merchant,
						"Cashier's Merchant not found"
					);
					if (errRes.status == 0) {
						res.status(200).json(errRes);
					} else {
						MerchantRule.findOne(
							{ merchant_id: merchant._id, type: "M-C", status: 1, active: 1 },
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
										let bank = await Bank.findOne({
											_id: comm.bank_id,
											status: 1,
										});
										if (bank == null) {
											throw new Error("Merchant Cashier has invalid bank");
										}
										let infra = await Infra.findOne({
											_id: bank.user_id,
										});
										if (infra == null) {
											throw new Error("Cashier's bank has invalid infra");
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

										const total_amount = await invoicesTotalAmount(
											invoices,
											merchant._id
										);
										let transfer = {
											amount: total_amount,
											master_code: master_code,
										};
										var result = await merchantInvoicePay(
											transfer,
											infra,
											bank,
											merchant,
											comm
										);
										if (result.status == 1) {
											var ms = await MerchantPosition.updateOne(
												{ _id: cashier._id },
												{
													$set: { last_paid_at: today },
													$inc: {
														cash_in_hand: total_amount,
													},
												}
											);
											if (ms == null) {
												throw new Error(
													"Merchant Cashier status can not be updated"
												);
											}

											req.body.merchant_id = merchant._id;
											let otherInfo = {
												total_amount: total_amount,
												master_code: master_code,
												paid_by: "MC",
												payer_id: cashier._id,
											};
											let status = await updateInvoiceRecord(
												req.body,
												otherInfo
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
										res.status(200).json(catchError(err));
									}
								}
							}
						);
					}
				});
			}
		}
	);
};