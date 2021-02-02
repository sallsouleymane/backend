//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const invoicesTotalAmount = require("../utils/invoicesTotalAmount");
const updateInvoiceRecord = require("../utils/updateInvoiceRecord");

//controllers
const cashierInvoicePay = require("../transactions/intraBank/cashierInvoicePay");

// transactions
const txstate = require("../transactions/services/states");

//models
const Bank = require("../../models/Bank");
const Branch = require("../../models/Branch");
const Infra = require("../../models/Infra");
const MerchantRule = require("../../models/merchant/MerchantRule");
const Merchant = require("../../models/merchant/Merchant");
const Cashier = require("../../models/Cashier");
const Partner = require("../../models/partner/Partner");
const PartnerCashier = require("../../models/partner/Cashier");
const PartnerBranch = require("../../models/partner/Branch");

module.exports.cashierInvoicePay = async (req, res) => {
	// Initiate transaction state
	const master_code = await txstate.initiate();
	const today = new Date();

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

											await Merchant.updateOne(
												{
													_id: merchant_id,
													last_paid_at: {
														$lte: new Date(today.setHours(00, 00, 00)),
													},
												},
												{ amount_collected: 0 }
											);
											let total_amount = await invoicesTotalAmount(
												invoices,
												merchant_id
											);
											let transfer = {
												amount: total_amount,
												master_code: master_code,
												payerCode: branch.bcode,
												payerType: "branch",
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
													throw new Error(
														"Bank cashier's status can not be updated"
													);
												}

												let otherInfo = {
													total_amount: total_amount,
													master_code: master_code,
													paid_by: "BC",
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
					}
				);
			}
		}
	);
};

module.exports.partnerInvoicePay = async (req, res) => {
	// Initiate transaction state
	const master_code = await txstate.initiate();
	const today = new Date();

	const { invoices, merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	PartnerCashier.findOne(
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
											let partner = await Partner.findOne({
												_id: cashier.partner_id,
											});
											if (partner == null) {
												throw new Error("Cashier has invalid partner");
											}

											let branch = await PartnerBranch.findOne({
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

											await Merchant.updateOne(
												{
													_id: merchant_id,
													last_paid_at: {
														$lte: new Date(today.setHours(00, 00, 00)),
													},
												},
												{ amount_collected: 0 }
											);

											let total_amount = await invoicesTotalAmount(
												invoices,
												merchant_id
											);
											let transfer = {
												amount: total_amount,
												master_code: master_code,
												payeCode: partner.code,
												payerType: "partner",
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
												var c = await PartnerCashier.updateOne(
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
														"Partner cashier's status can not be updated";
												}

												let otherInfo = {
													total_amount: total_amount,
													master_code: master_code,
													paid_by: "PC",
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
