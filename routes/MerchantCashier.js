const express = require("express");
const router = express.Router();

const jwtTokenAuth = require("./JWTTokenAuth");
const { errorMessage, catchError } = require("./utils/errorHandler");

//models
const Merchant = require("../models/merchant/Merchant");
const MerchantBranch = require("../models/merchant/MerchantBranch");
const MerchantCashier = require("../models/merchant/MerchantCashier");
const InvoiceGroup = require("../models/merchant/InvoiceGroup");
const Invoice = require("../models/merchant/Invoice");
const Offering = require("../models/merchant/Offering");
const User = require("../models/User");
const Tax = require("../models/merchant/Tax");
const MerchantSettings = require("../models/merchant/MerchantSettings");
const MerchantCashierSettings = require("../models/merchant/MerchantCashierSettings");
const Customer = require("../models/merchant/Customer");
const { promises } = require("fs-extra");

router.post("/merchantCashier/getDetails", jwtTokenAuth, (req, res) => {
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(err, cashier, "Cashier is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				res.status(200).json({
					status: 1,
					cashier: cashier,
				});
			}
		}
	);
});

router.post("/merchantCashier/listAllInvoices", jwtTokenAuth, (req, res) => {
	const { group_id } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(err, cashier, "Cashier is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Invoice.find({ group_id }, (err, invoices) => {
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

router.post("/merchantCashier/billNumberSetting", jwtTokenAuth, (req, res) => {
	const { counter } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(
				err,
				cashier,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantCashierSettings.countDocuments(
					{ cashier_id: cashier._id },
					(err, count) => {
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
						} else if (count == 1) {
							MerchantCashierSettings.findOneAndUpdate(
								{ cashier_id: cashier._id },
								{ counter: counter },
								{ new: true },
								function (err, setting) {
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
									} else if (setting == null) {
										console.log(err);
										res.status(200).json({
											status: 0,
											message: "Setting not found",
											err: err,
										});
									} else {
										res.status(200).json({
											status: 1,
											message: "Counter Edited",
										});
									}
								}
							);
						} else {
							const data = new MerchantCashierSettings();
							data.cashier_id = cashier._id;
							data.counter = counter;
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
									res.status(200).json({
										status: 1,
										message: "Counter Created",
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

router.post("/merchantCashier/getCustomerForMobile", jwtTokenAuth, function (
	req,
	res
) {
	const { mobile } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(err, cashier, "Merchant Cashier is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Customer.findOne(
					{ merchant_id: cashier.merchant_id, mobile: mobile },
					(err, customer) => {
						let result = errorMessage(err, customer, "Customer not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							res.status(200).json({
								status: 1,
								customer: customer,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchantCashier/getCustomerForCode", jwtTokenAuth, function (
	req,
	res
) {
	const { customer_code } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(err, cashier, "Merchant Cashier is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Customer.findOne(
					{ merchant_id: cashier.merchant_id, customer_code: customer_code },
					(err, customer) => {
						let result = errorMessage(err, customer, "Customer not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							res.status(200).json({
								status: 1,
								customer: customer,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchantCashier/createCustomer", jwtTokenAuth, (req, res) => {
	const {
		customer_code,
		name,
		last_name,
		mobile,
		email,
		address,
		city,
		state,
		country,
		id_type,
		id_name,
		valid_till,
		id_number,
		dob,
		gender,
		docs_hash,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne({ username: jwtusername, status: 1 }, function (
		err,
		cashier
	) {
		let result = errorMessage(
			err,
			cashier,
			"You are either not authorised or not logged in."
		);
		if (result.status == 0) {
			res.status(200).json(result);
		} else {
			Customer.findOne(
				{
					merchant_id: cashier.merchant_id,
					customer_code: customer_code,
				},
				(err, customer) => {
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
					} else if (customer) {
						res.status(200).json({
							status: 0,
							message: "Customer with the same customer code already exist",
						});
					} else {
						var customerDetails = {
							customer_code: customer_code,
							merchant_id: cashier.merchant_id,
							name: name,
							last_name: last_name,
							mobile: mobile,
							email: email,
							address: address,
							city: city,
							state: state,
							country: country,
							id_type: id_type,
							id_name: id_name,
							valid_till: valid_till,
							id_number: id_number,
							dob: dob,
							gender: gender,
							docs_hash: docs_hash,
						};
						Customer.create(customerDetails, (err) => {
							if (err) {
								console.log(err);
								var message = err;
								if (err && err.message) {
									message = err.message;
								}
								res.status(200).json({
									status: 0,
									message: message,
								});
							} else {
								res.status(200).json({
									status: 1,
									message: "created customer successfully",
								});
							}
						});
					}
				}
			);
		}
	});
});

router.post("/merchantCashier/getUserFromMobile", jwtTokenAuth, function (
	req,
	res
) {
	const { mobile } = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(err, cashier, "Merchant is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				User.findOne({ mobile }, "-password", function (err, user) {
					let result = errorMessage(err, user, "User not found");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						res.status(200).json({
							status: 1,
							data: user,
						});
					}
				});
			}
		}
	);
});

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
		function (err, cashier) {
			let result = errorMessage(err, cashier, "Merchant is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
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
		function (err, cashier) {
			let result = errorMessage(err, cashier, "Merchant is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
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
			let result = errorMessage(err, cashier, "Merchant cashier is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Invoice.deleteOne({ _id: invoice_id, is_created: 1 }, (err) => {
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

router.post("/merchantCashier/increaseCounter", jwtTokenAuth, function (
	req,
	res
) {
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(err, cashier, "Merchant cashier is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantCashierSettings.findOneAndUpdate(
					{ cashier_id: cashier._id },
					{ $inc: { counter: 1 } },
					{ new: true },
					function (err, setting) {
						let result = errorMessage(err, setting, "Setting not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							res.status(200).json({
								status: 1,
								message: "Counter Increased",
							});
						}
					}
				);
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
			let result = errorMessage(err, cashier, "Cashier is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				res.status(200).json({
					status: 1,
					message: "Today's Status",
					bills_paid: cashier.bills_paid,
					bills_raised: cashier.bills_raised,
					amount_collected: cashier.amount_collected,
					penalty_collected: cashier.penalty_collected,
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
			let result = errorMessage(err, cashier, "Cashier is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
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
							message: "Invoice Category Created",
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
			let result = errorMessage(err, cashier, "Cashier is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				InvoiceGroup.findOneAndUpdate(
					{ _id: group_id, cashier_id: cashier._id },
					{ code: code, name: name, description: description },
					(err, group) => {
						let result = errorMessage(err, group, "Invoice Group not found");
						if (result.status == 0) {
							res.status(200).json(result);
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
			let result = errorMessage(err, cashier, "Cashier is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
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

router.post("/merchantCashier/getSettings", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(err, cashier, "Merchant staff is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantSettings.findOne(
					{ merchant_id: cashier.merchant_id },
					(err, setting) => {
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
						} else if (!setting) {
							res.status(200).json({
								status: 0,
								message: "Setting Not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								setting: setting,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchantCashier/getCashierSettings", jwtTokenAuth, function (
	req,
	res
) {
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(err, cashier, "Merchant staff is not valid");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				MerchantCashierSettings.findOne(
					{ cashier_id: cashier._id },
					(err, setting) => {
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
						} else if (!setting) {
							const data = new MerchantCashierSettings();
							data.cashier_id = cashier._id;
							data.save((err, setting) => {
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
										setting: setting,
									});
								}
							});
						} else {
							res.status(200).json({
								status: 1,
								setting: setting,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchantCashier/createInvoice", jwtTokenAuth, (req, res) => {
	var {
		group_id,
		number,
		name,
		last_name,
		address,
		amount,
		bill_date,
		bill_period,
		due_date,
		description,
		mobile,
		ccode,
		items,
		paid,
		is_validated,
		customer_code,
		is_counter,
		reference_invoice,
		term,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		(err, cashier) => {
			let result = errorMessage(err, cashier, "Cashier is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				InvoiceGroup.findOne(
					{ _id: group_id, cashier_id: cashier._id },
					async (err, group) => {
						let result = errorMessage(err, group, "Group not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							try {
								if (is_counter) {
									var referenceFound = await Invoice.findOne({
										number: reference_invoice,
										merchant_id: cashier.merchant_id,
									});
									if (!referenceFound) {
										throw new Error("Referenced Invoice not found");
									}
								}
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
								var invoiceObj = new Invoice();
								invoiceObj.number = number;
								invoiceObj.name = name;
								invoiceObj.last_name = last_name;
								invoiceObj.address = address;
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
								invoiceObj.is_created = 1;
								invoiceObj.is_validated = is_validated;
								invoiceObj.items = updatedItems;
								invoiceObj.customer_code = customer_code;
								invoiceObj.is_counter = is_counter;
								invoiceObj.reference_invoice = reference_invoice;
								invoiceObj.term = term;
								await invoiceObj.save();

								if (is_counter) {
									await Invoice.updateOne(
										{
											_id: referenceFound._id,
										},
										{ has_counter_invoice: true }
									);
								}
								var branch = await MerchantBranch.findOneAndUpdate(
									{ _id: cashier.branch_id },
									{ $inc: { bills_raised: 1, amount_due: amount } }
								);
								if (branch == null) {
									throw new Error("Can not update the MerchantBranch status.");
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
									throw new Error("Can not update the Invoice Group status.");
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
										"Can not update the Merchant Cashier status."
									);
								}
								res.status(200).json({
									status: 1,
									message: "Invoice created",
								});
							} catch (err) {
								console.log(err);
								var message = err;
								if (err && err.message) {
									message = err.message;
								}
								res.status(200).json({
									status: 0,
									message: message,
								});
							}
						}
					}
				);
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
			let result = errorMessage(err, cashier, "Cashier is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				InvoiceGroup.findOne(
					{ _id: group_id, cashier_id: cashier._id },
					async (err, group) => {
						let result = errorMessage(err, group, "Group not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							let failed = [];
							for (invoice of invoices) {
								try {
									var {
										number,
										name,
										last_name,
										address,
										amount,
										bill_date,
										bill_period,
										due_date,
										description,
										mobile,
										ccode,
										items,
										paid,
										customer_code,
										is_counter,
										reference_invoice,
										term,
									} = invoice;
									if (is_counter) {
										var referenceFound = await Invoice.findOne({
											number: reference_invoice,
											merchant_id: cashier.merchant_id,
										});
										if (!referenceFound) {
											throw new Error("Referenced Invoice not found");
										}
									}
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
									invoiceFound = await Invoice.findOne({
										number,
										merchant_id: cashier.merchant_id,
										paid: 0,
									});
									if (invoiceFound && invoiceFound.is_created == 0) {
										await Invoice.updateOne(
											{ _id: invoiceFound._id },
											{
												name,
												last_name,
												address,
												amount,
												bill_date,
												bill_period,
												due_date,
												description,
												mobile,
												ccode,
												group_id: group_id,
												cashier_id: cashier._id,
												items: updatedItems,
												paid,
												customer_code,
												is_counter,
												reference_invoice,
												term,
											}
										);
										if (is_counter) {
											await Invoice.updateOne(
												{
													_id: referenceFound._id,
												},
												{ has_counter_invoice: true }
											);
										}
									} else if (invoiceFound && invoiceFound.is_created == 1) {
										throw new Error(
											"This Invoice number is in created state, so can not upload"
										);
									} else {
										var invoiceObj = new Invoice();
										invoiceObj.number = number;
										invoiceObj.name = name;
										invoiceObj.last_name = last_name;
										invoiceObj.address = address;
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
										invoiceObj.is_created = 0;
										invoiceObj.is_validated = 1;
										invoiceObj.customer_code = customer_code;
										invoiceObj.is_counter = is_counter;
										invoiceObj.reference_invoice = reference_invoice;
										invoiceObj.term = term;
										await invoiceObj.save();

										if (is_counter) {
											await Invoice.updateOne(
												{
													_id: referenceFound._id,
												},
												{ has_counter_invoice: true }
											);
										}

										var branch = await MerchantBranch.findOneAndUpdate(
											{ _id: cashier.branch_id },
											{ $inc: { bills_raised: 1, amount_due: amount } }
										);
										if (branch == null) {
											throw new Error(
												"Can not update the Merchant Branch status."
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
												"Can not update the Invoice Group status."
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
												"Can not update the Merchant Cashier status."
											);
										}
									}
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
							}
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
		invoice_id,
		group_id,
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
		is_validated,
		term,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	MerchantCashier.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, cashier) {
			let result = errorMessage(err, cashier, "Cashier is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				InvoiceGroup.findOne(
					{ _id: group_id, cashier_id: cashier._id },
					async (err, group) => {
						let result = errorMessage(err, group, "Group not found");
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							var updatedItems = [];
							try {
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

								Invoice.findOneAndUpdate(
									{
										_id: invoice_id,
										cashier_id: cashier._id,
										paid: 0,
										is_validated: 0,
										is_created: 1,
									},
									{
										group_id,
										number,
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
										is_validated,
										term,
									},
									(err, invoice) => {
										let result = errorMessage(
											err,
											invoice,
											"Invoice might already be paid or validated. Or Does not belong to this group."
										);
										if (result.status == 0) {
											res.status(200).json(result);
										} else {
											var biasAmount = amount - invoice.amount;
											MerchantBranch.findOneAndUpdate(
												{ _id: cashier.branch_id, status: 1 },
												{ $inc: { amount_due: biasAmount } },
												(err, branch) => {
													let result = errorMessage(
														err,
														branch,
														"Branch is blocked"
													);
													if (result.status == 0) {
														res.status(200).json(result);
													} else {
														Merchant.findOneAndUpdate(
															{ _id: branch.merchant_id },
															{
																$inc: {
																	amount_due: biasAmount,
																},
															},
															(err, merchant) => {
																let result = errorMessage(
																	err,
																	merchant,
																	"Merchant is not valid"
																);
																if (result.status == 0) {
																	res.status(200).json(result);
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
							} catch (err) {
								console.log(err);
								var message = err;
								if (err && err.message) {
									message = err.message;
								}
								res.status(200).json({
									status: 0,
									message: message,
								});
							}
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
			let result = errorMessage(err, cashier, "Cashier is blocked");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				if (cashier.counter_invoice_access) {
					Invoice.find(
						{ merchant_id: cashier.merchant_id },
						(err, invoices) => {
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
						}
					);
				} else {
					Invoice.find(
						{ cashier_id: cashier._id, group_id },
						(err, invoices) => {
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
						}
					);
				}
			}
		}
	);
});

module.exports = router;
