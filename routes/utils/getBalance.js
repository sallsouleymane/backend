const doRequest = require('./doRequest')
const config = require('../../config')

module.exports = async (arr) => {
  
  var options = {
	uri: 'http://' + config.blockChainIP + ':8000/showEWalletBalance',
	method: 'GET',
	json: {
	  'wallet_id': arr.toString()
	}
  }
  
  let res = await doRequest(options)
  
  if (res.status && res.status === 1) {
	return res.data.balance
  }
  else {
	return 0
  }
  
}