const express = require('express')
const router = express.Router()
const Bank = require('../models/Bank')
const Infra = require('../models/Infra')
const IncomingForm = require('formidable').IncomingForm
const fs = require('fs-extra')
const config = require('../config')
const doRequest = require('./utils/doRequest')
const path = require('path')

router.post('/fileUpload', function (req, res) {
  const token = req.query.token
  const from = req.query.from
  
  let table = Infra
  if (from && from === 'bank') {
	table = Bank
  }
  table.findOne({
	token,
	status: 1
  }, function (err, user) {
	if (err || user == null) {
	  res.status(401).json({
		error: 'Unauthorized'
	  })
	}
	else {
	  
	  let form = new IncomingForm()
	  const dir = path.resolve('./public/uploads/' + user._id)
	  form.parse(req, function (err, fields, files) {
		
		let fn = files.file.name.split('.').pop()
		fn = fn.toLowerCase()
		
		if (fn !== 'jpeg' && fn !== 'png' && fn !== 'jpg') {
		  res.status(200).json({
			error: 'Only JPG / PNG files are accepted'
		  })
		}
		else {
		  
		  if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir)
		  }
		  
		  let oldpath = files.file.path
		  let newpath = dir + '/' + files.file.name
		  let savepath = user._id + '/' + files.file.name
		  
		  fs.readFile(oldpath, function (err, data) {
			if (err) res.status(402)
			
			fs.writeFile(newpath, data, function (err) {
			  if (err) {
				res.status(402).json({
				  error: 'File upload error'
				})
			  }
			  else {
				res.status(200).json({
				  name: savepath
				})
			  }
			})
			
			fs.unlink(oldpath, function (err) {})
		  })
		}
	  })
	}
  })
})

router.post('/ipfsUpload', function (req, res) {
  const token = req.query.token
  
  var form = new IncomingForm()
  
  form.parse(req, function (err, fields, files) {
	var fn = files.file.name.split('.').pop()
	fn = fn.toLowerCase()
	
	if (fn != 'pdf') {
	  res.status(200).json({
		error: 'Only PDF files are accepted'
	  })
	}
	else {
	  
	  var oldpath = files.file.path
	  fileUpload(oldpath).then(function (result) {
		var out
		if (result) {
		  result = JSON.parse(result)
		  if (!result.Hash) {
			res.status(200).json({
			  error: 'File Upload Error'
			})
		  }
		  else {
			res.status(200).json({
			  name: result.Hash
			})
		  }
		  
		}
		else {
		  res.status(200).json({
			error: 'File Upload Error'
		  })
		}
		
	  })
	}
	
  })
})
async function fileUpload (path) {
  const options = {
	method: 'POST',
	uri: 'http://' + config.blockChainIP + ':5001/api/v0/add',
	headers: {
	  'Content-Type': 'multipart/form-data'
	},
	formData: {
	  'file': fs.createReadStream(path)
	}
  }
  let res = await doRequest(options)
  return res
}

module.exports = router