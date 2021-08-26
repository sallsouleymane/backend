//utils
const { errorMessage, catchError } = require("../../routes/utils/errorHandler");
const invoicesTotalAmount = require("../utils/invoicesTotalAmount");
const updateInvoiceRecord = require("../utils/updateInvoiceRecord");
const { jwtAuthentication } = require("./utils");

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

//constants
const categoryConst = require("../transactions/constants/category");

module.exports.cashierInvoicePay = async (req, res) => {
	const today = new Date();

	const { invoices, merchant_id } = req.body;
	jwtAuthentication("cashier", req, async function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			// Initiate transaction state
			const master_code = await txstate.initiate(
				categoryConst.MAIN,
				cashier.bank_id,
				"Non Wallet to Merchant",
				cashier._id,
				cashier.cash_in_hand,
			);
			MerchantRule.findOne(
				{ merchant_id: merchant_id, type: "NWM-F", status: 1, active: 1 },
				(err1, fee) => {
					let errRes1 = errorMessage(err1, fee, "Fee rule not found");
					if (errRes1.status == 0) {
						res.status(200).json(errRes1);
					} else {
						MerchantRule.findOne(
							{
								merchant_id: merchant_id,
								type: "NWM-C",
								status: 1,
								active: 1,
							},
							async (err2, comm) => {
								let errRes2 = errorMessage(
									err2,
									comm,
									"Commission rule not found"
								);
								if (errRes2.status == 0) {
									res.status(200).json(errRes2);
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
											cashierId: cashier._id,
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
											await Cashier.updateOne(
												{ _id: cashier._id },
												{
													$inc: {
														cash_received: total_amount + result.bankFee,
														cash_in_hand: total_amount + result.bankFee,
														fee_generated: result.partnerFeeShare,
														cash_received_fee: result.partnerFeeShare,
														cash_received_commission: result.partnerCommShare,
														commission_generated: result.partnerCommShare,
														total_trans: 1,
													},
												}
											);

											let otherInfo = {
												total_amount: total_amount,
												master_code: master_code,
												paid_by: "BC",
												payer_id: cashier._id,
												payer_branch_id: cashier.branch_id,
												payer_bank_id: cashier.bank_id,
												fee: Number(result.partnerFeeShare)/invoices.length,
												commission: Number(result.partnerCommShare)/invoices.length,
											};

											let status = await updateInvoiceRecord(
												req.body,
												otherInfo
											);
											if (status != null) {
												throw new Error(status);
											}

											txstate.completed(categoryConst.MAIN, master_code);
											res.status(200).json(result);
										} else {
											txstate.failed(categoryConst.MAIN, master_code);
											res.status(200).json(result);
										}
									} catch (err45) {
										txstate.failed(categoryConst.MAIN, master_code);
										res.status(200).json(catchError(err45));
									}
								}
							}
						);
					}
				}
			);
		}
	});
};

module.exports.partnerInvoicePay = async (req, res) => {
	const today = new Date();

	const { invoices, merchant_id } = req.body;
	jwtAuthentication("partnerCashier", req, async function (err, cashier) {
		if (err) {
			res.status(200).json(err);
		} else {
			// Initiate transaction state
			const master_code = await txstate.initiate(
				categoryConst.MAIN,
				cashier.bank_id,
				"Non Wallet to Merchant",
				cashier._id,
				cashier.cash_in_hand,
			);
			MerchantRule.findOne(
				{ merchant_id: merchant_id, type: "NWM-F", status: 1, active: 1 },
				(err1, fee) => {
					let errRes1 = errorMessage(err1, fee, "Fee rule not found");
					if (errRes1.status == 0) {
						res.status(200).json(errRes1);
					} else {
						MerchantRule.findOne(
							{
								merchant_id: merchant_id,
								type: "NWM-C",
								status: 1,
								active: 1,
							},
							async (err2, comm) => {
								let errRes2 = errorMessage(
									err2,
									comm,
									"Commission rule not found"
								);
								if (errRes2.status == 0) {
									res.status(200).json(errRes2);
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
											cashierId: cashier._id,
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
											await PartnerCashier.updateOne(
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
											let otherInfo = {
												total_amount: total_amount,
												master_code: master_code,
												paid_by: "PC",
												payer_id: cashier._id,
												payer_branch_id: cashier.branch_id,
												payer_partner_id: cashier.partner_id,
												fee: Number(result.partnerFeeShare)/invoices.length,
												commission: Number(result.partnerCommShare)/invoices.length,
											};

											let status = await updateInvoiceRecord(
												req.body,
												otherInfo
											);
											if (status != null) {
												throw new Error(status);
											}

											txstate.completed(categoryConst.MAIN, master_code);
											res.status(200).json(result);
										} else {
											txstate.failed(categoryConst.MAIN, master_code);
											res.status(200).json(result);
										}
									} catch (err3) {
										txstate.failed(categoryConst.MAIN, master_code);
										console.log(err3);
										var message3 = err3.toString();
										if (err3.message) {
											message3 = err3.message;
										}
										res
											.status(200)
											.json({ status: 0, message: message3, err: err3 });
									}
								}
							}
						);
					}
				}
			);
		}
	});
};
