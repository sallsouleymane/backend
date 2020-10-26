const Infra = require('../../models/Infra')
const Bank = require('../../models/Bank')
const Branch = require('../../models/Branch')
const BankUser = require('../../models/BankUser')
const Cashier = require('../../models/Cashier')
const Fee = require('../../models/Fee')
const CashierPending = require('../../models/CashierPending')
const CashierLedger = require('../../models/CashierLedger')
const User = require('../../models/User')
const Merchant = require('../../models/merchant/Merchant')
const MerchantBranch = require('../../models/merchant/MerchantBranch')
const MerchantCashier = require('../../models/merchant/MerchantCashier')
const MerchantUser = require('../../models/merchant/MerchantStaff')
const Partner = require('../../models/partner/Partner')
const PartnerBranch = require('../../models/partner/Branch')
const PartnerCashier = require('../../models/partner/Cashier')
const PartnerUser = require('../../models/partner/User')
const InterBankRule = require('../../models/InterBankRule')

module.exports = (key) => {
	switch (key) {
		case 'cashier':
			return Cashier
		case 'bank':
		case 'BA':
			return Bank
		case 'infra':
		case 'IN':
			return Infra
		case 'branch':
		case 'BR':
			return Branch
		case 'bankuser':
			return BankUser
		case 'bankfee':
			return Fee
		case 'cashierledger':
			return CashierLedger
		case 'cashierpending':
			return CashierPending
		case 'user':
			return User
		case 'merchant':
		case 'ME':
		case 'IM':
			return Merchant
		case 'merchantBranch':
			return MerchantBranch
		case 'merchantCashier':
			return MerchantCashier
		case 'merchantUser':
			return MerchantUser
		case 'partner':
		case 'PA':
			return Partner
		case 'partnerBranch':
		case 'PB':
			return PartnerBranch
		case 'partnerCashier':
			return PartnerCashier
		case 'partnerUser':
			return PartnerUser
		case 'interbankrule':
			return InterBankRule
		default:
			return null
	}
}