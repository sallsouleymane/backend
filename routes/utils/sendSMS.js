const request = require('request')
module.exports = (content, mobile) => {
  let url = 'http://136.243.19.2/http-api.php?username=ewallet&password=bw@2019&senderid=EWALET&route=1&number=' + mobile + '&message=' + content
  request(url, {
	json: true
  }, (err, res, body) => {
	if (err) {
	  return err
	}
	return body
  })
  return ''
}