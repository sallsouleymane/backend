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
				let sign_creds = { username: username, type: "partnerCashier" };
				const token = jwtsign(sign_creds);
				PartnerCashier.findOneAndUpdate(
					{
						partner_user_id: user._id,
					},
					{ $set: { username: user.username } },
					function (err, cashier) {
						var result = errorMessage(
							err,
							cashier,
							"This user is not assigned as a cashier."
						);
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							PartnerBranch.findById(cashier.branch_id, function (err, branch) {
								var result = errorMessage(
									err,
									branch,
									"Branch Not found."
								);
								if (result.status == 0) {
									res.status(200).json(result);
								} else {
									Partner.findById(cashier.partner_id, function (err, partner) {
										var result = errorMessage(
											err,
											partner,
											"Partner not found."
										);
										if (result.status == 0) {
											res.status(200).json(result);
										} else {
											Bank.findById(cashier.bank_id, function (err, bank) {
												var result = errorMessage(
													err,
													bank,
													"Bank not found."
												);
												if (result.status == 0) {
													res.status(200).json(result);
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
														max_trans_amt:cashier.max_trans_amt,
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
			}else if (!branch || branch === null || branch === undefined){
				PartnerUser.findOne(
					{ username, password, role: "branchAdmin" },
					"-password",
					function (err, admin) {
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
						}else if (!admin || admin===null || admin === undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Partner.findOne({ _id: admin.partner_id }, (err, adminpartner) => {
								var result = errorMessage(err, adminpartner, "Partner is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
								} else if (adminpartner.status == -1) {
									res.status(200).json({
										status: 0,
										message: "Your account has been blocked, pls contact the admin!",
									});	
								} else {
									PartnerBranch.findOne({ _id: admin.branch_id }, (err, adminbranch) => {
										var result = errorMessage(err, adminbranch, "Branch is blocked");
										if (result.status == 0) {
											res.status(200).json(result);
										} else {
											Bank.findOne(
												{
													_id: adminpartner.bank_id,
												},(err, bank) => {
													var result = errorMessage(
														err,
														bank,
														"No bank is assigned to the partner"
													);
													if (result.status == 0) {
														res.status(200).json(
															result
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
					function (err, partner) {
						if (err) {
							res.status(200).json(catchError(err));
						} else {
							Bank.findById(partner.bank_id, function (err, bank) {
								var result = errorMessage(
									err,
									bank,
									"Bank not found."
								);
								if (result.status == 0) {
									res.status(200).json(result);
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
			}else if (!partner || partner === null || partner === undefined){
				PartnerUser.findOne(
					{ username, password, role: "partnerAdmin" },
					"-password",
					function (err, admin) {
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
						}else if (!admin || admin===null || admin === undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Partner.findOne({ _id: admin.partner_id }, (err, adminpartner) => {
								var result = errorMessage(err, adminpartner, "Partner is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
								} else if (adminpartner.status == -1) {
									res.status(200).json({
										status: 0,
										message: "Your account has been blocked, pls contact the admin!",
									});	
								} else {
									Bank.findOne(
										{
											_id: adminpartner.bank_id,
										},(err, bank) => {
											var result = errorMessage(
												err,
												bank,
												"No bank is assigned to the partner"
											);
											if (result.status == 0) {
												res.status(200).json(
													result
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
				Bank.findById(partner.bank_id, function (err, bank) {
					var result = errorMessage(
						err,
						bank,
						"Bank not found."
					);
					if (result.status == 0) {
						res.status(200).json(result);
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
				Merchant.findOne({ _id: branch.merchant_id }, (err, merchant) => {
					var result = errorMessage(err, merchant, "Merchant is blocked");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						Bank.findOne(
							{
								_id: merchant.bank_id,
							},(err, bank) => {
								var result = errorMessage(
									err,
									bank,
									"No bank is assigned to the merchant"
								);
								if (result.status == 0) {
									res.status(200).json(result);
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
				Merchant.findOne({ _id: staff.merchant_id }, (err, merchant) => {
					var result = errorMessage(err, merchant, "Merchant is blocked");
					if (result.status == 0) {
						res.status(200).json(result);
					} else {
						MerchantBranch.findOne(
							{ _id: staff.branch_id, status: 1 },
							(err, branch) => {
								var result = errorMessage(err, branch, "Branch is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
								} else {
									MerchantPosition.findOne(
										{ staff_id: staff._id, status: 1, type: staff.role },
										(err, position) => {
											var result = errorMessage(
												err,
												position,
												"No active position is assigned to the staff"
											);
											if (result.status == 0) {
												res.status(200).json(result);
											} else {
												Bank.findOne(
													{
														_id: merchant.bank_id,
													},(err, bank) => {
														var result = errorMessage(
															err,
															bank,
															"No bank is assigned to the merchant"
														);
														if (result.status == 0) {
															res.status(200).json(result);
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
			}else if (!merchant || merchant === null || merchant === undefined){
				MerchantStaff.findOne(
					{ username, password, role: "admin" },
					"-password",
					function (err, admin) {
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
						}else if (!admin || admin===null || admin === undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Merchant.findOne({ _id: admin.merchant_id }, (err, adminmerchant) => {
								var result = errorMessage(err, adminmerchant, "Merchant is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
								} else {
									Bank.findOne(
										{
											_id: adminmerchant.bank_id,
										},(err, bank) => {
											var result = errorMessage(
												err,
												bank,
												"No bank is assigned to the merchant"
											);
											if (result.status == 0) {
												res.status(200).json(
													result
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
					},(err, bank) => {
						var result = errorMessage(
							err,
							bank,
							"No bank is assigned to the merchant"
						);
						if (result.status == 0) {
							res.status(200).json({
								result:result,
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
						function (err, profile) {
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
			}else if (!bank || bank === null || bank === undefined){
				BankUser.findOne(
					{ username, password, role: "bankAdmin" },
					"-password",
					function (err, admin) {
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
						}else if (!admin || admin===null || admin === undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Bank.findOne({ _id: admin.bank_id }, (err, adminbank) => {
								var result = errorMessage(err, adminbank, "Bank is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
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
			}else if (!branch || branch === null || branch === undefined){
				BankUser.findOne(
					{ username, password, role: "branchAdmin" },
					"-password",
					function (err, admin) {
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
						}else if (!admin || admin===null || admin === undefined){
							res.status(200).json({
								status: 0,
								message: "User not found",
							});
						} else {
							Bank.findOne({ _id: admin.bank_id }, (err, adminbank) => {
								var result = errorMessage(err, adminbank, "Bank is blocked");
								if (result.status == 0) {
									res.status(200).json(result);
								} else if (adminbank.status == -1) {
									res.status(200).json({
										status: 0,
										message: "Your account has been blocked, pls contact the admin!",
									});	
								} else {
									Branch.findOne({ _id: admin.branch_id }, (err, adminbranch) => {
										var result = errorMessage(err, adminbranch, "Bank is blocked");
										if (result.status == 0) {
											res.status(200).json(result);
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
					function (err, ba) {
						var result = errorMessage(err, ba, "Bank not found");
						if (result.status == 0) {
							res.status(200).json(result);
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
			} else if (bank.status == -1) {
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
					function (err, cashier) {
						var result = errorMessage(
							err,
							cashier,
							"This user is not assigned as a cashier."
						);
						if (result.status == 0) {
							res.status(200).json(result);
						} else {
							Branch.findById(cashier.branch_id, function (err, branch) {
								var result = errorMessage(
									err,
									branch,
									"Branch not found."
								);
								if (result.status == 0) {
									res.status(200).json(result);
								} else {
									Bank.findById(cashier.bank_id, function (err, bank) {
										var result = errorMessage(
											err,
											bank,
											"Bank not found."
										);
										if (result.status == 0) {
											res.status(200).json(result);
										} else {
											let sign_creds = { username: username, type: "cashier" };
											const token = jwtsign(sign_creds);
											res.status(200).json({
												token: token,
												name: cashier.name,
												username: bank.username,
												status: cashier.status,
												email: bank.email,
												mobile: bank.mobile,
												cashier_id: cashier._id,
												bank_id: cashier.bank_id,
												branch_id: cashier.branch_id,
												bank_name: bank.name,
												branch_name: branch.name,
												id: bank._id,
												max_trans_amt: cashier.max_trans_amt,
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
			Bank.findById(user.bank_id, (err, bank) => {
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
