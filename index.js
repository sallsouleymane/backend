const express = require("express");

//routes
const userRouter = require("./routes/User");
const infraRouter = require("./routes/Infra");
const bankRouter = require("./routes/Bank");
const uploadRouter = require("./routes/Upload");
const cashierRouter = require("./routes/Cashier");
const branchRouter = require("./routes/Branch");
const bankUserRouter = require("./routes/BankUser");
const loginRouter = require("./routes/Login");
const commonRouter = require("./routes/Common");
const merchantRouter = require("./routes/Merchant");
const merchantRuleRouter = require("./routes/MerchantRule");
const merchantStaffRouter = require("./routes/MerchantStaff");
const merchantBranchRouter = require("./routes/MerchantBranch");
const bankPartnerRouter = require("./routes/bank/Partner");
const bankMerchantRouter = require("./routes/bank/Merchant");
const InterBankRuleRouter = require("./routes/InterBankRule");
const invoicePayRouter = require("./routes/InvoicePay");
const partnerRouter = require("./routes/partner/Partner");
const partnerBranchRouter = require("./routes/partner/Branch");
const partnerCashierRouter = require("./routes/partner/Cashier");

var cors = require("cors");
const bodyParser = require("body-parser");
const logger = require("morgan");
const cookieParser = require("cookie-parser");
const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const API_PORT = 3001;

const app = express();
app.use(cors());
app.use(cookieParser());
app.use(express.static("public"));
const router = express.Router();

const swaggerOptions = {
	swaggerDefinition : {
		info: {
			title: "ewallet-backend",
			description: "ewallet-backend",
			servers: ["http://localhost:3001"]
		},
	},
	apis: ['./routes/*/*.js', './routes/*.js']
};



app.use(logger("dev"));
app.use(
	bodyParser.json({
		limit: "50mb",
	})
);
app.use(
	bodyParser.urlencoded({
		limit: "50mb",
		extended: true,
	})
);

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use("/api", router);
app.use("/api", userRouter);
app.use("/api", bankRouter);
app.use("/api", infraRouter);
app.use("/api", uploadRouter);
app.use("/api", cashierRouter);
app.use("/api", branchRouter);
app.use("/api", bankUserRouter);
app.use("/api", loginRouter);
app.use("/api", commonRouter);
app.use("/api", merchantRouter);
app.use("/api", merchantRuleRouter);
app.use("/api", merchantStaffRouter);
app.use("/api", merchantBranchRouter);
app.use("/api", invoicePayRouter);
app.use("/api", bankPartnerRouter);
app.use("/api", bankMerchantRouter);
app.use("/api", partnerRouter);
app.use("/api", partnerBranchRouter);
app.use("/api", partnerCashierRouter);
app.use("/api", InterBankRuleRouter);
app.listen(API_PORT, () => console.log("Backend Started"));
