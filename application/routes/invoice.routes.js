const express = require("express");
const router = express.Router();
// const auth = require("../middlewares/jwt.middleware");
const controller = require("../modules/invoice/invoice.controller");

router.post(
  "/generate-invoice",
  // auth.authenticateToken,
  controller.validate("generateInvoice"),
  controller.apiGenerateInvoice
);

router.get(
  "/posting-invoice",
  // controller.validate("postingInvoice"),
  // auth.authenticateToken,
  controller.apiPostingInvoice
);

module.exports = router;
