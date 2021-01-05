const Infra = require("../../models/Infra");
const Bank = require("../../models/Bank");
const Branch = require("../../models/Branch");
const BankUser = require("../../models/BankUser");
const Cashier = require("../../models/Cashier");
const Fee = require("../../models/Fee");
const CashierPending = require("../../models/CashierPending");
const CashierLedger = require("../../models/CashierLedger");
const User = require("../../models/User");
const Merchant = require("../../models/merchant/Merchant");
const MerchantBranch = require("../../models/merchant/MerchantBranch");
const MerchantPosition = require("../../models/merchant/Position");
const MerchantStaff = require("../../models/merchant/Staff");
const Partner = require("../../models/partner/Partner");
const PartnerBranch = require("../../models/partner/Branch");
const PartnerCashier = require("../../models/partner/Cashier");
const PartnerUser = require("../../models/partner/User");
const InterBankRule = require("../../models/InterBankRule");

module.exports = (key) => {
	switch (key) {
		case "cashier":
			return Cashier;
		case "bank":
		case "BA":
			return Bank;
		case "infra":
		case "IN":
			return Infra;
		case "branch":
		case "BR":
			return Branch;
		case "bankuser":
			return BankUser;
		case "bankfee":
			return Fee;
		case "cashierledger":
			return CashierLedger;
		case "cashierpending":
			return CashierPending;
		case "user":
			return User;
		case "merchant":
		case "ME":
		case "IM":
			return Merchant;
		case "merchantBranch":
			return MerchantBranch;
		case "merchantPosition":
			return MerchantPosition;
		case "merchantStaff":
			return MerchantStaff;
		case "partner":
		case "PA":
			return Partner;
		case "partnerBranch":
		case "partnerbranch":
		case "PB":
			return PartnerBranch;
		case "partnerCashier":
		case "partnercashier":
			return PartnerCashier;
		case "partnerUser":
		case "partneruser":
			return PartnerUser;
		case "interbankrule":
			return InterBankRule;
		default:
			return null;
	}
};
