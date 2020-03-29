const Infra = require('../../models/Infra')
const Bank = require('../../models/Bank')
const Branch = require('../../models/Branch')
const BankUser = require('../../models/BankUser')
const Cashier = require('../../models/Cashier')
const BankFee = require('../../models/BankFee')
const CashierPending = require('../../models/CashierPending')
const CashierLedger = require('../../models/CashierLedger')

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
	  return BankFee
	  break
	case 'cashierledger':
	  return CashierLedger
	  break
	case 'cashierpending':
	  return CashierPending
	  break
	default:
	  return null
	  break
  }
}