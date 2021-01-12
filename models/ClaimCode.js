const mongoose = require("mongoose");
const ClaimCodeSchema = new mongoose.Schema({
	sender_mobile: { type: String, required: false },
	receiver_mobile: { type: String, required: false },
	code: { type: String, required: false },
});
module.exports = mongoose.model("ClaimCode", ClaimCodeSchema);
