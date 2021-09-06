const config = require("./config.json");
const mongoose = require("mongoose");


mongoose.connect("mongodb+srv://adarsh:9742792442@ewallet.bixyf.mongodb.net/myFirstDatabase?retryWrites=true&w=majority", {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

// const dbRoute =
// 	"mongodb://" + config.dbHost + ":" + config.dbPort + "/" + config.dbName;

// mongoose.set("useNewUrlParser", true);
// mongoose.set("useFindAndModify", false);
// mongoose.set("useCreateIndex", true);
// mongoose.set("useUnifiedTopology", true);
// mongoose.connect(dbRoute, {
// 	useNewUrlParser: true,
// });

let db = mongoose.connection;
db.once("open", () => console.log("connected to the database"));
db.on("error", console.error.bind(console, "MongoDB connection error:"));

module.exports = db;
