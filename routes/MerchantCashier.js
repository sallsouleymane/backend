const express = require("express");
const router = express.Router();

const jwtTokenAuth = require("./JWTTokenAuth");

//models
const Merchant = require("../models/merchant/Merchant");
const MerchantBranch = require("../models/merchant/MerchantBranch");
const MerchantCashier = require("../models/merchant/MerchantCashier");
const InvoiceGroup = require("../models/merchant/InvoiceGroup");
const Invoice = require("../models/merchant/Invoice");

router.post("/merchantCashier/deleteInvoice", jwtTokenAuth, function (req, res) {
	const { invoice_id  } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			if (err || cashier == null) {
				console.log(err);
				res.status(200).json({
					status: 0,
					message: "Internal Server Error",
				});
			} else {
				Invoice.deleteOne({ _id: invoice_id }, (err) => {
					if (err) {
						console.log(err);
						res.status(200).json({
							status: 0,
							message: "Internal Server Error",
						});
					} else {
				
				res.status(200).json({
					status: 1,
					message: "Invoice deleted",
				});
			}
			});
			}
		}
	);
});

router.get("/merchantCashier/todaysStatus", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			if (err || cashier == null) {
				console.log(err);
				res.status(200).json({
					status: 0,
					message: "Internal Server Error",
				});
			} else {
				res.status(200).json({
					status: 1,
					message: "Today's Status",
					bills_paid: cashier.bills_paid,
					bills_raised: cashier.bills_raised,
				});
			}
		}
	);
});

router.post("/merchantCashier/createInvoiceGroup", jwtTokenAuth, (req, res) => {
	let data = new InvoiceGroup();
	const { code, name, description } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			if (err) {
				res.status(200).json({
					status: 0,
					message: "Internal Server error",
				});
			} else if (cashier == null){
				res.status(200).json({
					status: 0,
					message: "Cashier is blocked",
				});
			} else {
				data.code = code;
				data.name = name;
				data.description = description;
				data.cashier_id = cashier._id;
				data.save((err, group) => {
					if (err) {
						console.log(err);
						return res.status(200).json({
							status: 0,
							message: "code already used",
							err: err
						});
					} else {
						return res.status(200).json({
							status: 1,
							message: "Invoice Group Created",
							group: group,
						});
					}
				});
			}
		}
	);
});

router.post("/merchantCashier/editInvoiceGroup", jwtTokenAuth, (req, res) => {
	const { group_id, code, name, description } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			if (err) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else if (cashier == null){
				res.status(200).json({
					status: 0,
					message: "Cashier is blocked",
				});
			} else {
				InvoiceGroup.findOneAndUpdate(
					{ _id: group_id,
					cashier_id: cashier._id },
					{ code: code, name: name, description: description },
					(err, group) => {
						if (err) {
							res.status(200).json({
								status: 0,
								message: "Internal Server Error",
							});
						} else if (group == null) {
							res.status(200).json({
								status: 0,
								message: "Invoice Group not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								message: "Invoice Group edited successfully",
							});
						}
					}
				);
			}
		}
	);
});

router.get("/merchantCashier/listInvoiceGroups", jwtTokenAuth, (req, res) => {
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			if (err) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else if (cashier == null){
				res.status(200).json({
					status: 0,
					message: "Cashier is blocked",
				});
			} else {
				InvoiceGroup.find({ cashier_id: cashier._id }, (err, groups) => {
					if (err) {
						res.status(200).json({
							status: 0,
							message: "Internal server error",
						});
					} else {
						res.status(200).json({
							status: 1,
							message: "Invoice Groups list",
							groups: groups,
						});
					}
				});
			}
		}
	);
});

router.post("/merchantCashier/uploadInvoices", jwtTokenAuth, (req, res) => {
try {
	const { group_id, invoices } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			if (err) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else if (cashier == null) {
				res.status(200).json({
					status: 0,
					message: "Cashier is blocked",
				});
			} else {
				InvoiceGroup.findOne(
					{ _id: group_id, cashier_id: cashier._id },
					async (err, group) => {
						if (err) {
							console.log(err);
							res.status(200).json({
								status: 0,
								message: "Internal server error",
							});
						} else if (group == null) {
							res.status(200).json({
								status: 0,
								message: "Group not found",
							});
						} else {
							var invoicePromises = invoices.map(async (invoice) => {
								var {
									number,
									name,
									amount,
									due_date,
									description,
									mobile,
									ccode,
								} = invoice;
								var invoiceObj = new Invoice();
								invoiceObj.number = number;
								invoiceObj.name = name;
								invoiceObj.amount = amount;
								invoiceObj.merchant_id = cashier.merchant_id;
								invoiceObj.due_date = due_date;
								invoiceObj.description = description;
								invoiceObj.mobile = mobile;
								invoiceObj.ccode = ccode;
								invoiceObj.group_id = group_id;
								invoiceObj.cashier_id = cashier._id;
								invoiceObj.paid = 0;
								await invoiceObj.save();
								
								var branch = await MerchantBranch.findOneAndUpdate(
									{ _id: cashier.branch_id, status: 1 },
									{ $inc: { bills_raised: 1, amount_due: amount } }
								);
								if (branch == null) { throw new Error("Can not update the MerchantBranch status."); }

								var m = await Merchant.findOneAndUpdate(
									{ _id: branch.merchant_id },
									{
										$inc: {
											bills_raised: 1,
											amount_due: amount,
										},
									}
								);
								if (m == null) { throw new Error("Can not update the Merchant status."); }

								var g = await InvoiceGroup.findOneAndUpdate(
									{ _id: group._id },
									{
										$inc: {
											bills_raised: 1,
										},
									}
								);
								if (g == null) { throw new Error("Can not update the InvoiceGroup status."); }

								var c = await MerchantCashier.findOneAndUpdate(
									{ _id: cashier._id },
									{
										$inc: {
											bills_raised: 1,
										},
									}
								);
								if (c == null) { throw new Error("Can not update the InvoiceGroup status."); }

								return true;
								
							});
							await Promise.all(invoicePromises);
							res.status(200).json({
								status: 1,
								message: "Invoices uploaded"
							});
						}
					}
				);
			}
		}
	);
} catch (err) {
	console.log(err);
	var message = "Internal server error";
	if( err.message ) {
		message = err.message
	}
	res.status(200).json({ status: 0, message: message, err: err});
}
});

router.post("/merchantCashier/editInvoice", jwtTokenAuth, (req, res) => {
	const {
		group_id,
		invoice_id,
		number,
		name,
		amount,
		due_date,
		description,
		mobile,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			if (err) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else if (cashier == null) {
				res.status(200).json({
					status: 0,
					message: "Cashier is blocked",
				});
			} else {
				InvoiceGroup.findOne(
					{ _id: group_id, cashier_id: cashier._id },
					(err, group) => {
						if (err) {
							res.status(200).json({
								status: 0,
								message: "Unauthorized",
							});
						} else if (group == null) {
							res.status(200).json({
								status: 0,
								message: "Group not found",
							});
						} else {
							Invoice.findOneAndUpdate(
								{ _id: invoice_id, cashier_id: cashier._id, paid: 0 },
								{
									group_id,
									number,
									name,
									amount,
									due_date,
									description,
									mobile,
								},
								(err, invoice) => {
									if (err){
										console.log(err);
												res.status(200).json({
													status: 0,
													message: "Internal server error",
												});
									}
									else if (invoice == null){
										res.status(200).json({
											status: 0,
											message: "Invoice might already be paid. Or Does not belong to this group.",
										});
									} else {
									var biasAmount = amount - invoice.amount;
									MerchantBranch.findOneAndUpdate(
										{ _id: cashier.branch_id, status: 1 },
										{ $inc: { amount_due: biasAmount } },
										(err, branch) => {
											if (err) {
												console.log(err);
												res.status(200).json({
													status: 0,
													message: "Internal server error",
												});
											} else if (branch == null) {
												res.status(200).json({
													status: 0,
													message: "Branch is blocked",
												});
											} else {
												Merchant.findOneAndUpdate(
													{ _id: branch.merchant_id },
													{
														$inc: {
															amount_due: biasAmount,
														},
													},
													(err, merchant) => {
														if (err || merchant == null) {
															console.log(err);
															res.status(200).json({
																status: 0,
																message: "Internal server error",
															});
														} else {
															res.status(200).json({
																status: 1,
																message: "Invoice edited successfully",
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
			}
		}
	);
});

router.post("/merchantCashier/listInvoices", jwtTokenAuth, (req, res) => {
	const { group_id } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			if (err) {
				res.status(200).json({
					status: 0,
					message: "Unauthorized",
				});
			} else if (cashier == null){
				res.status(200).json({
					status: 0,
					message: "Cashier is blocked",
				});
			} else {
				Invoice.find({ cashier_id: cashier._id, group_id }, (err, invoices) => {
					if (err) {
						res.status(200).json({
							status: 0,
							message: "Internal server error",
						});
					} else {
						res.status(200).json({
							status: 1,
							invoices: invoices,
						});
					}
				});
			}
		}
	);
});

module.exports = router;
