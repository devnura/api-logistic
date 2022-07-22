const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const winston = require("./application/helpers/winston.logger");
const authRoute = require("./application/routes/auth.routes");
const invoiceRoute = require("./application/routes/invoice.routes");
require("dotenv").config();

const app = express();

var corsOptions = {
  origin: ["http://localhost:" + process.env.PORT || 8000, "http://localhost:3000"],
};

// app.use(cors(corsOptions));
app.use(cors(corsOptions));

// parse requests of content-type - application/json
app.use(bodyParser.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// ============================== ROUTES API ==============================
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Logistic Service.",
  });
});

app.use("/api/", authRoute);
app.use("/api/", invoiceRoute);

// set port, listen for requests
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  winston.logger.info(`Server is running on environment: ${process.env.NODE_ENV.toUpperCase()}`);
});
