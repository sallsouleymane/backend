const express = require("express");
const router = express.Router();
const config = require("../config.json");
const jwtTokenAuth = require("./JWTTokenAuth");

//utils
const makeid = require("./utils/idGenerator");
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const makeotp = require("./utils/makeotp");
const getWalletIds = require("./utils/getWalletIds");
const { errorMessage, catchError } = require("./utils/errorHandler");
const jwtsign = require("./utils/jwtsign");

//services
const {
	getStatement,
	createWallet,
	transferThis,
	getBalance,
	initiateTransfer,
} = require("../services/Blockchain.js");

const Infra = require("../models/Infra");
const Fee = require("../models/Fee");
const Bank = require("../models/Bank");
const BankUser = require("../models/BankUser");
const OTP = require("../models/OTP");
const Profile = require("../models/Profile");
const Document = require("../models/Document");
const Merchant = require("../models/merchant/Merchant");
const Country = require("../models/Country");
const User = require("../models/User");
const Cashier = require("../models/Cashier");
const Branch = require("../models/Branch");
const MerchantBranch = require("../models/merchant/MerchantBranch");
const Partner = require("../models/partner/Partner");
const PartnerBranch = require("../models/partner/Branch");
const PartnerCashier = require("../models/partner/Cashier");
const Invoice = require("../models/merchant/Invoice");
const DailyReport = require("../models/cashier/DailyReport");
const Zone = require("../models/merchant/Zone");
const Subzone = require("../models/merchant/Subzone");
const MerchantPosition = require("../models/merchant/Position");

const mainFee = config.mainFee;

/**
 * @swagger
 * /infra/getBankDailyReport:
 *  post:
 *    description: Use to get bank's daily report by infra
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/infra/getBankDailyReport", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { bank_id, start, end} = req.body;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				DailyReport.aggregate(
					[
						{ 
							$match : {
								user: 'Cashier',
								bank_id: bank_id,
								created_at: {
									$gte: new Date(
										start
									),
									$lte: new Date(
										end
									),
								},
							}
						},
						{
							$group: {
								_id: null,
								cashInHand: {
									$sum: "$cash_in_hand",
								},
								totalFee: {
									$sum: "$fee_generated",
								},
								totalCommission: {
									$sum: "$commission_generated",
								},
								cashReceived: {
									$sum: "$cash_received",
								},
								cashReceivedFee: {
									$sum: "$cash_received_fee",
								},
								cashReceivedComm: {
									$sum: "$cash_received_commission",
								},
								cashPaid: {
									$sum: "$cash_paid",
								},
								cashPaidFee: {
									$sum: "$cash_paid_fee",
								},
								cashPaidComm: {
									$sum: "$cash_paid_commission",
								},
								totalTrans:{
									$sum: "$total_trans",
								}
							},
						},
					],
					async (err1, aggregate) => {

						DailyReport.aggregate(
							[
								{ 
									$match : {
										user: 'PartnerCashier',
										bank_id: bank_id,
										created_at: {
											$gte: new Date(
												start
											),
											$lte: new Date(
												end
											),
										},
									}
								},
								{
									$group: {
										_id: null,
										totalFee: {
											$sum: "$fee_generated",
										},
										totalCommission: {
											$sum: "$commission_generated",
										},
										totalTrans:{
											$sum: "$total_trans",
										},
										partnerCashier: { $sum: 1 },
										cashReceived: {
											$sum: "$cash_received",
										},
										cashReceivedFee: {
											$sum: "$cash_received_fee",
										},
										cashReceivedComm: {
											$sum: "$cash_received_commission",
										},
										cashPaid: {
											$sum: "$cash_paid",
										},
										cashPaidFee: {
											$sum: "$cash_paid_fee",
										},
										cashPaidComm: {
											$sum: "$cash_paid_commission",
										},
									},
								},
							],
							async (err2, partneraggregate) => {
								Invoice.aggregate(
									[{ 
										$match : {
											payer_bank_id: bank_id,
											paid:1,
											date_paid:{
												$gte: new Date(
													start
												),
												$lte: new Date(
													end
												),
											},
										}
									},
										{
											$group: {
												_id: null,
												totalAmountPaid: {
													$sum: "$amount",
												},
												fee: {
													$sum: "$fee",
												},
												comm: {
													$sum: "$commission",
												},
												bills_paid: { $sum: 1 },

											},
										},
									],
									async (err3, invoices) => {
										let amountpaid = 0;
										let billpaid = 0;
										let mfg = 0;
										let mcg = 0;
										if (
											invoices != undefined &&
											invoices != null &&
											invoices.length > 0
										) {
											amountpaid = invoices[0].totalAmountPaid;
											billpaid = invoices[0].bills_paid;
											mfg = invoices[0].fee;
											mcg = invoices[0].comm;
										}
										var bankbranch = await Branch.countDocuments({bank_id:bank_id});
										var bankcashier = await Cashier.countDocuments({bank_id:bank_id});
										var bankmerchants = await Merchant.countDocuments({bank_id:bank_id});
										var merchantBranches = await MerchantBranch.countDocuments({bank_id:bank_id});
										var merchantStaffs = await MerchantPosition.countDocuments({bank_id:bank_id, type:'staff'});
										var merchantCashiers = await MerchantPosition.countDocuments({bank_id:bank_id,type:'cashier'});
										var bankpartner = await Partner.countDocuments({bank_id:bank_id});
										var partnerCashier = await PartnerCashier.countDocuments({bank_id:bank_id});
										var partnerBranches = await PartnerBranch.countDocuments({bank_id:bank_id});
										var totalinvoicecreated = await Invoice.countDocuments(
											{
												bank_id:bank_id,
												created_at: {
													$gte: new Date(start),
													$lte: new Date(end),
												},
											}
										);
										res.status(200).json({
											status: 1,
											totalCashier: bankcashier,
											totalBranch: bankbranch,
											totalMerchant:bankmerchants,
											merchantBranch:merchantBranches,
											merchantStaff: merchantStaffs,
											merchantCashiers:merchantCashiers,
											totalPartner:bankpartner,
											partnerCashier:partnerCashier,
											partnerBranch:partnerBranches,
											merchantCommissionGenerated: mcg,
											merchantFeeGenerated : mfg,
											invoicePaid: billpaid,
											amountPaid: amountpaid,
											invoiceCreated:totalinvoicecreated,
											bankreport: aggregate,
											partnerreport: partneraggregate,

										});
									}
								);

							}
						);

					}
				);
			}
		}
	);
});

/**
 * @swagger
 * /infra/getBankDashStats:
 *  post:
 *    description: Use to get bank's dashboard stats by infra
 *    responses:
 *      '200':
 *        description: A successful response
 */


router.post("/infra/getBankDashStats", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { bank_id } = req.body;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {

				Cashier.countDocuments(
					{
						bank_id: bank_id,
					},
					(err1, count) => {
						if (count == null || !count) {
							count = 0;
						}
						Cashier.aggregate(
							[
								{ $match : {bank_id: bank_id}},
								{
									$group: {
										_id: null,
										total: {
											$sum: "$cash_in_hand",
										},
										totalFee: {
											$sum: "$fee_generated",
										},
										totalCommission: {
											$sum: "$commission_generated",
										},
										cashReceived: {
											$sum: "$cash_received",
										},
										cashReceivedFee: {
											$sum: "$cash_received_fee",
										},
										cashReceivedComm: {
											$sum: "$cash_received_commission",
										},
										cashPaid: {
											$sum: "$cash_paid",
										},
										cashPaidFee: {
											$sum: "$cash_paid_fee",
										},
										cashPaidComm: {
											$sum: "$cash_paid_commission",
										},
										totalTrans:{
											$sum: "$total_trans",
										}
									},
								},
							],
							async (err2, aggregate) => {

								PartnerCashier.aggregate(
									[
										{ $match : {bank_id: bank_id}},
										{
											$group: {
												_id: null,
												totalFee: {
													$sum: "$fee_generated",
												},
												totalCommission: {
													$sum: "$commission_generated",
												},
												totalTrans:{
													$sum: "$total_trans",
												},
												cashReceived: {
													$sum: "$cash_received",
												},
												cashReceivedFee: {
													$sum: "$cash_received_fee",
												},
												cashReceivedComm: {
													$sum: "$cash_received_commission",
												},
												cashPaid: {
													$sum: "$cash_paid",
												},
												cashPaidFee: {
													$sum: "$cash_paid_fee",
												},
												cashPaidComm: {
													$sum: "$cash_paid_commission",
												},
												partnerCashier: { $sum: 1 },
											},
										},
									],
									async (err3, partneraggregate) => {
										Invoice.aggregate(
											[{ 
												$match : {
													payer_bank_id: bank_id,
													paid:1,
												}
											},
												{
													$group: {
														_id: null,
														totalAmountPaid: {
															$sum: "$amount",
														},
														fee: {
															$sum: "$fee",
														},
														comm: {
															$sum: "$commission",
														},
														bills_paid: { $sum: 1 },

													},
												},
											],
											async (err4, invoices) => {
												let amountpaid = 0;
												let billpaid = 0;
												let banktrans = 0;
												let cr = 0;
												let cp = 0;
												let crf = 0;
												let cpc = 0;
												let crc = 0;
												let cpf = 0;
												let cin = 0;
												let fg = 0;
												let cg = 0;
												let partnertrans = 0;
												let partnercashier = 0;
												let pcr = 0;
												let pcp = 0;
												let pcrf = 0;
												let pcpc = 0;
												let pcrc = 0;
												let pcpf = 0;
												let pfg = 0;
												let pcg = 0;
												let mfg = 0;
												let mcg = 0;
												if (
													aggregate != undefined &&
													aggregate != null &&
													aggregate.length > 0
												) {
													cin = aggregate[0].total;
													fg = aggregate[0].totalFee;
													cg = aggregate[0].totalCommission;
													cr = aggregate[0].cashReceived;
													crf = aggregate[0].cashReceivedFee;
													crc = aggregate[0].cashReceivedComm;
													cp = aggregate[0].cashPaid;
													cpf = aggregate[0].cashPaidFee;
													cpc = aggregate[0].cashPaidComm;
													banktrans = aggregate[0].totalTrans;
												}
												if (
													partneraggregate != undefined &&
													partneraggregate != null &&
													partneraggregate.length > 0
												) {
													partnertrans = partneraggregate[0].totalTrans;
													partnercashier = partneraggregate[0].partnerCashier;
													pfg = partneraggregate[0].totalFee;
													pcg = partneraggregate[0].totalCommission;
													pcr = partneraggregate[0].cashReceived;
													pcrf = partneraggregate[0].cashReceivedFee;
													pcrc = partneraggregate[0].cashReceivedComm;
													pcp = partneraggregate[0].cashPaid;
													pcpf = partneraggregate[0].cashPaidFee;
													pcpc = partneraggregate[0].cashPaidComm;
												}
												if (
													invoices != undefined &&
													invoices != null &&
													invoices.length > 0
												) {
													amountpaid = invoices[0].totalAmountPaid;
													billpaid = invoices[0].bills_paid;
													mfg = invoices[0].fee;
													mcg = invoices[0].comm;
												}

												var bankmerchants = await Merchant.countDocuments({bank_id:bank_id});
												var merchantBranches = await MerchantBranch.countDocuments({bank_id:bank_id});
												var merchantStaffs = await MerchantPosition.countDocuments({bank_id:bank_id, type:'staff'});
												var merchantCashiers = await MerchantPosition.countDocuments({bank_id:bank_id,type:'cashier'});
												var partnerBranches = await PartnerBranch.countDocuments({bank_id:bank_id});
												var totalinvoicecreated = await Invoice.countDocuments(
													{
														bank_id:bank_id,
														created_at: {
															$gte: new Date(),
															$lte: new Date(),
														},
													}
												);
												res.status(200).json({
													status: 1,
													totalCashier: count,
													cashInHand: cin,
													cashReceived: cr,
													cashReceivedFee: crf,
													cashReceivedComm: crc,
													cashPaid: cp,
													cashPaidFee: cpf,
													cashPaidComm: cpc,
													partnerCashReceived: pcr,
													partnerCashReceivedFee: pcrf,
													partnerCashReceivedComm: pcrc,
													partnerCashPaid: pcp,
													partnerCashPaidFee: pcpf,
													partnerCashPaidComm: pcpc,
													commissionGenerated: cg,
													feeGenerated : fg,
													totalTrans: banktrans,
													partnerCashier:partnercashier,
													partnerBranch:partnerBranches,
													partnerCommissionGenerated: pcg,
													partnerFeeGenerated : pfg,
													partnerTotalTrans: partnertrans,
													totalMerchant:bankmerchants,
													merchantBranch:merchantBranches,
													merchantStaff: merchantStaffs,
													merchantCashiers:merchantCashiers,
													invoicePaid: billpaid,
													amountPaid: amountpaid,
													invoiceCreated:totalinvoicecreated,
													merchantCommissionGenerated: mcg,
													merchantFeeGenerated : mfg,
												});
											}
										);

									}
								);

							}
						);
					}
				);
			}
		}
	);
});

/**
 * @swagger
 * /infra/:type/getMerchantStatsBydate:
 *  post:
 *    description: Use to get merchant's stats searched by date  by infra
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/infra/:type/getMerchantStatsBydate",jwtTokenAuth,function (req, res) {
	const jwtusername = req.sign_creds.username;
	const type = req.params.type;
	const { id, date } = req.body;
	var today = new Date(date);
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Invoice.aggregate(
					[
						{
							$match: {
								[`${type}_id`] : id,
								created_at: {
									$gte: new Date(
										start
									),
									$lte: new Date(
										end
									),
								},
								paid:1,
							},
						},
						{
							$group: {
								_id: "$paid_by",
								amount_paid: { $sum: "$amount" },
								penalty: { $sum: "$penalty"},
								fee: {$sum: "$fee"},
								commission: {$sum: "$commission"},
								bills_paid: { $sum: 1 },
							},
						},
					],async (err1, post6) => {
						let result1 = errorMessage(
							err1,
							post6,
							"Error."
						);
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							Invoice.aggregate(
								[
									{
										$match: {
											[`${type}_id`] : id,
											created_at: {
												$gte: new Date(
													start
												),
												$lte: new Date(
													end
												),
											},
										},
									},
									{
										$group: {
											_id: null,
											amount_generated: { $sum: "$amount" },
											bills_generated: { $sum: 1 },
										},
									},
								],async (err2, post7) => {
									let result2 = errorMessage(
										err2,
										post7,
										"Error."
									);
									if (result2.status == 0) {
										res.status(200).json(result2);
									} else {
										let ag = 0;
										let bg = 0;
										let InvoicePaidByMC = 0;
										let InvoicePaidByBC = 0;
										let InvoicePaidByPC = 0;
										let InvoicePaidByUS = 0;
										let AmountPaidByMC = 0;
										let AmountPaidByBC = 0;
										let AmountPaidByPC = 0;
										let AmountPaidByUS = 0;
										let FeeGeneratedByBC = 0;
										let CommissionGeneratedByBC = 0;
										let FeeGeneratedByPC = 0;
										let CommissionGeneratedByPC = 0;
										let FeeGeneratedByMC = 0;
										let CommissionGeneratedByMC = 0;
										let FeeGeneratedByUS = 0;
										let CommissionGeneratedByUS = 0;
										let InvoicePaid = 0;
										let AmountPaid = 0;
										if (
											post7 != undefined &&
											post7 != null &&
											post7.length > 0
										) {
											ag = post7[0].amount_generated;
											bg = post7[0].bills_generated;
										}
										if (
											post6 != undefined &&
											post6 != null &&
											post6.length > 0
										) {
											const PaidByMC = await post6.filter((val) => {
												return val._id=='MC'
											});
											const PaidByBC = await post6.filter((val) => {
												return val._id=='BC'
											});
											const PaidByPC = await post6.filter((val)=>{
												return val._id=='PC'
											});
											const PaidByUS = await post6.filter((val)=>{
												return val._id=='US'
											});
											if(PaidByMC.length > 0){
												InvoicePaidByMC = PaidByMC[0].bills_paid;
												AmountPaidByMC = PaidByMC[0].amount_paid + PaidByMC[0].penalty;
												FeeGeneratedByMC = PaidByMC[0].fee;
												CommissionGeneratedByMC = PaidByMC[0].commission;
											}
											if(PaidByBC.length > 0){
												InvoicePaidByBC = PaidByBC[0].bills_paid;
												AmountPaidByBC = PaidByBC[0].amount_paid + PaidByBC[0].penalty;
												FeeGeneratedByBC = PaidByBC[0].fee;
												CommissionGeneratedByBC = PaidByBC[0].commission;
											}
											if(PaidByPC.length > 0){
												InvoicePaidByPC = PaidByPC[0].bills_paid;
												AmountPaidByPC = PaidByPC[0].amount_paid + PaidByPC[0].penalty;
												FeeGeneratedByPC = PaidByPC[0].fee;
												CommissionGeneratedByPC = PaidByPC[0].commission;
											}
											if(PaidByUS.length > 0){
												InvoicePaidByUS = PaidByUS[0].bills_paid;
												AmountPaidByUS = PaidByUS[0].amount_paid + PaidByUS[0].penalty;
												FeeGeneratedByUS = PaidByUS[0].fee;
												CommissionGeneratedByUS = PaidByUS[0].commission;
											}

											InvoicePaid = await post6.reduce((a, b) => {
												return a + b.bills_paid;
											}, 0);
											
											AmountPaid = await post6.reduce((a, b) => {
												return a + b.amount_paid;
											}, 0);
										}
										res.status(200).json({
											status: 1,
											amount_generated: ag,
											bill_generated: bg,
											amount_paid: AmountPaid,
											bill_paid: InvoicePaid,
											bill_paid_by_MC : InvoicePaidByMC,
											amount_paid_by_MC: AmountPaidByMC,
											bill_paid_by_PC : InvoicePaidByPC,
											amount_paid_by_PC: AmountPaidByPC,
											bill_paid_by_BC : InvoicePaidByBC,
											amount_paid_by_BC: AmountPaidByBC,
											bill_paid_by_US : InvoicePaidByUS,
											amount_paid_by_US: AmountPaidByUS,
											fee_generated_by_BC: FeeGeneratedByBC,
											commission_generated_by_BC: CommissionGeneratedByBC,
											fee_generated_by_PC: FeeGeneratedByPC,
											commission_generated_by_PC: CommissionGeneratedByPC,
											fee_generated_by_MC: FeeGeneratedByMC,
											commission_generated_by_MC: CommissionGeneratedByMC,
											fee_generated_by_US: FeeGeneratedByUS,
											commission_generated_by_US: CommissionGeneratedByUS,
											post7:post7,
											post6:post6,
										});
									}
								}
							);
						}
					}		
				);
			}
		}
	);
});

/**
 * @swagger
 * /infra/:type/getMerchantStatsByPeriod:
 *  post:
 *    description: Use to get merchant's stats searched by date  by infra
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/infra/:type/getMerchantStatsByPeriod",jwtTokenAuth,function (req, res) {
	const jwtusername = req.sign_creds.username;
	const type = req.params.type;
	const { id, period_name } = req.body;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Invoice.aggregate(
					[
						{
							$match: {
								[`${type}_id`] : id,
								"bill_period.period_name": period_name,
								paid: 1,
							},
						},
						{
							$group: {
								_id: "$paid_by", 
								amount_paid: { $sum: "$amount" },
								bills_paid: { $sum: 1 },
								penalty: { $sum: "$penalty"},
								fee: {$sum: "$fee"},
								commission: {$sum: "$commission"},
							},
						},
					],async (err2, post6) => {
						let result2 = errorMessage(
							err2,
							post6,
							"Error."
						);
						if (result2.status == 0) {
							res.status(200).json(result2);
						} else {
							Invoice.aggregate(
								[
									{
										$match: {
											[`${type}_id`] : id,
											"bill_period.period_name": period_name,
										},
									},
									{
										$group: {
											_id: null,
											amount_generated: { $sum: "$amount" },
											bills_generated: { $sum: 1 },
										},
									},
								],async (err1, post7) => {
									let result1 = errorMessage(
										err1,
										post7,
										"Error."
									);
									if (result1.status == 0) {
										res.status(200).json(result1);
									} else {
										let ag = 0;
										let bg = 0;
										let InvoicePaidByMC = 0;
										let InvoicePaidByBC = 0;
										let InvoicePaidByPC = 0;
										let InvoicePaidByUS = 0;
										let AmountPaidByMC = 0;
										let AmountPaidByBC = 0;
										let AmountPaidByPC = 0;
										let AmountPaidByUS = 0;
										let FeeGeneratedByBC = 0;
										let CommissionGeneratedByBC = 0;
										let FeeGeneratedByPC = 0;
										let CommissionGeneratedByPC = 0;
										let FeeGeneratedByMC = 0;
										let CommissionGeneratedByMC = 0;
										let FeeGeneratedByUS = 0;
										let CommissionGeneratedByUS = 0;
										let InvoicePaid = 0;
										let AmountPaid = 0;
										if (
											post7 != undefined &&
											post7 != null &&
											post7.length > 0
										) {
											ag = post7[0].amount_generated;
											bg = post7[0].bills_generated;
										}
										if (
											post6 != undefined &&
											post6 != null &&
											post6.length > 0
										) {
											const PaidByMC = await post6.filter((val) => {
												return val._id=='MC'
											});
											const PaidByBC = await post6.filter((val) => {
												return val._id=='BC'
											});
											const PaidByPC = await post6.filter((val)=>{
												return val._id=='PC'
											});
											const PaidByUS = await post6.filter((val)=>{
												return val._id=='US'
											});
											if(PaidByMC.length > 0){
												InvoicePaidByMC = PaidByMC[0].bills_paid;
												AmountPaidByMC = PaidByMC[0].amount_paid + PaidByMC[0].penalty;
												FeeGeneratedByMC = PaidByMC[0].fee;
												CommissionGeneratedByMC = PaidByMC[0].commission;
											}
											if(PaidByBC.length > 0){
												InvoicePaidByBC = PaidByBC[0].bills_paid;
												AmountPaidByBC = PaidByBC[0].amount_paid + PaidByBC[0].penalty;
												FeeGeneratedByBC = PaidByBC[0].fee;
												CommissionGeneratedByBC = PaidByBC[0].commission;
											}
											if(PaidByPC.length > 0){
												InvoicePaidByPC = PaidByPC[0].bills_paid;
												AmountPaidByPC = PaidByPC[0].amount_paid + PaidByPC[0].penalty;
												FeeGeneratedByPC = PaidByPC[0].fee;
												CommissionGeneratedByPC = PaidByPC[0].commission;
											}
											if(PaidByUS.length > 0){
												InvoicePaidByUS = PaidByUS[0].bills_paid;
												AmountPaidByUS = PaidByUS[0].amount_paid + PaidByUS[0].penalty;
												FeeGeneratedByUS = PaidByUS[0].fee;
												CommissionGeneratedByUS = PaidByUS[0].commission;
											}

											InvoicePaid = await post6.reduce((a, b) => {
												return a + b.bills_paid;
											}, 0);
											
											AmountPaid = await post6.reduce((a, b) => {
												return a + b.amount_paid;
											}, 0);
										}
										res.status(200).json({
											status: 1,
											amount_generated: ag,
											bill_generated: bg,
											amount_paid: AmountPaid,
											bill_paid: InvoicePaid,
											bill_paid_by_MC : InvoicePaidByMC,
											amount_paid_by_MC: AmountPaidByMC,
											bill_paid_by_PC : InvoicePaidByPC,
											amount_paid_by_PC: AmountPaidByPC,
											bill_paid_by_BC : InvoicePaidByBC,
											amount_paid_by_BC: AmountPaidByBC,
											bill_paid_by_US : InvoicePaidByUS,
											amount_paid_by_US: AmountPaidByUS,
											fee_generated_by_BC: FeeGeneratedByBC,
											commission_generated_by_BC: CommissionGeneratedByBC,
											fee_generated_by_PC: FeeGeneratedByPC,
											commission_generated_by_PC: CommissionGeneratedByPC,
											fee_generated_by_MC: FeeGeneratedByMC,
											commission_generated_by_MC: CommissionGeneratedByMC,
											fee_generated_by_US: FeeGeneratedByUS,
											commission_generated_by_US: CommissionGeneratedByUS,
											post7:post7,
											post6:post6,
										});
									}
								}
							);
						}
					}		
				);
			}
		}
	);
});

router.post("/infra/getMerchantStatsBydate",jwtTokenAuth,function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { merchant_id, date } = req.body;
	var today = new Date(date);
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {

				Invoice.aggregate(
					[
						{
							$match: {
								merchant_id: merchant_id,
								created_at: {
									$gte: new Date(
										start
									),
									$lte: new Date(
										end
									),
								},
								paid:1,
							},
						},
						{
							$group: {
								_id: "$paid_by",
								amount_paid: { $sum: "$amount" },
								penalty: { $sum: "$penalty"},
								bills_paid: { $sum: 1 },
							},
						},
					],async (err1, post6) => {
						let result1 = errorMessage(
							err1,
							post6,
							"Error."
						);
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							Invoice.aggregate(
								[
									{
										$match: {
											merchant_id : merchant_id,
											created_at: {
												$gte: new Date(
													start
												),
												$lte: new Date(
													end
												),
											},
										},
									},
									{
										$group: {
											_id: null,
											amount_generated: { $sum: "$amount" },
											bills_generated: { $sum: 1 },
										},
									},
								],async (err2, post7) => {
									let result2 = errorMessage(
										err2,
										post7,
										"Error."
									);
									if (result2.status == 0) {
										res.status(200).json(result2);
									} else {
										let ag = 0;
										let bg = 0;
										let InvoicePaidByMC = 0;
										let InvoicePaidByBC = 0;
										let InvoicePaidByPC = 0;
										let InvoicePaidByUS = 0;
										let AmountPaidByMC = 0;
										let AmountPaidByBC = 0;
										let AmountPaidByPC = 0;
										let AmountPaidByUS = 0;
										let InvoicePaid = 0;
										let AmountPaid = 0;
										if (
											post7 != undefined &&
											post7 != null &&
											post7.length > 0
										) {
											ag = post7[0].amount_generated;
											bg = post7[0].bills_generated;
										}
										if (
											post6 != undefined &&
											post6 != null &&
											post6.length > 0
										) {
											const PaidByMC = await post6.filter((val) => {
												return val._id=='MC'
											});
											const PaidByBC = await post6.filter((val) => {
												return val._id=='BC'
											});
											const PaidByPC = await post6.filter((val)=>{
												return val._id=='PC'
											});
											const PaidByUS = await post6.filter((val)=>{
												return val._id=='US'
											});
											if(PaidByMC.length > 0){
												InvoicePaidByMC = PaidByMC[0].bills_paid;
												AmountPaidByMC = PaidByMC[0].amount_paid + PaidByMC[0].penalty;
											}
											if(PaidByBC.length > 0){
												InvoicePaidByBC = PaidByBC[0].bills_paid;
												AmountPaidByBC = PaidByBC[0].amount_paid + PaidByBC[0].penalty;
											}
											if(PaidByPC.length > 0){
												InvoicePaidByPC = PaidByPC[0].bills_paid;
												AmountPaidByPC = PaidByPC[0].amount_paid + PaidByPC[0].penalty;
											}
											if(PaidByUS.length > 0){
												InvoicePaidByUS = PaidByUS[0].bills_paid;
												AmountPaidByUS = PaidByUS[0].amount_paid + PaidByUS[0].penalty;
											}

											InvoicePaid = await post6.reduce((a, b) => {
												return a + b.bills_paid;
											}, 0);
											
											AmountPaid = await post6.reduce((a, b) => {
												return a + b.amount_paid;
											}, 0);
										}
										res.status(200).json({
											status: 1,
											amount_generated: ag,
											bill_generated: bg,
											amount_paid: AmountPaid,
											bill_paid: InvoicePaid,
											bill_paid_by_MC : InvoicePaidByMC,
											amount_paid_by_MC: AmountPaidByMC,
											bill_paid_by_PC : InvoicePaidByPC,
											amount_paid_by_PC: AmountPaidByPC,
											bill_paid_by_BC : InvoicePaidByBC,
											amount_paid_by_BC: AmountPaidByBC,
											bill_paid_by_US : InvoicePaidByUS,
											amount_paid_by_US: AmountPaidByUS,
											post7:post7,
											post6:post6,
										});
									}
								}
							);
						}
					}		
				);
			}
		}
	);
});

router.post("/infra/bankAccess",jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	const { username, bank_id } = req.body;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				BankUser.findOne(
					{ username: username, bank_id:bank_id, role: "infraAdmin" },
					function (err1, admin) {
							if (err1) {
								var message1 = err1;
								if (err1.message) {
									message1 = err1.message;
								}
								res.status(200).json({
									status: 0,
									message: message1,
								});
							}else if (!admin || admin==null || admin == undefined){
								res.status(200).json({
									status: 0,
									message: "User not found",
								});
							} else {
								Bank.findOne({ _id: admin.bank_id }, (err2, adminbank) => {
									var result2 = errorMessage(err2, adminbank, "Bank is blocked");
									if (result2.status == 0) {
										res.status(200).json(result2);
									} else if (adminbank.status == -1) {
										res.status(200).json({
											status: 0,
											message: "Your account has been blocked, pls contact the admin!",
										});	
									} else {
										let sign_creds = { username: username, type: "bankUser" };
											const token = jwtsign(sign_creds);
											res.status(200).json({
												token: token,
												name: adminbank.name,
												initial_setup: adminbank.initial_setup,
												username: adminbank.username,
												mobile: adminbank.mobile,
												status: adminbank.status,
												contract: adminbank.contract,
												logo: adminbank.logo,
												id: adminbank._id,
												admin: true,
											});			
									}
								});
							}	
					}
				);
			}
		}
	);
});

router.post("/infra/transferMasterToOp", jwtTokenAuth, function (req, res) {
	const { bank_id, amount } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.findOne(
					{
						_id: bank_id,
						status: 1,
					},
					function (err1, bank) {
						let result1 = errorMessage(err1, bank, "Bank not found.");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							const masterWallet = bank.wallet_ids.infra_master;
							const opWallet = bank.wallet_ids.infra_operational;
							const trans = {
								from: masterWallet,
								to: opWallet,
								amount: Number(amount),
								note: "Master to operational",
								email1: infra.email,
								mobile1: infra.mobile,
								from_name: infra.name,
								to_name: infra.name,
								master_code: "",
								child_code: "",
							};
							initiateTransfer(trans)
								.then((result2) => {
									res.status(200).json(result2);
								})
								.catch((error) => {
									console.log(error);
									res.status(200).json({
										status: 0,
										message: error.message,
									});
								});
						}
					}
				);
			}
		}
	);
});

router.post("/infra/deleteCountry", jwtTokenAuth, function (req, res) {
	const { ccode } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Country.updateOne(
					{},
					{ country_list: { $pull: { ccode: ccode } } },
					function (err1, country) {
						let result1 = errorMessage(
							err1,
							country,
							"Token changed or user not valid. Try to login again or contact system administrator."
						);
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								status: 1,
								message: "Country Deleted",
							});
						}
					}
				);
			}
		}
	);
});

/**
 * @swagger
 * /infra/bank/listMerchants:
 *  post:
 *    description: Use to list bank's merchants by infra
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/infra/bank/listMerchants", jwtTokenAuth, function (req, res) {
	var { bank_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Merchant.find({ bank_id: bank_id }, "-password", (err1, merchants) => {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message) {
							message1 = err1.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else {
						res.status(200).json({
							status: 1,
							message: "Merchant List",
							list: merchants,
						});
					}
				});
			}
		}
	);
});

router.post("/infra/listMerchants", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Merchant.find({}, "-password", (err1, merchants) => {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message) {
							message1 = err1.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else {
						res.status(200).json({
							status: 1,
							message: "Merchant List",
							list: merchants,
						});
					}
				});
			}
		}
	);
});

/**
 * @swagger
 * /infra/listInfraMerchants:
 *  post:
 *    description: Use to list infra's merchants by infra
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/infra/listInfraMerchants", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Merchant.find({creator: 1}, "-password", (err1, merchants) => {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message) {
							message1 = err1.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else {
						res.status(200).json({
							status: 1,
							message: "Merchant List",
							list: merchants,
						});
					}
				});
			}
		}
	);
});

router.post("/infra/getInfraMerchantDashStats", jwtTokenAuth, function (req, res) {
	const { merchant_id } = req.body;
	var today = new Date();
	today = today.toISOString();
	var s = today.split("T");
	var start = s[0] + "T00:00:00.000Z";
	var end = s[0] + "T23:59:59.999Z";
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
			Invoice.aggregate(
					[
						{
							$match: {
								merchant_id: String(merchant_id),
								created_at: {
									$gte: new Date(
										start
									),
									$lte: new Date(
										end
									),
								},
								paid:1,
							},
						},
						{
							$group: {
								_id: "$paid_by",
								amount_paid: { $sum: "$amount" },
								fee: {$sum: "$fee"},
								commission: {$sum: "$commission"},
								bills_paid: { $sum: 1 },
							},
						},
					],async (err1, post6) => {
						let result1 = errorMessage(
							err1,
							post6,
							"Error."
						);
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							Invoice.aggregate(
								[
									{
										$match: {
											merchant_id: String(merchant_id),
											created_at: {
												$gte: new Date(
													start
												),
												$lte: new Date(
													end
												),
											},
										},
									},
									{
										$group: {
											_id: null,
											amount_generated: { $sum: "$amount" },
											bills_generated: { $sum: 1 },
										},
									},
								],async (err2, post7) => {
									let result2 = errorMessage(
										err2,
										post7,
										"Error."
									);
									if (result2.status == 0) {
										res.status(200).json(result2);
									} else {
										Invoice.aggregate(
											[
												{
													$match: {
														merchant_id: String(merchant_id),
														paid: 0,
													},
												},
												{
													$group: {
														_id: null,
														amount_pending: { $sum: "$amount" },
														bills_pending: { $sum: 1 },
													},
												},
											],async (err3, post8) => {
												let result3 = errorMessage(
													err3,
													post8,
													"Error."
												);
												if (result3.status == 0) {
													res.status(200).json(result3);
												} else {
													let ag = 0;
													let bg = 0;
													let InvoicePaidByMC = 0;
													let InvoicePaidByBC = 0;
													let InvoicePaidByPC = 0;
													let InvoicePaidByUS = 0;
													let AmountPaidByMC = 0;
													let AmountPaidByBC = 0;
													let AmountPaidByPC = 0;
													let AmountPaidByUS = 0;
													let FeeGeneratedByBC = 0;
													let CommissionGeneratedByBC = 0;
													let FeeGeneratedByPC = 0;
													let CommissionGeneratedByPC = 0;
													let FeeGeneratedByMC = 0;
													let CommissionGeneratedByMC = 0;
													let FeeGeneratedByUS = 0;
													let CommissionGeneratedByUS = 0;
													let InvoicePaid = 0;
													let AmountPaid = 0;
													let ap = 0;
													let bp = 0;
													if (
														post7 != undefined &&
														post7 != null &&
														post7.length > 0
													) {
														ag = post7[0].amount_generated;
														bg = post7[0].bills_generated;
													}
													if (
														post6 != undefined &&
														post6 != null &&
														post6.length > 0
													) {
														const PaidByMC = await post6.filter((val) => {
															return val._id=='MC'
														});
														const PaidByBC = await post6.filter((val) => {
															return val._id=='BC'
														});
														const PaidByPC = await post6.filter((val)=>{
															return val._id=='PC'
														});
														const PaidByUS = await post6.filter((val)=>{
															return val._id=='US'
														});
														if(PaidByMC.length > 0){
															InvoicePaidByMC = PaidByMC[0].bills_paid;
															AmountPaidByMC = PaidByMC[0].amount_paid + PaidByMC[0].penalty;
															FeeGeneratedByMC = PaidByMC[0].fee;
															CommissionGeneratedByMC = PaidByMC[0].commission;
														}
														if(PaidByBC.length > 0){
															InvoicePaidByBC = PaidByBC[0].bills_paid;
															AmountPaidByBC = PaidByBC[0].amount_paid + PaidByBC[0].penalty;
															FeeGeneratedByBC = PaidByBC[0].fee;
															CommissionGeneratedByBC = PaidByBC[0].commission;
														}
														if(PaidByPC.length > 0){
															InvoicePaidByPC = PaidByPC[0].bills_paid;
															AmountPaidByPC = PaidByPC[0].amount_paid + PaidByPC[0].penalty;
															FeeGeneratedByPC = PaidByPC[0].fee;
															CommissionGeneratedByPC = PaidByPC[0].commission;
														}
														if(PaidByUS.length > 0){
															InvoicePaidByUS = PaidByUS[0].bills_paid;
															AmountPaidByUS = PaidByUS[0].amount_paid + PaidByUS[0].penalty;
															FeeGeneratedByUS = PaidByUS[0].fee;
															CommissionGeneratedByUS = PaidByUS[0].commission;
														}
			
														InvoicePaid = await post6.reduce((a, b) => {
															return a + b.bills_paid;
														}, 0);
														
														AmountPaid = await post6.reduce((a, b) => {
															return a + b.amount_paid;
														}, 0);
													}
													if (
														post8 != undefined &&
														post8 != null &&
														post8.length > 0
													) {
														ap = post8[0].amount_pending;
														bp = post8[0].bills_pending;
													}
													res.status(200).json({
														status: 1,
														bills_created:bg,
														amount_created:ag,
														amount_paid: AmountPaid,
														bill_paid: InvoicePaid,
														bill_paid_by_MC : InvoicePaidByMC,
														amount_paid_by_MC: AmountPaidByMC,
														bill_paid_by_PC : InvoicePaidByPC,
														amount_paid_by_PC: AmountPaidByPC,
														bill_paid_by_BC : InvoicePaidByBC,
														amount_paid_by_BC: AmountPaidByBC,
														bill_paid_by_US : InvoicePaidByUS,
														amount_paid_by_US: AmountPaidByUS,
														fee_generated_by_BC: FeeGeneratedByBC,
														commission_generated_by_BC: CommissionGeneratedByBC,
														fee_generated_by_PC: FeeGeneratedByPC,
														commission_generated_by_PC: CommissionGeneratedByPC,
														fee_generated_by_MC: FeeGeneratedByMC,
														commission_generated_by_MC: CommissionGeneratedByMC,
														fee_generated_by_US: FeeGeneratedByUS,
														commission_generated_by_US: CommissionGeneratedByUS,
														amount_pending: ap,
														bills_pending: bp,
													});
												}
											}
										);
									}
								}
							);
						}
					}		
			);
			}

		}
	);
});

/**
 * @swagger
 * /infra/getMerchantzoneList:
 *  post:
 *    description: Use to list merchant's zones by infra
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/infra/getMerchantzoneList", jwtTokenAuth, (req, res) => {
	const { merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
		
				Zone.find({ merchant_id: merchant_id }, async (err1, zones) => {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message1) {
							message1 = err1.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else {
						res.status(200).json({
							status: 1,
							list: zones,
						});
					}
				});
			}
			
		}
	);
});

router.post("/infra/getMerchantsubzoneList", jwtTokenAuth, (req, res) => {
	const { merchant_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
			
				Subzone.find({ merchant_id: merchant_id }, async (err1, subzones) => {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message1) {
							message1 = err1.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else {
						res.status(200).json({
							status: 1,
							list: subzones,
						});
					}
				});
			
			}
		}
	);
});

/**
 * @swagger
 * /infra/getMerchantbranchList:
 *  post:
 *    description: Use to list merchant's branches by infra
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/infra/getMerchantbranchList", jwtTokenAuth, (req, res) => {
	const { merchant_id } = req.body;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantBranch.find({ merchant_id: merchant_id }, async (err1, branches) => {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message) {
							message1 = err.message1;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else {
						res.status(200).json({
							status: 1,
							list: branches,
						});
					}
				});
			}
			
		}
	);
});

/**
 * @swagger
 * /infra/listMerchantSubzonesByZoneId:
 *  post:
 *    description: Use to list merchant's subzones of a zone by infra
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/infra/listMerchantSubzonesByZoneId",jwtTokenAuth,function (req, res) {
	const { zone_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Subzone.find(
					{ zone_id: zone_id },
					function (err1, subzone) {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						} else {
							res.status(200).json({
								status: 1,
								subzones: subzone,
							});
						}
					}
				);
			}
		}
	);
}
);

router.post(
"/infra/listMerchantBranchesBySubzoneId",
jwtTokenAuth,
function (req, res) {
	const { subzone_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {

				MerchantBranch.find(
					{  subzone_id: subzone_id },
					function (err1, branch) {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						} else {
							res.status(200).json({
								status: 1,
								branches: branch,
							});
						}
					}
				);
			}
		}
	);
}
);

/**
 * @swagger
 * /infra/createMerchant:
 *  post:
 *    description: Use to create merchant by infra
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/infra/createMerchant", jwtTokenAuth, function (req, res) {
	var {
		code,
		name,
		logo,
		description,
		document_hash,
		email,
		mobile,
		bank_id,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.findOne({ _id: bank_id }, (err1, bank) => {
					var result1 = errorMessage(err1, bank, "Bank not found");
					if (result1.status == 0) {
						res.status(200).json(result1);
					} else {
						if (!code) {
							res.status(200).json({
								status: 0,
								message: "Code is a required field",
							});
						} else {
							const wallet_ids = getWalletIds(
								"infraMerchant",
								code,
								bank.bcode
							);
							createWallet([wallet_ids.operational])
								.then((result2) => {
									if (
										result2 != "" &&
										!result2.includes("wallet already exists")
									) {
										console.log(result2);
										res.status(200).json({
											status: 0,
											message:
												"Blockchain service was unavailable. Please try again.",
											result: result2,
										});
									} else {
										const data = new Merchant();
										data.name = name;
										data.logo = logo;
										data.description = description;
										data.document_hash = document_hash;
										data.email = email;
										data.mobile = mobile;
										data.code = code;
										data.username = code;
										data.password = makeid(8);
										data.bank_id = bank_id;
										data.infra_id = infra._id;
										data.status = 0;
										data.creator = 1;
										data.wallet_ids.operational = wallet_ids.operational;

										data.save((err3) => {
											if (err3) {
												console.log(err3);
												var message3 = err3;
												if (err3.message) {
													message3 = err3.message;
												}
												res.status(200).json({
													status: 0,
													message: message3,
												});
											} else {
												let content =
													"<p>You are added as a Merchant in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
													config.mainIP +
													"/merchant/" +
													bank.name +
													"'>http://" +
													config.mainIP +
													"/merchant/" +
													bank.name +
													"</a></p><p><p>Your username: " +
													data.username +
													"</p><p>Your password: " +
													data.password +
													"</p>";
												sendMail(content, "Infra Merchant Created", email);
												let content2 =
													"You are added as a Merchant in E-Wallet application Login URL: http://" +
													config.mainIP +
													"/merchant/" +
													bank.name +
													" Your username: " +
													data.username +
													" Your password: " +
													data.password;
												sendSMS(content2, mobile);
												res.status(200).json({
													status: 1,
													message: "Merchant created successfully",
													blockchain_result: result,
												});
											}
										});
									}
								})
								.catch((error) => {
									console.log(error);
									res.status(200).json({
										status: 0,
										message: error.message,
									});
								});
						}
					}
				});
			}
		}
	);
});

/**
 * @swagger
 * /infra/editMerchant:
 *  post:
 *    description: Use to edit merchant by infra
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/infra/editMerchant", jwtTokenAuth, function (req, res) {
	var {
		merchant_id,
		name,
		logo,
		description,
		document_hash,
		email,
		mobile,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Merchant.findOneAndUpdate(
					{ _id: merchant_id, creator: 1, infra_id: infra._id },
					{
						name: name,
						logo: logo,
						description: description,
						document_hash: document_hash,
						mobile: mobile,
						email: email,
					},
					(err1, merchant) => {
						var result1 = errorMessage(err1, merchant, "Merchant not found.");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							res.status(200).json({
								status: 1,
								message: "Merchant edited successfully",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/getDashStats", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Cashier.aggregate(
					[{ 
						$match : {
							status:1,
						}
					},
						{
							$group: {
								_id: null,
								totalFee: {
									$sum: "$fee_generated",
								},
								totalCommission: {
									$sum: "$commission_generated",
								},
								totalTrans:{
									$sum: "$total_trans",
								},
							}
						},
					],
					async (err1, bankaggregate) => {
						PartnerCashier.aggregate(
							[{ 
								$match : {
									status:1,
								}
							},
								{
									$group: {
										_id: null,
										
										totalFee: {
											$sum: "$fee_generated",
										},
										totalCommission: {
											$sum: "$commission_generated",
										},
										totalTrans:{
											$sum: "$total_trans",
										},
									}
								},
							],
							async (err2, partneraggregate) => {
								Invoice.aggregate(
									[{ 
										$match : {
											paid:1,
											date_paid: {
												$gte: new Date(),
												$lte: new Date(),
											},
										}
									},
										{
											$group: {
												_id: null,
												totalFee: {
													$sum: "$fee",
												},
												totalCommission:  {
													$sum: "$commission",
												},
												billsPaid: { $sum: 1 },
											},
										},
									],
									async (err3, invoices) => {
										let bankFee = 0;
										let bankCommission = 0;
										let partnerFee = 0;
										let partnerCommission = 0;
										let bankTransCount = 0;
										let partnerTransCount = 0;
										let merchantFee = 0;
										let merchantCommission = 0;
										let merchantInvoice = 0;
										if (
											bankaggregate != undefined &&
											bankaggregate != null &&
											bankaggregate.length > 0
										) {
											bankFee = bankaggregate[0].totalFee;
											bankCommission = bankaggregate[0].totalCommission;
											bankTransCount = bankaggregate[0].totalTrans;
										}
										if (
											partneraggregate != undefined &&
											partneraggregate != null &&
											partneraggregate.length > 0
										) {
											partnerFee = partneraggregate[0].totalFee;
											partnerCommission = partneraggregate[0].totalCommission;
											partnerTransCount = partneraggregate[0].totalTrans;
										}
										if (
											invoices != undefined &&
											invoices != null &&
											invoices.length > 0
										) {
											merchantFee = invoices[0].totalFee;
											merchantCommission = invoices[0].totalCommission;
											merchantInvoice = invoices[0].billsPaid;
										}
										var totalBanks = await Bank.countDocuments({});
										var totalbranches = await Branch.countDocuments({});
										var totalcashiers = await Cashier.countDocuments({});
										var totalpartners = await Partner.countDocuments({});
										var totalpartnerbranches = await PartnerBranch.countDocuments({});
										var totalpartnercashiers = await PartnerCashier.countDocuments({});
										var totalbankmerchants = await Merchant.countDocuments({creator:0});
										var totalInframerchants = await Merchant.countDocuments({creator:1});
										var totalusers = await User.countDocuments({});
										var totalmerchantbranches = await MerchantBranch.countDocuments({});
										var totalmerchantstaff = await MerchantPosition.countDocuments({type:'staff'});
										var totalmerchantcashier = await MerchantPosition.countDocuments({type:'cashier'});
										var totalinvoicecreated = await Invoice.countDocuments(
											{
												created_at: {
													$gte: new Date(),
													$lte: new Date(),
												},
											}
										);
										res.status(200).json({
											status: 1,
											totalBanks: totalBanks,
											totalBankMerchants: totalbankmerchants,
											totalInfraMerchants: totalInframerchants,
											totalMerchantStaff: totalmerchantstaff,
											totalMerchantCashier: totalmerchantcashier,
											totalusers: totalusers,
											totalcashiers: totalcashiers,
											totalmerchantbranches: totalmerchantbranches,
											totalpartners: totalpartners,
											totalpartnerbrances:totalpartnerbranches,
											totalpartnercashiers:totalpartnercashiers,
											totalbranches: totalbranches,
											bankfee: bankFee,
											bankcommission: bankCommission,
											partnerfee: partnerFee,
											partnercommission: partnerCommission,
											banktranscount: bankTransCount,
											partnertranscount: partnerTransCount,
											merchanfee: merchantFee,
											merchantcommission: merchantCommission,
											merchantinvoice: merchantInvoice,
											merchantinvoicecreated: totalinvoicecreated,
										});

									}
								);
							}
						);
					}

				);
			}
		}
	);
});

router.post("/infraSetupUpdate", jwtTokenAuth, function (req, res) {
	const { username, password } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOneAndUpdate(
		{
			username: jwtusername,
			status: 1,
		},
		{
			$set: {
				username: username,
				password: password,
			},
		},
		function (err, infra) {
			var result = errorMessage(err, infra, "Incorrect username or password");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				res.status(200).json({
					success: "Updated successfully",
				});
			}
		}
	);
});

/**
 * @swagger
 * /getBanks:
 *  post:
 *    description: Use to get all banksby infra
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/getBanks", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.find({}, function (err1, bank) {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message) {
							message1 = err1.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else {
						res.status(200).json({
							banks: bank,
						});
					}
				});
			}
		}
	);
});

router.post("/setupUpdate", function (req, res) {
	let data = new Infra();
	const { username, password, email, mobile, ccode } = req.body;

	data.name = "Infra Admin";
	data.username = username;

	data.password = password;
	data.mobile = mobile;
	data.email = email;
	data.ccode = ccode;
	data.isAdmin = true;

	data.save((err) => {
		if (err) {
			console.log(err);
			var message = err;
			if (err.message) {
				message = err.message;
			}
			res.status(200).json({
				status: 0,
				message: message,
			});
		} else {
			let content =
				"<p>Your Infra account is activated in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
				config.mainIP +
				"'>http://" +
				config.mainIP +
				"</a></p><p><p>Your username: " +
				data.username +
				"</p><p>Your password: " +
				data.password +
				"</p>";
			sendMail(content, "Infra Account Activated", data.email);
			let content2 =
				"Your Infra account is activated in E-Wallet application. Login URL: http://" +
				config.mainIP +
				" Your username: " +
				data.username +
				" Your password: " +
				data.password;
			sendSMS(content2, mobile);
			res.status(200).json({
				success: true,
			});
		}
	});
});

router.get("/checkInfra", function (req, res) {
	Infra.countDocuments({}, function (err, c) {
		let result = errorMessage(
			err,
			c,
			"Token changed or user not valid. Try to login again or contact system administrator."
		);
		if (result.status == 0) {
			res.status(200).json(result);
		} else {
			res.status(200).json({
				status: 1,
				infras: c,
			});
		}
	});
});

/**
 * @swagger
 * /addBank:
 *  post:
 *    description: Use to create bank by infra
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/addBank", jwtTokenAuth, function (req, res) {
	let data = new Bank();
	const {
		name,
		bcode,
		address1,
		state,
		zip,
		country,
		ccode,
		mobile,
		email,
		logo,
		contract,
		otp_id,
		otp,
	} = req.body;

	if (
		name == "" ||
		address1 == "" ||
		state == "" ||
		mobile == "" ||
		email == ""
	) {
		res.status(200).json({
			status: 0,
			message: "Please provide valid inputs",
		});
		return;
	}
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			var result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.findOne(
					{
						$or: [{ bcode: bcode }, { mobile: mobile }, { email: email }],
					},
					(err1, bank) => {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						} else if (bank != null) {
							res.status(200).json({
								status: 0,
								message:
									"Bank with either same code/mobile/email already exist.",
							});
						} else {
							OTP.findOne(
								{
									_id: otp_id,
									otp: otp,
								},
								function (err2, otpd) {
									if (err2) {
										console.log(err2);
										var message2 = err;
										if (err2.message) {
											message2 = err2.message;
										}
										res.status(200).json({
											status: 0,
											message: message2,
										});
									} else if (!otpd) {
										res.status(200).json({
											status: 0,
											message: "OTP Missmatch",
										});
									} else {
										data.name = name;
										data.bcode = bcode;
										data.address1 = address1;
										data.state = state;
										data.country = country;
										data.zip = zip;
										data.ccode = ccode;
										data.mobile = mobile;
										data.username = mobile;
										data.email = email;
										data.user_id = user._id;
										data.logo = logo;
										data.contract = contract;
										data.password = makeid(10);

										data.save((err3, d) => {
											if (err3) {
												console.log(err);
												var message3 = err3;
												if (err3.message) {
													message3 = err3.message;
												}
												res.status(200).json({
													status: 0,
													message: message3,
												});
											} else {
												let data2 = new Document();
												data2.bank_id = d._id;
												data2.contract = contract;
												data2.save((err4) => {});

												let content =
													"<p>Your bank is added in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
													config.mainIP +
													"/bank'>http://" +
													config.mainIP +
													"/bank</a></p><p><p>Your username: " +
													data.username +
													"</p><p>Your password: " +
													data.password +
													"</p>";
												sendMail(content, "Bank Account Created", email);
												let content2 =
													"Your bank is added in E-Wallet application Login URL: http://" +
													config.mainIP +
													"/bank Your username: " +
													data.username +
													" Your password: " +
													data.password;
												sendSMS(content2, mobile);

												res.status(200).json({
													status: 1,
													message: "Added Bank successfully",
												});
											}
										});
									}
								}
							);
						}
					}
				);
			}
		}
	);
});

/**
 * @swagger
 * /editBank:
 *  post:
 *    description: Use to edit bank by infra
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/editBank", jwtTokenAuth, function (req, res) {
	let data = new Bank();
	const {
		bank_id,
		name,
		bcode,
		address1,
		state,
		zip,
		country,
		ccode,
		mobile,
		email,
		logo,
		contract,
		otp_id,
		otp,
	} = req.body;

	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				OTP.findOne(
					{
						_id: otp_id,
						otp: otp,
					},
					function (err1, otpd) {
						let result1 = errorMessage(err1, otpd, err);
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							if (otpd.otp == otp) {
								if (
									name == "" ||
									address1 == "" ||
									state == "" ||
									mobile == "" ||
									email == ""
								) {
									return res.status(200).json({
										status: 0,
										message: "Please provide valid inputs",
									});
								}

								data.name = name;
								data.address1 = address1;
								data.state = state;
								data.country = country;
								data.bcode = bcode;
								data.zip = zip;
								data.ccode = ccode;
								data.mobile = mobile;
								data.username = mobile;
								data.email = email;
								data.user_id = user._id;
								data.logo = logo;
								data.contract = contract;
								data.password = makeid(10);
								Bank.findByIdAndUpdate(
									bank_id,
									{
										name: name,
										address1: address1,
										state: state,
										zip: zip,
										ccode: ccode,
										bcode: bcode,
										country: country,
										mobile: mobile,
										email: email,
										logo: logo,
										contract: contract,
									},
									(err2) => {
										if (err2) {
											console.log(err2);
											var message2 = err2;
											if (err2.message) {
												message2 = err2.message;
											}
											res.status(200).json({
												status: 0,
												message: message2,
											});
										} else {
											let data2 = new Document();
											data2.bank_id = bank_id;
											data2.contract = contract;
											data2.save((err3) => {});
											return res.status(200).json(data);
										}
									}
								);
							} else {
								res.status(200).json({
									status: 0,
									message: "OTP Missmatch",
								});
							}
						}
					}
				);
			}
		}
	);
});

router.post("/getInfraHistory", jwtTokenAuth, function (req, res) {
	const { from, bank_id } = req.body;

	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, f) {
			let result = errorMessage(
				err,
				f,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.findOne(
					{
						_id: bank_id,
					},
					function (err1, b) {
						let result1 = errorMessage(err1, b, "Bank not found");
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							const wallet_type = "infra_" + from;
							const wallet = b.wallet_ids[wallet_type];

							getStatement(wallet)
								.then(function (res1) {
									res.status(200).json({
										status: 1,
										history: res1,
									});
								})
								.catch((error) => {
									res.status(200).json(catchError(error));
								});
						}
					}
				);
			}
		}
	);
});

router.get("/infra/getMyWalletBalance", jwtTokenAuth, function (req, res) {
	const { from, bank } = req.query;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (e, b) {
			if (e) {
				console.log(e);
				var message = e;
				if (e.message) {
					message = e.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (b == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Bank.findOne(
					{
						_id: bank,
					},
					function (err, ba) {
						let result = errorMessage(err, ba, "Not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							const wallet_type = "infra_" + from;
							const wallet_id = ba.wallet_ids[wallet_type];

							getBalance(wallet_id)
								.then(function (result7) {
									res.status(200).json({
										status: 1,
										balance: result7,
									});
								})
								.catch((error) => {
									res.status(200).json(catchError(error));
								});
						}
					}
				);
			}
		}
	);
});

router.get("/getInfraOperationalBalance", function (req, res) {
	res.status(200).json({
		status: 0,
		message: "This API is Removed",
		Replace:
			"/infra/getWalletBalance - {from, bank} where from can be 'master' or 'operational'",
	});
});
router.get("/getInfraMasterBalance", function (req, res) {
	res.status(200).json({
		status: 0,
		message: "This API is Removed",
		Replace:
			"/infra/getWalletBalance - {from, bank} where from can be 'master' or 'operational'",
	});
});

router.post("/getPermission", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(err, user, "Incorrect username or password");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				if (user.profile_id && user.profile_id != "") {
					Profile.findOne(
						{
							_id: user.profile_id,
						},
						function (err1, profile) {
							var p = JSON.parse(profile.permissions);
							res.status(200).json({
								permissions: p,
								name: user.name,
								isAdmin: user.isAdmin,
								initial_setup: user.initial_setup,
							});
						}
					);
				} else {
					if (user.isAdmin) {
						res.status(200).json({
							permissions: "all",
							name: user.name,
							isAdmin: user.isAdmin,
							initial_setup: user.initial_setup,
						});
					} else {
						res.status(200).json({
							permissions: "",
							name: user.name,
							isAdmin: user.isAdmin,
							initial_setup: user.initial_setup,
						});
					}
				}
			}
		}
	);
});

router.post("/addProfile", jwtTokenAuth, function (req, res) {
	let data = new Profile();
	const {
		pro_name,
		pro_description,
		create_bank,
		edit_bank,
		create_fee,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const user_id = user._id;

				data.name = pro_name;
				data.description = pro_description;
				var c = {
					create_bank,
					edit_bank,
					create_fee,
				};
				data.permissions = JSON.stringify(c);
				data.user_id = user_id;

				data.save((err1) => {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message) {
							message1 = err1.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else {
						return res.status(200).json({
							success: "True",
						});
					}
				});
			}
		}
	);
});

router.post("/editProfile", jwtTokenAuth, function (req, res) {
	const {
		pro_name,
		pro_description,
		create_bank,
		edit_bank,
		create_fee,
		profile_id,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				var _id = profile_id;
				var c = {
					create_bank,
					edit_bank,
					create_fee,
				};
				let c2 = JSON.stringify(c);
				Profile.findOneAndUpdate(
					{
						_id: _id,
					},
					{
						name: pro_name,
						description: pro_description,
						permissions: c2,
					},
					(err1, d) => {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						} else {
							return res.status(200).json({
								success: true,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/addInfraUser", jwtTokenAuth, function (req, res) {
	let data = new Infra();
	const {
		name,
		email,
		country,
		ccode,
		mobile,
		username,
		password,
		profile_id,
		logo,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				data.country = country;
				data.ccode = ccode;
				data.name = name;
				data.email = email;
				data.mobile = mobile;
				data.username = username;
				data.password = password;
				data.profile_id = profile_id;
				data.logo = logo;
				data.save((err1) => {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message) {
							message1 = err1.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else {
						let content =
							"<p>Your have been added as Infra in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
							config.mainIP +
							"/'>http://" +
							config.mainIP +
							"/</a></p><p><p>Your username: " +
							username +
							"</p><p>Your password: " +
							password +
							"</p>";
						sendMail(content, "Infra Account Created", email);
						let content2 =
							"Your have been added as Infra in E-Wallet application Login URL: http://" +
							config.mainIP +
							" Your username: " +
							username +
							" Your password: " +
							password;
						sendSMS(content2, mobile);
						return res.status(200).json({
							success: "True",
						});
					}
				});
			}
		}
	);
});

router.post("/editInfraUser", jwtTokenAuth, function (req, res) {
	const {
		name,
		email,
		mobile,
		username,
		password,
		profile_id,
		logo,
		country,
		ccode,
		user_id,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				var _id = user_id;
				Infra.findOneAndUpdate(
					{
						_id: _id,
					},
					{
						name: name,
						email: email,
						mobile: mobile,
						country: country,
						ccode: ccode,
						username: username,
						password: password,
						profile_id: profile_id,
						logo: logo,
					},
					(err1, d) => {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						} else {
							return res.status(200).json({
								success: true,
							});
						}
					}
				);
			}
		}
	);
});

/**
 * @swagger
 * /getBank:
 *  post:
 *    description: Use to get a bank by infra
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/getBank", jwtTokenAuth, function (req, res) {
	const { bank_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.findOne(
					{
						_id: bank_id,
					},
					function (err1, bank) {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						} else {
							res.status(200).json({
								banks: bank,
							});
						}
					}
				);
			}
		}
	);
});

/**
 * @swagger
 * /getRules:
 *  post:
 *    description: Use to get bank's rules by infra
 *    responses:
 *      '200':
 *        description: A successful response
 */

router.post("/getRules", jwtTokenAuth, function (req, res) {
	const { bank_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Fee.find(
					{
						bank_id,
						status: { $in: [1, 2] },
					},
					function (err1, rules) {
						if (err1) {
							console.log(err1);
							var message1 = err;
							if (err.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						} else {
							res.status(200).json({
								rules: rules,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/bankStatus", jwtTokenAuth, function (req, res) {
	const { status, bank_id } = req.body;

	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Bank.findByIdAndUpdate(
					bank_id,
					{
						status: status,
					},
					(err1) => {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						} else {
							res.status(200).json({
								status: 1,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/getRoles", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				const user_id = user._id;
				Profile.find(
					{
						user_id,
					},
					function (err1, bank) {
						if (err1) {
							console.log(err1);
							var message1 = err1;
							if (err1.message) {
								message1 = err1.message;
							}
							res.status(200).json({
								status: 0,
								message: message1,
							});
						} else {
							res.status(200).json({
								roles: bank,
							});
						}
					}
				);
			}
		}
	);
});

/**
 * @swagger
 * /getInfraUsers:
 *  post:
 *    description: Use to get all infra users by infra
 *    responses:
 *      '200':
 *        description: A successful response
 */


router.post("/getInfraUsers", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Infra.find({}, function (err1, bank) {
					if (err1) {
						console.log(err1);
						var message1 = err;
						if (err1.message) {
							message1 = err1.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else {
						res.status(200).json({
							users: bank,
						});
					}
				});
			}
		}
	);
});

router.post("/getProfile", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				res.status(200).json({
					users: user,
				});
			}
		}
	);
});

router.post("/editInfraProfile", jwtTokenAuth, function (req, res) {
	const { name, username, email, mobile, password, ccode } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				let upd = {};
				if (password == "" || password == undefined || password == null) {
					upd = {
						name: name,
						email: email,
						mobile: mobile,
						username: username,
						ccode: ccode,
					};
				} else {
					upd = {
						name: name,
						email: email,
						mobile: mobile,
						password: password,
						username: username,
						ccode: ccode,
					};
				}

				Infra.findByIdAndUpdate(user._id, upd, (err1) => {
					if (err1) {
						console.log(err1);
						var message1 = err1;
						if (err1.message) {
							message1 = err1.message;
						}
						res.status(200).json({
							status: 0,
							message: message1,
						});
					} else {
						res.status(200).json({
							success: true,
						});
					}
				});
			}
		}
	);
});

router.post("/generateOTP", jwtTokenAuth, function (req, res) {
	let data = new OTP();
	const { username, page, name, email, mobile, bcode } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				data.user_id = user._id;
				data.otp = makeotp(6);
				data.page = page;
				if (page == "editBank") {
					Bank.findOne(
						{
							username,
						},
						function (err1, bank) {
							data.mobile = bank.mobile;
							data.save((err2, ot) => {
								if (err2) {
									console.log(err2);
									var message2 = err2;
									if (err2.message) {
										message2 = err2.message;
									}
									res.status(200).json({
										status: 0,
										message: message2,
									});
								} else {
									let content = "Your OTP to edit Bank is " + data.otp;
									sendSMS(content, bank.mobile);
									sendMail(content, "OTP", bank.email);

									res.status(200).json({
										id: ot._id,
									});
								}
							});
						}
					);
				} else {
					Bank.find(
						{
							$or: [
								{ name: name },
								{ email: email },
								{ mobile: mobile },
								{ bcode: bcode },
							],
						},
						function (err2, banks) {
							if (err2) {
								console.log(err2);
								var message2 = err2;
								if (err2.message) {
									message2 = err2.message;
								}
								res.status(200).json({
									status: 0,
									message: message2,
								});
							} else if (banks.length == 0) {
								data.mobile = user.mobile;
								data.save((err3, ot) => {
									if (err3) {
										console.log(err3);
										var message3 = err3;
										if (err3.message) {
											message3 = err3.message;
										}
										res.status(200).json({
											status: 0,
											message: message3,
										});
									} else {
										let content = "Your OTP to add Bank is " + data.otp;
										sendSMS(content, user.mobile);
										sendMail(content, "OTP", user.email);

										res.status(200).json({
											status: 1,
											id: ot._id,
										});
									}
								});
							} else {
								if (banks[0].name == name) {
									res.status(200).json({
										status: 0,
										message: "Bank already exist with the same name.",
									});
								} else if (banks[0].bcode == bcode) {
									res.status(200).json({
										status: 0,
										message: "Bank already exist with the same code.",
									});
								} else if (banks[0].mobile == mobile) {
									res.status(200).json({
										status: 0,
										message: "Bank already exist with the same mobile.",
									});
								} else if (banks[0].email == email) {
									res.status(200).json({
										status: 0,
										message: "Bank already exist with the same email.",
									});
								} else {
									res.status(200).json({
										status: 0,
										message: "Can not add bank.",
									});
								}
							}
						}
					);
				}
			}
		}
	);
});

router.post("/transferMoney", jwtTokenAuth, function (req, res) {
	const { from, to, note, amount, auth } = req.body;

	if (auth == "infra") {
		const jwtusername = req.sign_creds.username;
		Infra.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err, f) {
				let result = errorMessage(
					err,
					f,
					"Token changed or user not valid. Try to login again or contact system administrator."
				);
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					const infra_email = f.email;
					const infra_mobile = f.mobile;

					var c = to.split("@");
					const bank = c[2];
					Bank.findOne(
						{
							name: bank,
						},
						function (err1, b) {
							//var oamount = amount - fee;
							var oamount = amount;

							let data = {};
							data.amount = oamount.toString();
							data.from = from;
							data.to = to;
							data.note = note;
							data.email1 = infra_email;
							data.email2 = infra_email;
							data.mobile1 = infra_mobile;
							data.mobile2 = infra_mobile;
							data.from_name = f.name;
							data.to_name = f.name;
							data.user_id = "";

							transferThis(data)
								.then(function (result1) {})
								.catch((error) => {
									console.log(error);
									res.status(200).json({
										status: 0,
										message: error.message,
									});
									return;
								});
							res.status(200).json({
								status: 1,
								message: "Money transferred successfully!",
							});
						}
					);
				}
			}
		);
	} else {
		res.status(200).json({
			status: null,
		});
	}
});

router.post("/checkFee", jwtTokenAuth, function (req, res) {
	const { amount, auth } = req.body;

	if (auth == "infra") {
		const jwtusername = req.sign_creds.username;
		Infra.findOne(
			{
				username: jwtusername,
				status: 1,
			},
			function (err, f) {
				let result = errorMessage(
					err,
					f,
					"Token changed or user not valid. Try to login again or contact system administrator."
				);
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					var temp = (amount * mainFee) / 100;
					var fee = temp;
					res.status(200).json({
						status: 1,
						fee: fee,
					});
				}
			}
		);
	} else {
		res.status(200).json({
			status: 1,
			fee: 0,
		});
	}
});

router.post("/approveFee", jwtTokenAuth, function (req, res) {
	const { id } = req.body;
	const jwtusername = req.sign_creds.username;
	Infra.findOne(
		{
			username: jwtusername,
		},
		function (err, infra) {
			let result = errorMessage(
				err,
				infra,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			}
			Fee.findOneAndUpdate(
				{
					_id: id,
					status: 2,
				},
				{
					$set: { status: 1 },
				},
				function (err1, fee) {
					let result1 = errorMessage(err1, fee, "Infra share not updated");
					if (result1.status == 0) {
						res.status(200).json(result1);
					} else {
						res.status(200).json({
							status: 1,
							message: "Updated successfully",
						});
					}
				}
			);
		}
	);
});

module.exports = router;
