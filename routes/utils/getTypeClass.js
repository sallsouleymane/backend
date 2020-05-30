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

module.exports = (key) => {
  switch (key) {
	case 'cashier':
	  return Cashier
	  break
	case 'bank':
	  return Bank
	  break
	case 'infra':
	  return Infra
	  break
	case 'branch':
	  return Branch
	  break
	case 'bankuser':
	  return BankUser
	  break
	case 'bankfee':
	  return Fee
	  break
	case 'cashierledger':
	  return CashierLedger
	  break
	case 'cashierpending':
	  return CashierPending
	  break
	case 'user':
		return User
		break
	case 'merchant':
		return Merchant
		break
	default:
	  return null
	  break
  }
}