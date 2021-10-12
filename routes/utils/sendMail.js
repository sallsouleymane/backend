/* If this file is updated, also build docker for receive.js which is a rabbitmq queue receiver*/

const nodemailer = require("nodemailer");
module.exports = (content, subject, email) => {
	let transporter = nodemailer.createTransport({
		host: "smtp.gmail.com",
		port: 587,
		secure: false, // true for 465, false for other ports
		auth: {
			user: "siliconvalley.beyonwallet@gmail.com", // generated ethereal user
			pass: "life2work4SV!", // generated ethereal password
		},
	});
	return transporter.sendMail({
		from: '"E-Wallet" <no-reply@ewallet.com>', // sender address
		to: email, // list of receivers
		subject: subject, // Subject line
		text: "", // plain text body
		html: content, // html body
	});
};
