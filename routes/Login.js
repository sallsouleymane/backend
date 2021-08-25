const express = require("express");
const router = express.Router();

//utils
const jwtsign = require("./utils/jwtsign");
const { errorMessage, catchError } = require("./utils/errorHandler");

const Infra = require("../models/Infra");
const User = require("../models/User");
const Merchant = require("../models/merchant/Merchant");
const MerchantBranch = require("../models/merchant/MerchantBranch");
const MerchantStaff = require("../models/merchant/Staff");
const MerchantPosition = require("../models/merchant/Position");
const Bank = require("../models/Bank");
const Profile = require("../models/Profile");
const Branch = require("../models/Branch");
const BankUser = require("../models/BankUser");
const Cashier = require("../models/Cashier");
const Partner = require("../models/partner/Partner");
const PartnerBranch = require("../models/partner/Branch");
const PartnerCashier = require("../models/partner/Cashier");
const PartnerUser = require("../models/partner/User");

router.post("/partnerCashier/login", function (req, res) {
	const { username, password } = req.body;
	PartnerUser.findOne(
		{
			username,
			password,
		},
		function (err, user) {
			var result = errorMessage(err, user, "Incorrect username or password");
			if (result.status == 0) {
				res.status(200).json(result);
			} else if (user.status == -1) {
				res.status(200).json({
					status: 0,
					message: "Your account has been blocked, pls contact the admin!",
				});
			} else {
				PartnerCashier.findOneAndUpdate(
					{
						partner_user_id: user._id,
					},
					{ $set: { username: user.username } },
					function (err1, cashier) {
						var result1 = errorMessage(
							err1,
							cashier,
							"This user is not assigned as a cashier."
						);
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else {
							PartnerBranch.findById(cashier.branch_id, function (err2, branch) {
								var result2 = errorMessage(
									err2,
									branch,
									"Branch Not found."
								);
								if (result2.status == 0) {
									res.status(200).json(result2);
								} else {
									Partner.findById(cashier.partner_id, function (err3, partner) {
										var result3 = errorMessage(
											err3,
											partner,
											"Partner not found."
										);
										if (result3.status == 0) {
											res.status(200).json(result3);
										} else {
											Bank.findById(cashier.bank_id, function (err4, bank) {
												var result4 = errorMessage(
													err4,
													bank,
													"Bank not found."
												);
												if (result4.status == 0) {
													res.status(200).json(result4);
												} else {

													let sign_creds = { username: username, type: "cashier" };
													const token = jwtsign(sign_creds);
													res.status(200).json({
														token: token,
														name: cashier.name,
														verify_user_access: user.verify_user_access,
														username: user.username,
														status: cashier.status,
														email: user.email,
														mobile: user.mobile,
														cashier_id: cashier._id,
														bank_id: cashier.bank_id,
														branch_id: cashier.branch_id,
														bank_name: bank.name,
														bank_logo: bank.logo,
														partner_name:partner.name,
														branch_name:branch.name,
														max_trans_amt:cashier.per_trans_amt,
														id: user._id,
													});
												}
											});
										}	
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


router.post("/partnerBranch/login", function (req, res) {
	const { username, password } = req.body;
	PartnerBranch.findOne(
		{
			username,
			password,
		},
		function (err, branch) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!branch || branch == null || branch == undefined){
				PartnerUser.findOne(
					{ username, password, role: "branchAdmin" },
					"-password",
					function (err1, admin) {
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
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Partner.findOne({ _id: admin.partner_id }, (err2, adminpartner) => {
								var result2 = errorMessage(err2, adminpartner, "Partner is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								} else if (adminpartner.status == -1) {
									res.status(200).json({
										status: 0,
										message: "Your account has been blocked, pls contact the admin!",
									});	
								} else {
									PartnerBranch.findOne({ _id: admin.branch_id }, (err3, adminbranch) => {
										var result3 = errorMessage(err3, adminbranch, "Branch is blocked");
										if (result3.status == 0) {
											res.status(200).json(result3);
										} else {
											Bank.findOne(
												{
													_id: adminpartner.bank_id,
												},(err4, bank) => {
													var result4 = errorMessage(
														err4,
														bank,
														"No bank is assigned to the partner"
													);
													if (result4.status == 0) {
														res.status(200).json(
															result4
														);
													} else {
														let sign_creds = { username: username, type: "partnerUser" };
														const token = jwtsign(sign_creds);
														res.status(200).json({
															token: token,
															name: adminbranch.name,
															initial_setup: adminbranch.initial_setup,
															username: adminbranch.username,
															status: adminbranch.status,
															email: adminbranch.email,
															mobile: adminbranch.mobile,
															partner_name: adminpartner.name,
															logo: adminpartner.logo,
															bank_name: bank.name,
															bank_logo: bank.logo,
															id: adminbranch._id,
															partner_id: adminpartner._id,
															credit_limit: adminbranch.credit_limit,
															admin:true,
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
			} else {
				Partner.findOne(
					{
						_id: branch.partner_id,
					},
					function (err5, partner) {
						if (err5) {
							res.status(200).json(catchError(err5));
						} else {
							Bank.findById(partner.bank_id, function (err6, bank) {
								var result6 = errorMessage(
									err6,
									bank,
									"Bank not found."
								);
								if (result6.status == 0) {
									res.status(200).json(result6);
								} else {
									let logo = partner.logo;
									let sign_creds = { username: username, type: "partnerBranch" };
									const token = jwtsign(sign_creds);

									res.status(200).json({
										token: token,
										name: branch.name,
										initial_setup: branch.initial_setup,
										username: branch.username,
										status: branch.status,
										email: branch.email,
										mobile: branch.mobile,
										partner_name: partner.name,
										logo: logo,
										bank_name: bank.name,
										bank_logo: bank.logo,
										id: branch._id,
										partner_id: partner._id,
										credit_limit: branch.credit_limit,
										admin:false,
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

router.post("/partner/login", function (req, res) {
	const { username, password } = req.body;
	Partner.findOne(
		{
			username,
			password,
		},
		function (err, partner) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!partner || partner == null || partner == undefined){
				PartnerUser.findOne(
					{ username, password, role: "partnerAdmin" },
					"-password",
					function (err1, admin) {
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
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Partner.findOne({ _id: admin.partner_id }, (err2, adminpartner) => {
								var result2 = errorMessage(err2, adminpartner, "Partner is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								} else if (adminpartner.status == -1) {
									res.status(200).json({
										status: 0,
										message: "Your account has been blocked, pls contact the admin!",
									});	
								} else {
									Bank.findOne(
										{
											_id: adminpartner.bank_id,
										},(err3, bank) => {
											var result3 = errorMessage(
												err3,
												bank,
												"No bank is assigned to the partner"
											);
											if (result3.status == 0) {
												res.status(200).json(
													result3
												);
											} else {
												let sign_creds = { username: username, type: "partnerUser" };
												const token = jwtsign(sign_creds);
												res.status(200).json({
													token: token,
													name: adminpartner.name,
													verify_user_access: adminpartner.verify_user_access,
													initial_setup: adminpartner.initial_setup,
													username: adminpartner.username,
													mobile: adminpartner.mobile,
													status: adminpartner.status,
													bank_name: bank.name,
													bank_logo: bank.logo,
													contract: adminpartner.contract,
													logo: adminpartner.logo,
													id: adminpartner._id,
													admin: true,
												});
											}
										}
									);
								}
							});
						}	
					}
				);
			
			} else if (partner.status == -1) {
				res.status(200).json({
					status: 0,
					message: "Your account has been blocked, pls contact the admin!",
				});	
			} else {
				Bank.findById(partner.bank_id, function (err4, bank) {
					var result4 = errorMessage(
						err4,
						bank,
						"Bank not found."
					);
					if (result4.status == 0) {
						res.status(200).json(result4);
					} else {
						let sign_creds = { username: username, type: "partner" };
						const token = jwtsign(sign_creds);

						res.status(200).json({
							token: token,
							name: partner.name,
							verify_user_access: partner.verify_user_access,
							initial_setup: partner.initial_setup,
							username: partner.username,
							mobile: partner.mobile,
							status: partner.status,
							bank_name: bank.name,
							bank_logo: bank.logo,
							contract: partner.contract,
							logo: partner.logo,
							id: partner._id,
							admin: false,
						});
					}
				});
			}
		}
	);
});

router.post("/merchantBranch/login", (req, res) => {
	const { username, password } = req.body;
	MerchantBranch.findOne(
		{ username, password, status: { $ne: 2 } },
		"-password",
		function (err, branch) {
			var result = errorMessage(
				err,
				branch,
				"User account not found or blocked."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Merchant.findOne({ _id: branch.merchant_id }, (err1, merchant) => {
					var result1 = errorMessage(err1, merchant, "Merchant is blocked");
					if (result1.status == 0) {
						res.status(200).json(result1);
					} else {
						Bank.findOne(
							{
								_id: merchant.bank_id,
							},(err2, bank) => {
								var result2 = errorMessage(
									err2,
									bank,
									"No bank is assigned to the merchant"
								);
								if (result2.status == 0) {
									res.status(200).json(result2);
								} else {
									let sign_creds = { username: username, type: "merchantBranch" };
									const token = jwtsign(sign_creds);
									res.status(200).json({
									status: 1,
									details: branch,
									merchant: merchant,
									bank: bank,
									token: token,
									});
								}
							}
						);
					}
				});
			}
		}
	);
});

router.post("/merchantStaff/login", (req, res) => {
	const { username, password } = req.body;
	MerchantStaff.findOne(
		{ username, password, status: { $ne: 2 } },
		"-password",
		function (err, staff) {
			var result = errorMessage(
				err,
				staff,
				"User account not found or blocked."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				Merchant.findOne({ _id: staff.merchant_id }, (err1, merchant) => {
					var result1 = errorMessage(err1, merchant, "Merchant is blocked");
					if (result1.status == 0) {
						res.status(200).json(result1);
					} else {
						MerchantBranch.findOne(
							{ _id: staff.branch_id, status: 1 },
							(err2, branch) => {
								var result2 = errorMessage(err2, branch, "Branch is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								} else {
									MerchantPosition.findOne(
										{ staff_id: staff._id, status: 1, type: staff.role },
										(err3, position) => {
											var result3 = errorMessage(
												err3,
												position,
												"No active position is assigned to the staff"
											);
											if (result3.status == 0) {
												res.status(200).json(result3);
											} else {
												Bank.findOne(
													{
														_id: merchant.bank_id,
													},(err4, bank) => {
														var result4 = errorMessage(
															err4,
															bank,
															"No bank is assigned to the merchant"
														);
														if (result4.status == 0) {
															res.status(200).json(result4);
														} else {
															let sign_creds = {
																username: username,
																type: "merchantCashier",
															};
															const token = jwtsign(sign_creds);
															res.status(200).json({
																status: 1,
																token: token,
																position: position,
																staff: staff,
																branch: branch,
																merchant: merchant,
																bank:bank,
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
				});
			}
		}
	);
});

router.post("/merchant/login", (req, res) => {
	const { username, password } = req.body;
	Merchant.findOne(
		{ username, password },
		"-password",
		function (err, merchant) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!merchant || merchant == null || merchant == undefined){
				MerchantStaff.findOne(
					{ username, password, role: "admin" },
					"-password",
					function (err1, admin) {
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
						}else if (!admin || admin==null || admin == undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err2, adminmerchant) => {
								var result2 = errorMessage(err2, adminmerchant, "Merchant is blocked");
								if (result2.status == 0) {
									res.status(200).json(result2);
								} else {
									Bank.findOne(
										{
											_id: adminmerchant.bank_id,
										},(err3, bank) => {
											var result3 = errorMessage(
												err3,
												bank,
												"No bank is assigned to the merchant"
											);
											if (result3.status == 0) {
												res.status(200).json(
													result3
												);
											} else {
												let sign_creds = { username: username, type: "merchantStaff" };
												const token = jwtsign(sign_creds);
												res.status(200).json({
													status: 1,
													adminuser: admin,
													details: adminmerchant,
													bank:bank,
													token: token,
													admin: true,
												});
											}
										}
									);
								}
							});
						}	
					}
				);	
			
			
			
			
			
			
			} else {
				Bank.findOne(
					{
						_id: merchant.bank_id,
					},(err4, bank) => {
						var result4 = errorMessage(
							err4,
							bank,
							"No bank is assigned to the merchant"
						);
						if (result4.status == 0) {
							res.status(200).json({
								result:result4,
								merchant:merchant,
							});
						} else {
							let sign_creds = { username: username, type: "merchant" };
							const token = jwtsign(sign_creds);
							res.status(200).json({
								status: 1,
								details: merchant,
								bank:bank,
								token: token,
								admin: false,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/login", function (req, res) {
	const { username, password } = req.body;
	Infra.findOne(
		{
			username: { $regex: new RegExp(username, "i") },
			password,
		},
		function (err, user) {
			var result = errorMessage(err, user, "Incorrect username or password");
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				let sign_creds = { username: username, type: "infra" };
				const token = jwtsign(sign_creds);

				if (user.profile_id && user.profile_id !== "") {
					Profile.findOne(
						{
							_id: user.profile_id,
						},
						function (err1, profile) {
							res.status(200).json({
								token: token,
								permissions: profile.permissions,
								name: user.name,
								isAdmin: user.isAdmin,
								initial_setup: user.initial_setup,
							});
						}
					);
				} else {
					if (user.isAdmin) {
						res.status(200).json({
							token: token,
							permissions: "all",
							name: user.name,
							isAdmin: user.isAdmin,
							initial_setup: user.initial_setup,
						});
					} else {
						res.status(200).json({
							token: token,
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

router.post("/bankLogin", function (req, res) {
	const { username, password } = req.body;
	Bank.findOne(
		{
			username,
			password,
		},
		function (err, bank) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!bank || bank == null || bank == undefined){
				BankUser.findOne(
					{ username, password, role: "bankAdmin" },
					"-password",
					function (err1, admin) {
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
										theme: adminbank.theme,
										admin: true,
									});
											
								}
							});
						}	
					}
				);
			
			} else if (bank.status == -1) {
				res.status(200).json({
					status: 0,
					message: "Your account has been blocked, pls contact the admin!",
				});
			} else {
				let sign_creds = { username: username, type: "bank" };
				const token = jwtsign(sign_creds);

				res.status(200).json({
					token: token,
					name: bank.name,
					initial_setup: bank.initial_setup,
					username: bank.username,
					mobile: bank.mobile,
					status: bank.status,
					theme: bank.theme,
					contract: bank.contract,
					logo: bank.logo,
					id: bank._id,
					admin: false,
				});
			}
		}
	);
});

router.post("/branchLogin", function (req, res) {
	const { username, password } = req.body;
	Branch.findOne(
		{
			username,
			password,
		},
		function (err, branch) {
			if (err) {
				var message = err;
				if (err.message) {
					message = err.message;
				}
				res.status(200).json({
					status: 0,
					message: message,
				});
			}else if (!branch || branch == null || branch == undefined){
				BankUser.findOne(
					{ username, password, role: "branchAdmin" },
					"-password",
					function (err1, admin) {
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
									Branch.findOne({ _id: admin.branch_id }, (err3, adminbranch) => {
										var result3 = errorMessage(err3, adminbranch, "Bank is blocked");
										if (result3.status == 0) {
											res.status(200).json(result3);
										} else if (adminbranch.status == -1) {
											res.status(200).json({
												status: 0,
												message: "Your account has been blocked, pls contact the admin!",
											});	
										} else {
											let sign_creds = { username: username, type: "bankUser" };
											const token = jwtsign(sign_creds);
											res.status(200).json({
												token: token,
												name: adminbranch.name,
												initial_setup: adminbranch.initial_setup,
												username: adminbranch.username,
												status: adminbranch.status,
												email: adminbranch.email,
												bank_name: adminbank.name,
												theme: adminbank.theme,
												mobile: adminbranch.mobile,
												logo: adminbank.logo,
												bank_id: adminbank._id,
												id: adminbranch._id,
												credit_limit: adminbranch.credit_limit,
												admin: true,
											});

										}
									});	
								}
							});
						}	
					}
				);
			
			} else if (branch.status == -1) {
				res.status(200).json({
					status: 0,
					message: "Your account has been blocked, pls contact the admin!",
				});
			} else {
				Bank.findOne(
					{
						_id: branch.bank_id,
					},
					function (err4, ba) {
						var result4 = errorMessage(err4, ba, "Bank not found");
						if (result4.status == 0) {
							res.status(200).json(result4);
						} else {
							let logo = ba.logo;
							let sign_creds = { username: username, type: "branch" };
							const token = jwtsign(sign_creds);

							res.status(200).json({
								token: token,
								name: branch.name,
								initial_setup: branch.initial_setup,
								username: branch.username,
								status: branch.status,
								email: branch.email,
								bank_name: ba.name,
								mobile: branch.mobile,
								logo: logo,
								theme: ba.theme,
								bank_id: ba._id,
								id: branch._id,
								credit_limit: branch.credit_limit,
								admin: false,
							});
						}
					}
				);
			}
		}
	);
});

router.post("/cashierLogin", function (req, res) {
	const { username, password } = req.body;
	BankUser.findOne(
		{
			username,
			password,
		},
		function (err, bank) {
			var result = errorMessage(err, bank, "Incorrect username or password");
			if (result.status == 0) {
				res.status(200).json(result);
			} else if (bank.status == -1 || bank.status == '-1') {
				res.status(200).json({
					status: 0,
					message: "Your account has been blocked, pls contact the admin!",
				});
			} else {
				Cashier.findOneAndUpdate(
					{
						bank_user_id: bank._id,
					},
					{ $set: { username: bank.username } },
					function (err1, cashier) {
						var result1 = errorMessage(
							err1,
							cashier,
							"This user is not assigned as a cashier."
						);
						if (result1.status == 0) {
							res.status(200).json(result1);
						} else if (cashier.status == -1 || cashier.status == '-1') {
							res.status(200).json({
								status: 0,
								message: "Your account has been blocked, pls contact the admin!",
							});
						} else {
							Branch.findById(cashier.branch_id, function (err2, branch) {
								var result2 = errorMessage(
									err2,
									branch,
									"Branch not found."
								);
								if (result2.status == 0) {
									res.status(200).json(result2);
								} else {
									Bank.findById(cashier.bank_id, function (err3, bank1) {
										var result3= errorMessage(
											err3,
											bank1,
											"Bank not found."
										);
										if (result3.status == 0) {
											res.status(200).json(result3);
										} else {
											let sign_creds = { username: username, type: "cashier" };
											const token = jwtsign(sign_creds);
											res.status(200).json({
												token: token,
												name: cashier.name,
												username: bank1.username,
												status: cashier.status,
												email: bank1.email,
												mobile: bank1.mobile,
												cashier_id: cashier._id,
												bank_id: cashier.bank_id,
												branch_id: cashier.branch_id,
												bank_name: bank1.name,
												branch_name: branch.name,
												id: bank1._id,
												max_trans_amt: cashier.per_trans_amt,
											});
										}	
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

router.post("/user/login", (req, res) => {
	const { username, password } = req.body;
	User.findOne({ username, password }, "-password", function (err, user) {
		var result = errorMessage(
			err,
			user,
			"Username or pass word entered is incorrect"
		);
		if (result.status == 0) {
			res.status(200).json(result);
		} else {
			Bank.findById(user.bank_id, (err1, bank) => {
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
					let sign_creds = { username: username, type: "user" };
					const token = jwtsign(sign_creds);
					res.status(200).json({
						status: 1,
						bank: bank,
						user: user,
						token: token,
					});
				}
			});
		}
	});
});

module.exports = router;
