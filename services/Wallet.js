const doRequest = require('../routes/utils/doRequest')
const config = require('../config.json')

module.exports = async (arr, bank = '', infra = '') => {
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
	  // let data = {};
	  // let temp = url.split("@");
	  // data.address = url;
	  // data.type = temp[0];
	  // data.infra_id = infra;
	  // data.bank_id = bank;
	  // data.balance = 0;
	  // data.save((e, ) => {
	  //   if (e) {
	  //     err.push("failed to create " + url);
	  //   }
	  // });
	}
	
  }))
  return err.toString()
}