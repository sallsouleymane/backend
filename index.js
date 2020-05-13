const express = require("express");

//routes
const userRouter = require("./routes/User");
const infraRouter = require("./routes/Infra");
const bankRouter = require("./routes/Bank");
const uploadRouter = require("./routes/Upload");
const cashierRouter = require("./routes/Cashier");
const branchRouter = require("./routes/Branch")
const bankUserRouter = require("./routes/BankUser")
const loginRouter = require("./routes/Login")
const commonRouter = require("./routes/Common")

var cors = require("cors");
const bodyParser = require("body-parser");
const logger = require("morgan");
const cookieParser = require("cookie-parser");

const API_PORT = 3001;

const app = express();
app.use(cors());
app.use(cookieParser());
app.use(express.static("public"));
const router = express.Router();

app.use(logger("dev"));
app.use(
	bodyParser.json({
		limit: "50mb"
	})
);
app.use(
	bodyParser.urlencoded({
		limit: "50mb",
		extended: true
	})
);

app.use("/api", router);
app.use("/api", userRouter);
app.use("/api", bankRouter);
app.use("/api", infraRouter);
app.use("/api", uploadRouter);
app.use("/api", cashierRouter);
app.use("/api", branchRouter);
app.use("/api", bankUserRouter);
app.use("/api", loginRouter);
app.use("/api", commonRouter)
app.listen(API_PORT, () => console.log("Backend Started"));
