//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const invoicesTotalAmount = require("../utils/invoicesTotalAmount");
const updateInvoiceRecord = require("../utils/updateInvoiceRecord");

//controllers
const merchantInvoicePay = require("../transactions/intraBank/merchantInvoicePay");
const Invoice = require("../../models/merchant/Invoice");


// transactions
const txstate = require("../transactions/services/states");

//models
const Bank = require("../../models/Bank");
const Infra = require("../../models/Infra");
const MerchantRule = require("../../models/merchant/MerchantRule");
const MerchantPosition = require("../../models/merchant/Position");
const Merchant = require("../../models/merchant/Merchant");

module.exports = (req, res) => {
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
				Merchant.findOne(
					{ _id: cashier.merchant_id },
					async (err, merchant) => {
						let errRes = errorMessage(
							err,
							merchant,
							"Cashier's Merchant not found"
						);
						if (errRes.status == 0) {
							res.status(200).json(errRes);
						} else {
							// Initiate transaction state
							const master_code = await txstate.initiate(
								merchant.bank_id,
								" Merchant cashier to Merchant",
								cashier._id,
								cashier.cash_in_hand

							);
							MerchantRule.findOne(
								{
									merchant_id: merchant._id,
									type: "M-C",
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
											const total_amount = await invoicesTotalAmount(
												invoices,
												merchant._id
											);
											const invoiceDetails = await Invoice.findOne({ _id: invoices[0].id })
											let otherInfo = {
												total_amount: total_amount,
												master_code: master_code,
												paid_by: "MC",
												payer_id: cashier._id,
												payer_branch_id: cashier.branch_id,
												merchant_id: merchant._id,
												invoiceDetails: invoiceDetails,
												invoices: invoices
											};
											txstate.waitingForCompletion(master_code, otherInfo);

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


												let status = await updateInvoiceRecord(

													otherInfo
												);
												if (status != null) {
													throw new Error(status);
												}
												//update cash in hand
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
					}
				);
			}
		}
	);
};
