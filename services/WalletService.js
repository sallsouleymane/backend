const doRequest = require('../routes/utils/doRequest')
const config = require('../config.json')

module.exports.createWallet = async (arr, bank = '', infra = '') => {
  let err = []
  await Promise.all(arr.map(async (url) => {
	let options = {
	  uri: 'http://' + config.blockChainIP + ':8000/createEWallet',
	  method: 'POST',
	  json: {
		'wallet_id': url,
		'type': 'test',
		'remarks': ''
	  }
	}
	let res = await doRequest(options)
	
	if (res.status === 0) {
	  err.push(res.message)
	}
	else {
	}
	
  }))
  return err.toString()
}

module.exports.getStatement = async (arr) => {
  
  let options = {
	uri: 'http://' + config.blockChainIP + ':8000/getEWalletStatement',
	method: 'GET',
	json: {
	  'wallet_id': arr.toString()
	}
  }
  
  let res = await doRequest(options)
  if (res.status && res.status === 1) {
	return res.data
  }
  else {
	return []
  }
}