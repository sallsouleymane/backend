const express = require("express");
const router = express.Router();

const config = require("../config.json");
const jwtTokenAuth = require("./JWTTokenAuth");

//utils
const sendSMS = require("./utils/sendSMS");
const sendMail = require("./utils/sendMail");
const makeid = require("./utils/idGenerator");
const makeotp = require("./utils/makeotp");
const blockchain = require("../services/Blockchain");

//models
const Bank = require("../models/Bank");
const Merchant = require("../models/merchant/Merchant");
const MerchantBranch = require("../models/merchant/MerchantBranch");
const MerchantStaff = require("../models/merchant/MerchantStaff");
const MerchantCashier = require("../models/merchant/MerchantCashier");
const Zone = require("../models/merchant/Zone");
const Subzone = require("../models/merchant/Subzone");
const InvoiceGroup = require("../models/merchant/InvoiceGroup");
const FailedTX = require("../models/FailedTXLedger");
const Offering = require("../models/merchant/Offering");
const Tax = require("../models/merchant/Tax");
const MerchantSettings = require("../models/merchant/MerchantSettings");

router.post("/merchant/zoneSetting", jwtTokenAuth, (req, res) => {
	const { zone_name, subzone_name } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				MerchantSettings.countDocuments({ merchant_id: merchant._id }, (err, count) => {
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
						MerchantSettings.findOneAndUpdate(
							{ merchant_id: merchant._id },
							{ zone_name: zone_name, subzone_name:subzone_name },
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
										message: "Zone Settings Edited",
									});
								}
							}
						);
					} else {
						const data = new MerchantSettings();
						data.merchant_id = merchant._id;
						data.zone_name = zone_name;
						data.subzone_name = subzone_name;
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
									message: "Zone Settings Created",
								});
							}
						});
					}
				});
			}
		}
	);
});

router.post("/merchant/addBillPeriod", jwtTokenAuth, (req, res) => {
	const billperiod  = { 
		start_date: req.body.start_date,
		end_date: req.body.end_date,
		period_name: req.body.period_name,
	}
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				MerchantSettings.countDocuments({ merchant_id: merchant._id }, (err, count) => {
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
						MerchantSettings.update(
							{ merchant_id: merchant._id }, 
							{ $push: { bill_period: billperiod } },
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
										message: "Bill Period Added",
									});
								}
							}
						);
					} else {
						const data = new MerchantSettings();
						data.merchant_id = merchant._id;
						data.bill_period = [billperiod];
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
									message: "Bill Periad Added",
								});
							}
						});
					}
				});
			}
		}
	);
});

router.post("/merchant/addBillTerm", jwtTokenAuth, (req, res) => {
	const billterm= { 
		days: req.body.days,
		name: req.body.name
	}
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				MerchantSettings.countDocuments({ merchant_id: merchant._id }, (err, count) => {
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
						MerchantSettings.update(
							{ merchant_id: merchant._id }, 
							{ $push: { bill_term: billterm } },
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
										message: "Bill Term Added",
									});
								}
							}
						);
					} else {
						const data = new MerchantSettings();
						data.merchant_id = merchant._id;
						data.bill_term = [billterm];
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
									message: "Bill Term Added",
								});
							}
						});
					}
				});
			}
		}
	);
});

router.post("/merchant/getSettings", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message: "Merchant is not valid",
				});
			} else {
				MerchantSettings.findOne({ merchant_id: merchant._id }, (err, setting) => {
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
				});
			}
		}
	);
});

router.post("/merchant/listTaxes", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message: "Merchant is not valid",
				});
			} else {
				Tax.find({ merchant_id: merchant._id }, (err, taxes) => {
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

router.post("/merchant/deleteTax", jwtTokenAuth, function (req, res) {
	const { tax_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message: "Merchant is not valid",
				});
			} else {
				Tax.deleteOne({ _id: tax_id }, (err) => {
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
							message: "Tax deleted",
						});
					}
				});
			}
		}
	);
});

router.post("/merchant/editTax", jwtTokenAuth, function (req, res) {
	const { tax_id, code, name, value } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message: "Merchant is not valid",
				});
			} else {
				Tax.findOneAndUpdate(
					{ _id: tax_id },
					{ code, name, value },
					{ new: true },
					(err, tax) => {
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
						} else if (tax == null) {
							res.status(200).json({
								status: 0,
								message: "Tax not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								message: "Tax edited successfully",
								tax: tax,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/createTax", jwtTokenAuth, function (req, res) {
	const { code, name, value } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message: "Merchant is not valid",
				});
			} else {
				Tax.findOne(
					{
						code,
						merchant_id: merchant._id,
					},
					(err, tax) => {
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
						} else if (tax) {
							res.status(200).json({
								status: 0,
								message: "Tax with this code already exist",
							});
						} else {
							const tax = new Tax();
							tax.merchant_id = merchant._id;
							tax.code = code;
							tax.name = name;
							tax.value = value;
							tax.save((err) => {
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
										message: "Tax Created",
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

router.post("/merchant/deleteOffering", jwtTokenAuth, function (req, res) {
	const { offering_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message: "Merchant is not valid",
				});
			} else {
				Offering.deleteOne({ _id: offering_id }, (err) => {
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
							message: "Offering deleted",
						});
					}
				});
			}
		}
	);
});

router.post("/merchant/editOffering", jwtTokenAuth, (req, res) => {
	const {
		offering_id,
		code,
		name,
		description,
		denomination,
		unit_of_measure,
		unit_price,
		type,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Offering.findOneAndUpdate(
					{ _id: offering_id, merchant_id: merchant._id },
					{
						code,
						name,
						description,
						denomination,
						unit_of_measure,
						unit_price,
						type,
					},
					{ new: true },
					(err, offering) => {
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
						} else if (offering == null) {
							res.status(200).json({
								status: 0,
								message: "Offering not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								message: "Offering edited successfully",
								offering: offering,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/listOfferings", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message: "Merchant is not valid",
				});
			} else {
				Offering.find({ merchant_id: merchant._id }, (err, offerings) => {
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
				});
			}
		}
	);
});

router.post("/merchant/uploadOfferings", jwtTokenAuth, function (req, res) {
	const { offerings } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		async function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message: "Merchant is not valid",
				});
			} else {
				let failed = [];
				for (offering of offerings) {
					try {
						var {
							code,
							name,
							description,
							denomination,
							unit_of_measure,
							unit_price,
							type,
						} = offering;
						var offeringFound = await Offering.findOne({
							code,
							merchant_id: merchant._id,
						});
						if (offeringFound) {
							throw new Error("Offering with this code already exist");
						} else {
							var offeringObj = new Offering();
							offeringObj.merchant_id = merchant._id;
							offeringObj.code = code;
							offeringObj.name = name;
							offeringObj.description = description;
							offeringObj.denomination = denomination;
							offeringObj.unit_of_measure = unit_of_measure;
							offeringObj.unit_price = unit_price;
							offeringObj.type = type;
							await offeringObj.save();
						}
					} catch (err) {
						console.log(err);
						var message = err.toString();
						if (err.message) {
							message = err.message;
						}
						offering.failure_reason = message;
						console.log(failed);
						failed.push(offering);
					}
				}
				res.status(200).json({
					status: 1,
					message: "Offerings uploaded",
					failed: failed,
				});
			}
		}
	);
});

router.get("/merchant/todaysStatus", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				const today = new Date(); // "2020-06-09T18:30:00.772Z"
				Merchant.findOneAndUpdate(
					{
						_id: merchant._id,
						last_paid_at: {
							$lte: new Date(today.setHours(00, 00, 00)),
						},
					},
					{ amount_collected: 0 },
					{ new: true },
					(err, merchant2) => {
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
						} else if (merchant2 != null) {
							merchant = merchant2;
						}
						res.status(200).json({
							status: 1,
							message: "Today's Status",
							todays_payment: merchant.amount_collected,
							last_paid_at: merchant.last_paid_at,
							due: merchant.amount_due,
							bills_paid: merchant.bills_paid,
							bills_raised: merchant.bills_raised,
						});
					}
				);
			}
		}
	);
});

router.get("/merchant/getTransHistory", jwtTokenAuth, function (req, res) {
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Bank.findOne(
					{
						_id: merchant.bank_id,
					},
					function (err, bank) {
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
							const wallet = jwtusername + "_operational@" + bank.name;
							console.log(wallet);
							blockchain.getStatement(wallet).then(function (history) {
								FailedTX.find({ wallet_id: wallet }, (err, failed) => {
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
											history: history,
											failed: failed,
										});
									}
								});
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/editDetails", jwtTokenAuth, function (req, res) {
	var { username, name, logo, description, document_hash, email } = req.body;
	const jwtusername = req.sign_creds.username;
	console.log(jwtusername);
	Merchant.findOneAndUpdate(
		{
			username: jwtusername,
			status: 1,
		},
		{
			username: username,
			name: name,
			logo: logo,
			description: description,
			document_hash: document_hash,
			email: email,
		},
		{ new: true },
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				res.status(200).json({
					status: 1,
					message: "Merchant edited successfully",
					merchant: merchant,
				});
			}
		}
	);
});

router.post("/merchant/editZone", jwtTokenAuth, (req, res) => {
	const { zone_id, code, name, type, description } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Zone.findOneAndUpdate(
					{ _id: zone_id },
					{ code: code, name: name, description: description, type: type },
					(err, zone) => {
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
						} else if (zone == null) {
							res.status(200).json({
								status: 0,
								message: "Zone not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								message: "Zone edited successfully",
							});
						}
					}
				);
			}
		}
	);
});

router.get("/merchant/getZoneList", jwtTokenAuth, (req, res) => {
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Zone.find({ merchant_id: merchant._id }, (err, zones) => {
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
							zones: zones,
						});
					}
				});
			}
		}
	);
});

router.post("/merchant/createZone", jwtTokenAuth, (req, res) => {
	let data = new Zone();
	const { code, name, description, type } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				data.code = code;
				data.name = name;
				data.description = description;
				data.merchant_id = merchant._id;
				data.type =  type;
				data.save((err, zone) => {
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
						return res
							.status(200)
							.json({ status: 1, message: "Zone Created", zones: zone });
					}
				});
			}
		}
	);
});

router.post("/merchant/createSubzone", jwtTokenAuth, (req, res) => {
	let data = new Subzone();
	const { code, name, description, type, zone_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				data.code = code;
				data.name = name;
				data.description = description;
				data.merchant_id = merchant._id;
				data.type = type;
				data.zone_id = zone_id,
				data.branch_count = 0,
				data.save((err, subzone) => {
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
						return res
							.status(200)
							.json({ status: 1, message: "Subzone Created", subzone: subzone });
					}
				});
			}
		}
	);
});

router.post("/merchant/listSubzonesByZoneId", jwtTokenAuth, function (
	req,
	res
) {
	const { zone_id } = req.body;
	const username = req.sign_creds.username;
	Merchant.findOne(
		{
			username,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Subzone.find(
					{ merchant_id: merchant._id, zone_id: zone_id },
					"-password",
					function (err, subzone) {
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
								subzones: subzone,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/editSubzone", jwtTokenAuth, (req, res) => {
	const { subzone_id, code, name, type, description } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Subzone.findOneAndUpdate(
					{ _id: subzone_id },
					{ code: code, name: name, description: description, type: type },
					(err, zone) => {
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
						} else if (zone == null) {
							res.status(200).json({
								status: 0,
								message: "Subzone not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								message: "Subzone edited successfully",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/addCashier", jwtTokenAuth, (req, res) => {
	let data = new MerchantCashier();
	const { name, branch_id, working_from, working_to } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				MerchantBranch.findOne({ _id: branch_id }, function (err, branch) {
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
						return res.json({
							status: 0,
							message: "Invalid branch",
						});
					} else {
						data.name = name;
						data.working_from = working_from;
						data.working_to = working_to;
						data.merchant_id = merchant._id;
						data.branch_id = branch_id;
						data.save((err, cashier) => {
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
								MerchantBranch.updateOne(
									{ _id: branch_id },
									{ $inc: { total_cashiers: 1 } },
									function (err, branch) {
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
											console.log(err);
											return res.json({
												status: 0,
												message: "Branch not found",
												err: err,
											});
										} else {
											let ig = new InvoiceGroup();
											ig.code = "group-" + name;
											ig.name = "default";
											ig.description =
												"Default invoice group for merchant cashier";
											ig.cashier_id = cashier._id;
											ig.save((err, group) => {
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
														data: cashier,
														group: group,
													});
												}
											});
										}
									}
								);
							}
						});
					}
				});
			}
		}
	);
});

router.post("/merchant/editCashier", jwtTokenAuth, (req, res) => {
	const { cashier_id, name, working_from, working_to } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message: "Merchant is not valid",
				});
			} else {
				MerchantCashier.findOneAndUpdate(
					{ _id: cashier_id, merchant_id: merchant._id },
					{
						name: name,
						working_from: working_from,
						working_to: working_to,
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
								message: "Cashier not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								message: "edited merchant cashier successfully",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/listCashier", jwtTokenAuth, (req, res) => {
	const { branch_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message: "Merchant is not vaid",
				});
			} else {
				MerchantCashier.find(
					{ merchant_id: merchant._id, branch_id: branch_id },
					(err, cashiers) => {
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
								cashiers: cashiers,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/addStaff", jwtTokenAuth, (req, res) => {
	let data = new MerchantStaff();
	const jwtusername = req.sign_creds.username;
	const {
		name,
		email,
		ccode,
		mobile,
		username,
		password,
		branch_id,
		logo,
	} = req.body;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
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
			} else if (user == null) {
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				data.name = name;
				data.email = email;
				data.mobile = mobile;
				data.username = username;
				data.password = password;
				data.branch_id = branch_id;
				data.merchant_id = user._id;
				data.ccode = ccode;
				data.logo = logo;

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
							"<p>Your have been added as a Merchant Staff in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
							config.mainIP +
							"/merchant/cashier/" +
							name +
							"'>http://" +
							config.mainIP +
							"/merchant/cashier/" +
							name +
							"</a></p><p><p>Your username: " +
							username +
							"</p><p>Your password: " +
							password +
							"</p>";
						sendMail(content, "Merchant Staff Account Created", email);
						let content2 =
							"Your have been added as Merchant Staff in E-Wallet application Login URL: http://" +
							config.mainIP +
							"/merchant/cashier/" +
							name +
							" Your username: " +
							username +
							" Your password: " +
							password;
						sendSMS(content2, mobile);
						return res.status(200).json({
							status: 1,
							message: "Merchant staff added successfully",
						});
					}
				});
			}
		}
	);
});

router.post("/merchant/editStaff", jwtTokenAuth, (req, res) => {
	const {
		name,
		email,
		ccode,
		mobile,
		username,
		password,
		branch_id,
		logo,
		staff_id,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				MerchantStaff.findOneAndUpdate(
					{
						_id: staff_id,
						merchant_id: merchant._id,
					},
					{
						name: name,
						email: email,
						ccode: ccode,
						mobile: mobile,
						username: username,
						password: password,
						branch_id: branch_id,
						logo: logo,
					},
					(err, staff) => {
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
						} else if (staff == null) {
							res.status(200).json({
								status: 0,
								message: "Staff not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								message: "Staff updated successfully",
							});
						}
					}
				);
			}
		}
	);
});

router.get("/merchant/listStaff", jwtTokenAuth, (req, res) => {
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				MerchantStaff.find(
					{ merchant_id: merchant._id },
					"-password",
					(err, staffs) => {
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
								staffs: staffs,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/blockStaff", jwtTokenAuth, (req, res) => {
	const { staff_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				MerchantStaff.findOneAndUpdate(
					{ _id: staff_id, merchant_id: merchant._id },
					{
						$set: {
							status: 2,
						},
					},
					(err, staff) => {
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
						} else if (staff == null) {
							res.status(200).json({
								status: 0,
								message: "Staff not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								data: "blocked staff",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/unblockStaff", jwtTokenAuth, (req, res) => {
	const { staff_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				MerchantStaff.findOneAndUpdate(
					{ _id: staff_id, merchant_id: merchant._id, status: 2 },
					{
						status: 1,
					},
					(err, staff) => {
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
						} else if (staff == null) {
							res.status(200).json({
								status: 0,
								message: "Staff not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								data: "unblocked staff",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/blockBranch", jwtTokenAuth, (req, res) => {
	const { branch_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				MerchantBranch.findOneAndUpdate(
					{ _id: branch_id, merchant_id: merchant._id },
					{
						status: 2,
					},
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
								message: "Branch not found",
							});
						} else {
							res.status(200).json({
								status: 1,
								data: "blocked branch",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/unblockBranch", jwtTokenAuth, (req, res) => {
	const { branch_id } = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				MerchantBranch.findOneAndUpdate(
					{ _id: branch_id, merchant_id: merchant._id, status: 2 },
					{
						status: 1,
					},
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
								message: "Branch not found/ not blocked",
							});
						} else {
							res.status(200).json({
								status: 1,
								data: "Unblocked branch",
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/createBranch", jwtTokenAuth, (req, res) => {
	let data = new MerchantBranch();
	const {
		name,
		code,
		subzone_id,
		username,
		address1,
		state,
		zip,
		country,
		ccode,
		mobile,
		email,
		working_from,
		working_to,
	} = req.body;

	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		"-password",
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				data.name = name;
				data.code = code;
				data.subzone_id = subzone_id;
				data.username = username;
				data.address1 = address1;
				data.state = state;
				data.country = country;
				data.zip = zip;
				data.ccode = ccode;
				data.mobile = mobile;
				data.email = email;
				data.merchant_id = merchant._id;
				data.password = makeid(10);
				data.working_from = working_from;
				data.working_to = working_to;
				data.status = 0;

				Subzone.countDocuments({ _id: subzone_id }, (err, count) => {
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
						data.save((err, branch) => {
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
								Subzone.updateOne(
									{ _id: subzone_id },
									{ $inc: { branches_count: 1 } },
									function (err, subzone) {
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
										} else if (subzone == null) {
											console.log(err);
											res.status(200).json({
												status: 0,
												message: "Subone not found",
												err: err,
											});
										} else {
											let content =
												"<p>You are added as a branch for merchant " +
												merchant.name +
												" in E-Wallet application</p><p<p>&nbsp;</p<p>Login URL: <a href='http://" +
												config.mainIP +
												"/merchant/branch/" +
												name +
												"'>http://" +
												config.mainIP +
												"/merchant/branch/" +
												name +
												"</a></p><p><p>Your username: " +
												username +
												"</p><p>Your password: " +
												data.password +
												"</p>";
											sendMail(content, "Merchant Branch Created", email);
											let content2 =
												"You are added as a branch for merchant " +
												merchant.name +
												" in E-Wallet application Login URL: http://" +
												config.mainIP +
												"/merchant/branch/" +
												name +
												" Your username: " +
												username +
												" Your password: " +
												data.password;
											sendSMS(content2, mobile);
											res.status(200).json({
												status: 1,
												message: "Branch Created",
												branch: branch,
											});
										}
									}
								);
							}
						});
					} else {
						res.status(200).json({
							status: 0,
							message: "Zone do not exist.",
						});
					}
				});
			}
		}
	);
});

router.post("/merchant/editBranch", jwtTokenAuth, (req, res) => {
	const {
		branch_id,
		name,
		username,
		bcode,
		address1,
		state,
		zip,
		country,
		ccode,
		email,
		working_from,
		working_to,
	} = req.body;
	const jwtusername = req.sign_creds.username;
	Merchant.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				MerchantBranch.findOneAndUpdate(
					{ _id: branch_id, merchant_id: merchant._id },
					{
						name: name,
						username: username,
						address1: address1,
						state: state,
						zip: zip,
						ccode: ccode,
						bcode: bcode,
						country: country,
						email: email,
						working_from: working_from,
						working_to: working_to,
					},
					{ new: true },
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
						} else {
							res.status(200).json({
								status: 1,
								data: branch,
							});
						}
					}
				);
			}
		}
	);
});

router.get("/merchant/listBranches", jwtTokenAuth, function (req, res) {
	const username = req.sign_creds.username;
	Merchant.findOne(
		{
			username,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				MerchantBranch.find(
					{ merchant_id: merchant._id },
					"-password",
					function (err, branch) {
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
								branches: branch,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/merchant/listBranchesBySubzoneId", jwtTokenAuth, function (
	req,
	res
) {
	const { subzone_id } = req.body;
	const username = req.sign_creds.username;
	Merchant.findOne(
		{
			username,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				MerchantBranch.find(
					{ merchant_id: merchant._id, subzone_id: subzone_id },
					"-password",
					function (err, branch) {
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
								branches: branch,
							});
						}
					}
				);
			}
		}
	);
});

router.get("/merchant/getWalletBalance", jwtTokenAuth, (req, res) => {
	const username = req.sign_creds.username;
	Merchant.findOne(
		{
			username,
			status: 1,
		},
		function (err, merchant) {
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
				res.status(200).json({
					status: 0,
					message:
						"Token changed or user not valid. Try to login again or contact system administrator.",
				});
			} else {
				Bank.findOne({ _id: merchant.bank_id }, (err, bank) => {
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
					} else if (bank == null) {
						res.status(200).json({
							status: 0,
							message: "Bank not found",
						});
					} else {
						const wallet_id = merchant.username + "_operational@" + bank.name;
						blockchain.getBalance(wallet_id).then(function (result) {
							res.status(200).json({
								status: 1,
								balance: result,
							});
						});
					}
				});
			}
		}
	);
});

module.exports = router;
