const jwt = require("jsonwebtoken");
const helper = require("../helpers/helper");

const generateRefreshToken = (req) => {
  let expiresIn = process.env.JWT_REFRESH_EXPIRATION ? process.env.JWT_REFRESH_EXPIRATION : "7d";
  let signOptions = {
    issuer: 'CMS Kereta Commuter Indonesia',
    expiresIn: expiresIn,
  }
  return jwt.sign(req, process.env.REFRESH_TOKEN_SECRET, signOptions);
};

const authenticateRefreshToken = (req, res, next) => {
  
  let verifyOptions = {
    issuer: 'CMS Kereta Commuter Indonesia',
  }

  jwt.verify(req.header("refresh_token"), process.env.REFRESH_TOKEN_SECRET, verifyOptions, (err, data) => {
    if (err) {
      return res.json({
        code: "400",
        message: "Refresh Token is invalid. Please login!",
        data: {},
      });
    }

    next();
  });
};

const generateAccessToken = (req) => {
  let expiresIn = process.env.JWT_EXPIRATION ? process.env.JWT_EXPIRATION : "1d";
  let signOptions = {
    issuer: 'CMS Kereta Commuter Indonesia',
    expiresIn: expiresIn,
  }

  if (req.user_group_id == "1") {
    expiresIn = parseInt(process.env.JWT_EXPIRATION_ADMIN_WEB);
  } else if (req.user_group_id == "2") {
    expiresIn = parseInt(process.env.JWT_EXPIRATION_MOBILE_PHONE);
  } else if (
    req.user_group_id == "3" ||
    req.user_group_id == "4" ||
    req.user_group_id == "5"
  ) {
    expiresIn = parseInt(process.env.JWT_EXPIRATION_TERMINAL);
  }

  return jwt.sign(req, process.env.TOKEN_SECRET, signOptions);
};

const authenticateToken = async (req, res, next) => {
  let authHeader = req.headers["authorization"];

  if (authHeader) {
    let token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.json({
        code: "401",
        message: "Token is required",
        data: {},
      });
    }

    let verifyOptions = {
      issuer: 'CMS Kereta Commuter Indonesia',
    }

    await jwt.verify(token, process.env.TOKEN_SECRET, verifyOptions, (err, data) => {
      if (err) {
        return res.json({
          code: "402",
          message: "Invalid Token.",
          data: {},
        });
      }

      req.mid_token = helper.decryptText(data.mid);
      req.tid_token = helper.decryptText(data.tid);
      req.partner_id_token = helper.decryptText(data.partner_id);
      req.partner_user_id_token = helper.decryptText(data.partner_user_id);

      next();
    });
  } else {
    return res.json({
      code: "400",
      message: "Header not found",
      data: {},
    });
  }
};

module.exports = {
  generateRefreshToken,
  authenticateRefreshToken,
  generateAccessToken,
  authenticateToken,
};
