const express = require("express");
const router = express.Router();
const auth = require("../middlewares/jwt.middleware");
const controller = require("../modules/auth/auth.controller");

// ============================== AUTH ==============================
router.post(
  "/login",
  controller.validate("login"),
  controller.loginUser
);

router.post(
  "/refresh-token",
  auth.authenticateRefreshToken,
  controller.validate("refreshToken"),
  controller.refreshToken
);


module.exports = router;
