const express = require("express");
const router = express.Router();

const jwtTokenAuth = require("./JWTTokenAuth");

//models
const Merchant = require("../models/merchant/Merchant");
const MerchantBranch = require("../models/merchant/MerchantBranch");
const MerchantCashier = require("../models/merchant/MerchantCashier");
const InvoiceGroup = require("../models/merchant/InvoiceGroup");
const Invoice = require("../models/merchant/Invoice");
const Offering = require("../models/merchant/Offering");
const Tax = require("../models/merchant/Tax");
const { promises } = require("fs-extra");

router.post("/merchantCashier/listOfferings", jwtTokenAuth, function (
	req,
	res
) {
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, cashier) {
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
			} else if (cashier == null) {
				res.status(200).json({
					status: 0,
					message: "Merchant is not valid",
				});
			} else {
				Offering.find(
					{ merchant_id: cashier.merchant_id },
					(err, offerings) => {
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
							res.status(200).json({
								status: 1,
								offerings: offerings,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchantCashier/listTaxes", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, cashier) {
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
			} else if (cashier == null) {
				res.status(200).json({
					status: 0,
					message: "Merchant is not valid",
				});
			} else {
				Tax.find({ merchant_id: cashier.merchant_id }, (err, taxes) => {
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
						res.status(200).json({
							status: 1,
							taxes: taxes,
						});
					}
				});
			}
		}
	);
});

router.post("/merchantCashier/deleteInvoice", jwtTokenAuth, function (
	req,
	res
) {
	const { invoice_id } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
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
			} else if (cashier == null) {
				console.log(err);
				res.status(200).json({
					status: 0,
					message: "Merchant cashier is not valid",
				});
			} else {
				Invoice.deleteOne({ _id: invoice_id }, (err) => {
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
			} else if (cashier == null) {
				console.log(err);
				res.status(200).json({
					status: 0,
					message: "Cashier is not valid",
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
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (cashier == null) {
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
						var message = err;
						if (err.message) {
							message = err.message;
						}
						res.status(200).json({
							status: 0,
							message: message,
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
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (cashier == null) {
				res.status(200).json({
					status: 0,
					message: "Cashier is blocked",
				});
			} else {
				InvoiceGroup.findOneAndUpdate(
					{ _id: group_id, cashier_id: cashier._id },
					{ code: code, name: name, description: description },
					(err, group) => {
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
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (cashier == null) {
				res.status(200).json({
					status: 0,
					message: "Cashier is blocked",
				});
			} else {
				InvoiceGroup.find({ cashier_id: cashier._id }, (err, groups) => {
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
	const { group_id, invoices } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		(err, cashier) => {
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
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
							});
						} else if (group == null) {
							res.status(200).json({
								status: 0,
								message: "Group not found",
							});
						} else {
							let failed = [];
							var invoicePromises = invoices.map(async (invoice) => {
								try {
									var {
										number,
										name,
										amount,
										bill_date,
										bill_period,
										due_date,
										description,
										mobile,
										ccode,
										items,
										paid,
									} = invoice;
									if (paid != 1) {
										paid = 0;
									}
									var updatedItems = [];
									for (const item of items) {
										var { item_code, quantity, tax_code, total_amount } = item;
										var item_desc = await Offering.findOne(
											{ code: item_code, merchant_id: cashier.merchant_id },
											"code name denomination unit_of_measure unit_price description"
										);
										if (item_desc == null) {
											throw new Error("Item not found with code " + item_code);
										}

										var tax_desc = await Tax.findOne(
											{
												code: tax_code,
												merchant_id: cashier.merchant_id,
											},
											"code value"
										);
										if (tax_desc == null) {
											throw new Error("Tax not found with code " + tax_code);
										}

										updatedItems.push({
											item_desc: item_desc,
											quantity: quantity,
											tax_desc: tax_desc,
											total_amount: total_amount,
										});
									}
									var invoiceFound = await Invoice.findOne({
										number,
										merchant_id: cashier.merchant_id,
									});
									if (invoiceFound) {
										await Invoice.updateOne(
											{ _id: invoiceFound._id },
											{
												name,
												amount,
												bill_date,
												bill_period,
												due_date,
												description,
												mobile,
												ccode,
												items: updatedItems,
												paid,
											}
										);
									} else {
										var invoiceObj = new Invoice();
										invoiceObj.number = number;
										invoiceObj.name = name;
										invoiceObj.amount = amount;
										invoiceObj.merchant_id = cashier.merchant_id;
										invoiceObj.bill_date = bill_date;
										invoiceObj.bill_period = bill_period;
										invoiceObj.due_date = due_date;
										invoiceObj.description = description;
										invoiceObj.mobile = mobile;
										invoiceObj.ccode = ccode;
										invoiceObj.group_id = group_id;
										invoiceObj.cashier_id = cashier._id;
										invoiceObj.paid = paid;
										invoiceObj.items = updatedItems;

										await invoiceObj.save();

										var branch = await MerchantBranch.findOneAndUpdate(
											{ _id: cashier.branch_id },
											{ $inc: { bills_raised: 1, amount_due: amount } }
										);
										if (branch == null) {
											throw new Error(
												"Can not update the MerchantBranch status."
											);
										}

										var m = await Merchant.findOneAndUpdate(
											{ _id: branch.merchant_id },
											{
												$inc: {
													bills_raised: 1,
													amount_due: amount,
												},
											}
										);
										if (m == null) {
											throw new Error("Can not update the Merchant status.");
										}

										var g = await InvoiceGroup.findOneAndUpdate(
											{ _id: group._id },
											{
												$inc: {
													bills_raised: 1,
												},
											}
										);
										if (g == null) {
											throw new Error(
												"Can not update the InvoiceGroup status."
											);
										}

										var c = await MerchantCashier.findOneAndUpdate(
											{ _id: cashier._id },
											{
												$inc: {
													bills_raised: 1,
												},
											}
										);
										if (c == null) {
											throw new Error(
												"Can not update the InvoiceGroup status."
											);
										}
									}

									return true;
								} catch (err) {
									console.log(err);
									var message = err.toString();
									if (err.message) {
										message = err.message;
									}
									invoice.failure_reason = message;
									console.log(failed);
									failed.push(invoice);
								}
							});
							await Promise.all(invoicePromises);
							res.status(200).json({
								status: 1,
								message: "Invoices uploaded",
								failed: failed,
							});
						}
					}
				);
			}
		}
	);
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
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
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
							console.log(err);
							var message = err;
							if (err.message) {
								message = err.message;
							}
							res.status(200).json({
								status: 0,
								message: message,
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
									} else if (invoice == null) {
										res.status(200).json({
											status: 0,
											message:
												"Invoice might already be paid. Or Does not belong to this group.",
										});
									} else {
										var biasAmount = amount - invoice.amount;
										MerchantBranch.findOneAndUpdate(
											{ _id: cashier.branch_id, status: 1 },
											{ $inc: { amount_due: biasAmount } },
											(err, branch) => {
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
															} else if (merchant == null) {
																console.log(err);
																res.status(200).json({
																	status: 0,
																	message: "Merchant is not valid",
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
				console.log(err);
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			} else if (cashier == null) {
				res.status(200).json({
					status: 0,
					message: "Cashier is blocked",
				});
			} else {
				Invoice.find({ cashier_id: cashier._id, group_id }, (err, invoices) => {
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
