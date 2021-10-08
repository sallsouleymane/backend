const express = require("express");
const router = express.Router();
const jwt_decode = require("jwt-decode");
const Bank = require("../models/Bank");
const BankUser = require("../models/BankUser");
const Infra = require("../models/Infra");
const IncomingForm = require("formidable").IncomingForm;
const fs = require("fs-extra");
const config = require("../config");
const doRequest = require("./utils/doRequest");
const path = require("path");
const jwtTokenAuth = require("./JWTTokenAuth");
const getTypeClass = require("./utils/getTypeClass");
const { errorMessage, catchError } = require("./utils/errorHandler");
const keyclock = require('./utils/keyClock')
const keyclock_constant = require("../keyclockConstants");


router.get("/uploads/:id/:filePath", (req, res) => {
	const id = req.params.id;
	const file_path = req.params.filePath;
	try {
		res.sendFile(config.uploadPath + id + "/" + file_path);
	} catch (err) {
		console.log(err);
		var message = err;
		if (err.message) {
			message = err.message;
		}
		res.status(200).json({
			status: 0,
			message: message,
		});
	}
});

router.post("/fileUpload", jwtTokenAuth, function (req, res) {
	const from = req.query.from;

	let table = Infra;
	if (from && from == "bank") {
		table = Bank;
	} else if  (from && from == "bankuser") {
		table = BankUser;
	} 
	const jwtusername = req.sign_creds.username;
	table.findOne(
		{
			username: jwtusername,
			status: 1,
		},
		function (err, user) {
			let result = errorMessage(
				err,
				user,
				"Token changed or user not valid. Try to login again or contact system administrator."
			);
			if (result.status == 0) {
				res.status(200).json(result);
			} else {
				let form = new IncomingForm();
				if (!fs.existsSync(config.uploadPath)) {
					fs.mkdirSync(config.uploadPath, { recursive: true });
				}
				const dir = path.resolve(config.uploadPath + user._id);
				form.parse(req, function (err1, fields, files) {
					if (err1) {
						res.status(200).json(catchError(err1));
					} else {
						let fn = files.file.name.split(".").pop();
						fn = fn.toLowerCase();

						if (fn !== "jpeg" && fn !== "png" && fn !== "jpg") {
							res.status(200).json({
								status: 0,
								message: "Only JPG / PNG files are accepted",
							});
						} else {
							if (!fs.existsSync(dir)) {
								fs.mkdirSync(dir);
							}

							let oldpath = files.file.path;
							let newpath = dir + "/" + files.file.name;
							let savepath = user._id + "/" + files.file.name;

							fs.readFile(oldpath, function (err2, data) {
								if (err2) {
									console.log(err2);
									var message2 = err2;
									if (err2.message) {
										message2 = err.message;
									}
									res.status(200).json({
										status: 0,
										message: message2,
									});
								} else {
									fs.writeFile(newpath, data, function (err3) {
										if (err3) {
											console.log(err3);
											var message3 = err3;
											if (err3.message) {
												message3 = err3.message;
											}
											res.status(200).json({
												status: 0,
												message: message3,
											});
										} else {
											res.status(200).json({
												name: savepath,
											});
										}
									});

									fs.unlink(oldpath, function (err45) {});
								}
							});
						}
					}
				});
			}
		}
	);
});

router.post("/:user/imageUpload", function (req, res) {
	const user = req.params.user;
	const { token } = req.query;
	var username = keyclock.getUsername(token);
	if(!keyclock.checkRoles(token, keyclock_constant.roles.INFRA_ADMIN_ROLE)) {
		res.status(200).json({
			status: 0,
			message: "Unauthorized to login",
		});
	}else{
		const Type = getTypeClass(user);
		Type.findOne(
			{
				username,
				status: 1,
			},
			function (err, user) {
				let result = errorMessage(
					err,
					user,
					"Token changed or user not valid. Try to login again or contact system administrator."
				);
				if (result.status == 0) {
					res.status(200).json(result);
				} else {
					let form = new IncomingForm();
					if (!fs.existsSync(config.uploadPath)) {
						fs.mkdirSync(config.uploadPath);
					}
					const dir = path.resolve(config.uploadPath + user._id);
					form.parse(req, function (err2, fields, files) {
						let fn = files.file.name.split(".").pop();
						fn = fn.toLowerCase();

						if (fn !== "jpeg" && fn !== "png" && fn !== "jpg") {
							res.status(200).json({
								status: 0,
								message: "Only JPG / PNG files are accepted",
							});
						} else {
							if (!fs.existsSync(dir)) {
								fs.mkdirSync(dir);
							}

							let oldpath = files.file.path;
							let newpath = dir + "/" + files.file.name;
							let savepath = user._id + "/" + files.file.name;

							fs.readFile(oldpath, function (err3, data) {
								if (err3) {
									res.status(200).json({
										status: 0,
										message: "File upload error",
									});
								} else {
									fs.writeFile(newpath, data, function (err4) {
										if (err4) {
											console.log(err4);
											var message4 = err4;
											if (err4.message) {
												message4 = err4.message;
											}
											res.status(200).json({
												status: 0,
												message: message4,
											});
										} else {
											res.status(200).json({
												status: 1,
												name: savepath,
											});
										}
									});
								}

								fs.unlink(oldpath, function (err45) {});
							});
						}
					});
				}
			}
		);
	}
});

router.post("/ipfsUpload", function (req, res) {
	var form = new IncomingForm();

	form.parse(req, function (_err, _fields, files) {
		// var fn = files.file.name.split('.').pop()
		// fn = fn.toLowerCase()

		// if (fn != 'pdf') {
		//   res.status(200).json({
		// 	message: 'Only PDF files are accepted'
		//   })
		// }
		// else {

		var oldpath = files.file.path;
		fileUpload(oldpath)
			.then(function (result) {
				// var out
				if (result) {
					result = JSON.parse(result);
					if (!result.Hash) {
						res.status(200).json({
							status: 0,
							message: "File Upload Error",
						});
					} else {
						res.status(200).json({
							status: 1,
							message: "File uploaded successfully",
							hash: result.Hash,
						});
					}
				} else {
					res.status(200).json({
						status: 0,
						message: "File Upload Error",
					});
				}
			})
			.catch((err) => {
				console.log(err);
				res.status(200).json({
					status: 0,
					message: err.message,
				});
			});
		// }
	});
});


async function fileUpload(p) {
	const options = {
		method: "POST",
		uri: config.blockChainIP + "/api/v0/add",
		headers: {
			"Content-Type": "multipart/form-data",
		},
		formData: {
			file: fs.createReadStream(p),
		},
	};
	try {
		let res = await doRequest(options);
		return res;
	} catch (err) {
		throw err;
	}
}



module.exports = router;
