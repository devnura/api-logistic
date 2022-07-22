const { param, body, validationResult } = require("express-validator");
const helper = require("../../helpers/helper");
const winston = require("../../helpers/winston.logger");
const model = require("./reservebalance.model");
const moment = require("moment");
moment.locale("id");

var result = {};
var uniqueCode;

// VALIDATION
const validate = (method) => {
  switch (method) {
    case "checkReservation":
      return [
        body("mid").not().isEmpty().withMessage("MID is required"),
        body("tid").not().isEmpty().withMessage("TID is required"),
        body("card_number")
          .not()
          .isEmpty()
          .withMessage("Card Number is required"),
      ];
    case "reservationValidate":
      return [
        body("mid").not().isEmpty().withMessage("MID is required"),
        body("tid").not().isEmpty().withMessage("TID is required"),
        body("card_number")
          .not()
          .isEmpty()
          .withMessage("Card Number is required"),
        body("amount")
          .not()
          .isEmpty()
          .withMessage("Amount is required")
          .isNumeric()
          .withMessage("Amount is invalid format"),
      ];
    case "reservation":
      return [
        body("mid").not().isEmpty().withMessage("MID is required"),
        body("tid").not().isEmpty().withMessage("TID is required"),
        body("card_number")
          .not()
          .isEmpty()
          .withMessage("Card Number is required"),
        body("amount")
          .not()
          .isEmpty()
          .withMessage("Amount is required")
          .isNumeric()
          .withMessage("Amount is invalid format"),
      ];
    default:
      break;
  }
};

// CHECK RESERVATION
const checkReservation = async (req, res) => {
  try {
    // generate unique code
    uniqueCode = await helper.getUniqueCode();

    // param
    let { mid, tid, card_number } = req.body;

    // log info
    winston.logger.info(
      `${uniqueCode} REQUEST check reservation: ${JSON.stringify(req.body)}`
    );

    // check validator
    const err = validationResult(req, res);
    if (!err.isEmpty()) {
      result = {
        code: "400",
        message: err.errors[0].msg,
        data: {},
      };

      // log warn
      winston.logger.warn(
        `${uniqueCode} RESPONSE check reservation: ${JSON.stringify(result)}`
      );

      return res.status(200).json(result);
    }

    // get reservation pending & in progress status
    let checkSecure = false;
    let getReservationWithPendingAndInProgressStatus =
      await model.getReservationWithPendingAndInProgressStatus(card_number);
    if (
      getReservationWithPendingAndInProgressStatus.total_reservation_pending > 0
    ) {
      checkSecure = true;

      result = {
        code: "03",
        message: "success with reservation pending or in progress.",
        data: {},
      };
    } else {
      result = {
        code: "02",
        message: "success without reservation pending or in progress.",
        data: {},
      };
    }

    // log info
    winston.logger.info(
      `${uniqueCode} RESPONSE check reservation: ${JSON.stringify(result)}`
    );

    return res.status(200).json(result);
  } catch (error) {
    // create log
    winston.logger.error(
      `500 internal server error - backend server | ${error.message}`
    );

    return res.status(200).json({
      code: "500",
      message:
        process.env.NODE_ENV != "production"
          ? error.message
          : "500 internal server error - backend server.",
      data: {},
    });
  }
};

// RESERVATION VALIDATE
const reservationValidate = async (req, res) => {
  try {
    // generate unique code
    uniqueCode = await helper.getUniqueCode();

    // param
    let { mid, tid, card_number, amount } = req.body;

    // log info
    winston.logger.info(
      `${uniqueCode} REQUEST reservation validate: ${JSON.stringify(req.body)}`
    );

    // check validator
    const err = validationResult(req, res);
    if (!err.isEmpty()) {
      result = {
        code: "400",
        message: err.errors[0].msg,
        data: {},
      };

      // log warn
      winston.logger.warn(
        `${uniqueCode} RESPONSE reservation validate: ${JSON.stringify(result)}`
      );

      return res.status(200).json(result);
    }

    // time
    let now = moment().format("YYYY-MM-DD HH:mm:ss");
    let today = moment().format("YYYY-MM-DD");
    let year = moment().format("Y");
    let month = moment().format("M");

    // log debug
    winston.logger.debug(`${uniqueCode} checking partner...`);

    // get partner, merchant, terminal from tid
    let getPartner = await model.getPartner(mid, tid);
    if (!getPartner) {
      result = {
        code: "412",
        message: "terminal id is not valid",
        data: {},
      };

      // log warn
      winston.logger.warn(
        `${uniqueCode} RESPONSE reservation validate: ${JSON.stringify(result)}`
      );

      return res.status(200).json(result);
    }

    // check card number
    let checkCardNumber = await model.checkCardNumber(card_number);
    if (!checkCardNumber) {
      result = {
        code: "413",
        message: "card number is not registered",
        data: {},
      };

      // log warn
      winston.logger.warn(
        `${uniqueCode} RESPONSE reservation validate: ${JSON.stringify(result)}`
      );

      return res.status(200).json(result);
    }
    // log debug
    winston.logger.debug(`${uniqueCode} checking reservation amount...`);

    // check reservation amount
    if (parseInt(amount) <= 0) {
      result = {
        code: "415",
        message: "amount must be greater than 0",
        data: {},
      };

      // log warn
      winston.logger.warn(
        `${uniqueCode} RESPONSE reservation validate: ${JSON.stringify(result)}`
      );

      return res.status(200).json(result);
    }

    // log debug
    winston.logger.debug(
      `${uniqueCode} getting last balance on the card by card history...`
    );

    // get last balance on the card
    let balance = 0;
    let getLastBalanceFromCardHistory =
      await model.getLastBalanceFromCardHistory(card_number);
    if (getLastBalanceFromCardHistory) {
      balance = getLastBalanceFromCardHistory.m_balance_after;
    }

    // log debug
    winston.logger.debug(`${uniqueCode} checking BI regulation status...`);

    // get BI regulation status
    const getBIRegulationStatus = await model.getBIRegulationStatus();
    if (getBIRegulationStatus.c_value == "A") {
      // log debug
      winston.logger.debug(`${uniqueCode} checking max balance on the card...`);

      // get max saldo on the card
      const getMaxAmountOnTheCard = await model.getMaxAmountOnTheCard();
      if (getMaxAmountOnTheCard.c_value) {
        if (
          parseInt(balance) + parseInt(amount) >=
          parseInt(getMaxAmountOnTheCard.c_value)
        ) {
          result = {
            code: "416",
            message: "your card number has reached the maximum balance",
            data: {},
          };

          // log warn
          winston.logger.warn(
            `${uniqueCode} RESPONSE reservation validate: ${JSON.stringify(
              result
            )}`
          );

          return res.status(200).json(result);
        }
      }

      // log debug
      winston.logger.debug(`${uniqueCode} checking max topup per month...`);

      // get accumulated balance in this month
      let accumulatedBalance = 0;
      let getAccumulationBalanceInThisMonthFromCardHistory =
        await model.getAccumulationBalanceInThisMonthFromCardHistory(
          card_number,
          year,
          month
        );
      if (getAccumulationBalanceInThisMonthFromCardHistory) {
        accumulatedBalance =
          getAccumulationBalanceInThisMonthFromCardHistory.accumulation_balance;
      }

      // validate max topup per month
      const getMaxTopupPerMonth = await model.getMaxTopupPerMonth();
      if (getMaxTopupPerMonth.c_value) {
        if (
          parseInt(accumulatedBalance) + parseInt(amount) >
          parseInt(getMaxTopupPerMonth.c_value)
        ) {
          result = {
            code: "417",
            message: "your card number has been limit top up for this month",
            data: {},
          };

          // log warn
          winston.logger.warn(
            `${uniqueCode} RESPONSE reservation validate: ${JSON.stringify(
              result
            )}`
          );

          return res.status(200).json(result);
        }
      }
    }

    // log debug
    winston.logger.debug(`${uniqueCode} checking max reservation...`);

    // get max reservation
    let getMaxReservation = await model.getMaxReservation();
    let maxReservation = getMaxReservation.c_value
      ? getMaxReservation.c_value
      : 1;

    // log debug
    winston.logger.debug(`${uniqueCode} checking total reservation pending...`);

    // get total reservation pending
    let getReservationPending = await model.getReservationPending(
      card_number,
      now
    );
    let totalReservationPending =
      getReservationPending.total_reservation > 0
        ? getReservationPending.total_reservation
        : 0;

    if (totalReservationPending >= maxReservation) {
      result = {
        code: "421",
        message:
          "your card number has some pending transaction. Please finished it!",
        data: {},
      };

      // log warn
      winston.logger.warn(
        `${uniqueCode} RESPONSE reservation validate: ${JSON.stringify(result)}`
      );

      return res.status(200).json(result);
    }

    // log debug
    winston.logger.debug(`${uniqueCode} getting issuer fee and channel fee...`);

    // get issuer fee
    let issuerFee = 0;
    let channelFee = 0;
    let getIssuer = await model.getIssuer(getPartner.i_partner, now);
    if (getIssuer) {
      issuerFee = (getIssuer.i_issuer_fee_perc / 100) * getIssuer.i_amount;
      channelFee = (getIssuer.i_channel_fee_perc / 100) * getIssuer.i_amount;
    }
    // if (!getIssuer) {
    //   return res.status(200).json({
    //     code: "403",
    //     message: "issuer doesn't exist",
    //     data: {},
    //   });
    // }

    result = {
      code: "00",
      message: "validation successfully.",
      data: {},
    };

    // log info
    winston.logger.info(
      `${uniqueCode} RESPONSE reservation validate: ${JSON.stringify(result)}`
    );

    return res.status(200).json(result);
  } catch (error) {
    // create log
    winston.logger.error(
      `500 internal server error - backend server | ${error.message}`
    );

    return res.status(200).json({
      code: "500",
      message:
        process.env.NODE_ENV != "production"
          ? error.message
          : "500 internal server error - backend server.",
      data: {},
    });
  }
};

// RESERVATION
const reservation = async (req, res) => {
  try {
    // generate unique code
    uniqueCode = await helper.getUniqueCode();

    // param
    let { mid, tid, card_number, amount, ref_no } = req.body;

    // log info
    winston.logger.info(
      `${uniqueCode} REQUEST reservation: ${JSON.stringify(req.body)}`
    );

    // check validator
    const err = validationResult(req, res);
    if (!err.isEmpty()) {
      result = {
        code: "400",
        message: err.errors[0].msg,
        data: {},
      };

      // log warn
      winston.logger.warn(
        `${uniqueCode} RESPONSE reservation insert: ${JSON.stringify(result)}`
      );

      return res.status(200).json(result);
    }

    // time
    let now = moment().format("YYYY-MM-DD HH:mm:ss");
    let today = moment().format("YYYY-MM-DD");
    let year = moment().format("Y");
    let month = moment().format("M");

    // log debug
    winston.logger.debug(`${uniqueCode} checking partner...`);

    // get partner, merchant, terminal from tid
    let getPartner = await model.getPartner(mid, tid);
    if (!getPartner) {
      result = {
        code: "412",
        message: "terminal id is not valid",
        data: {},
      };

      // log warn
      winston.logger.warn(
        `${uniqueCode} RESPONSE reservation: ${JSON.stringify(result)}`
      );

      return res.status(200).json(result);
    }

    // check card number
    let checkCardNumber = await model.checkCardNumber(card_number);
    if (!checkCardNumber) {
      result = {
        code: "413",
        message: "card number is not registered",
        data: {},
      };

      // log warn
      winston.logger.warn(
        `${uniqueCode} RESPONSE reservation: ${JSON.stringify(result)}`
      );

      return res.status(200).json(result);
    }
    // log debug
    winston.logger.debug(`${uniqueCode} checking reservation amount...`);

    // check reservation amount
    if (parseInt(amount) <= 0) {
      result = {
        code: "415",
        message: "amount must be greater than 0",
        data: {},
      };

      // log warn
      winston.logger.warn(
        `${uniqueCode} RESPONSE reservation: ${JSON.stringify(result)}`
      );

      return res.status(200).json(result);
    }

    // log debug
    winston.logger.debug(
      `${uniqueCode} getting last balance on the card by card history...`
    );

    // get last balance on the card
    let balance = 0;
    let getLastBalanceFromCardHistory =
      await model.getLastBalanceFromCardHistory(card_number);
    if (getLastBalanceFromCardHistory) {
      balance = getLastBalanceFromCardHistory.m_balance_after;
    }

    // log debug
    winston.logger.debug(`${uniqueCode} checking BI regulation status...`);

    // get BI regulation status
    const getBIRegulationStatus = await model.getBIRegulationStatus();
    if (getBIRegulationStatus.c_value == "A") {
      // log debug
      winston.logger.debug(`${uniqueCode} checking max balance on the card...`);

      // get max saldo on the card
      const getMaxAmountOnTheCard = await model.getMaxAmountOnTheCard();
      if (getMaxAmountOnTheCard.c_value) {
        if (
          parseInt(balance) + parseInt(amount) >=
          parseInt(getMaxAmountOnTheCard.c_value)
        ) {
          result = {
            code: "416",
            message: "your card number has reached the maximum balance",
            data: {},
          };

          // log warn
          winston.logger.warn(
            `${uniqueCode} RESPONSE reservation: ${JSON.stringify(result)}`
          );

          return res.status(200).json(result);
        }
      }

      // log debug
      winston.logger.debug(`${uniqueCode} checking max topup per month...`);

      // get accumulated balance in this month
      let accumulatedBalance = 0;
      let getAccumulationBalanceInThisMonthFromCardHistory =
        await model.getAccumulationBalanceInThisMonthFromCardHistory(
          card_number,
          year,
          month
        );
      if (getAccumulationBalanceInThisMonthFromCardHistory) {
        accumulatedBalance =
          getAccumulationBalanceInThisMonthFromCardHistory.accumulation_balance;
      }

      // validate max topup per month
      const getMaxTopupPerMonth = await model.getMaxTopupPerMonth();
      if (getMaxTopupPerMonth.c_value) {
        if (
          parseInt(accumulatedBalance) + parseInt(amount) >
          parseInt(getMaxTopupPerMonth.c_value)
        ) {
          result = {
            code: "417",
            message: "your card number has been limit top up for this month",
            data: {},
          };

          // log warn
          winston.logger.warn(
            `${uniqueCode} RESPONSE reservation: ${JSON.stringify(result)}`
          );

          return res.status(200).json(result);
        }
      }
    }

    // log debug
    winston.logger.debug(`${uniqueCode} checking max reservation...`);

    // get max reservation
    let getMaxReservation = await model.getMaxReservation();
    let maxReservation = getMaxReservation.c_value
      ? getMaxReservation.c_value
      : 1;

    // // log debug
    // winston.logger.debug(`${uniqueCode} checking reservation with flag...`);

    // // get reservation with flag
    // let reservationWithFlag = await model.getReservationWithFlag(
    //   card_number,
    //   now
    // );
    // let totalReservationWithFlag =
    //   reservationWithFlag.total_reservation > 0
    //     ? reservationWithFlag.total_reservation
    //     : 0;
    // if (totalReservationWithFlag > 0) {
    //   result = {
    //     code: "420",
    //     message:
    //       "your card number has incomplete transaction. Please unload your balance!",
    //     data: {},
    //   };

    //   // log warn
    //   winston.logger.warn(
    //     `${uniqueCode} RESPONSE reservation: ${JSON.stringify(result)}`
    //   );

    //   return res.status(200).json(result);
    // }

    // log debug
    winston.logger.debug(`${uniqueCode} checking total reservation pending...`);

    // get total reservation pending
    let getReservationPending = await model.getReservationPending(
      card_number,
      now
    );
    let totalReservationPending =
      getReservationPending.total_reservation > 0
        ? getReservationPending.total_reservation
        : 0;

    if (totalReservationPending >= maxReservation) {
      result = {
        code: "421",
        message:
          "your card number has some pending transaction. Please finished it!",
        data: {},
      };

      // log warn
      winston.logger.warn(
        `${uniqueCode} RESPONSE reservation: ${JSON.stringify(result)}`
      );

      return res.status(200).json(result);
    }

    // log debug
    winston.logger.debug(`${uniqueCode} getting issuer fee and channel fee...`);

    // get issuer fee
    let issuerFee = 0;
    let channelFee = 0;
    let getIssuer = await model.getIssuer(getPartner.i_partner, now);
    if (getIssuer) {
      issuerFee = (getIssuer.i_issuer_fee_perc / 100) * getIssuer.i_amount;
      channelFee = (getIssuer.i_channel_fee_perc / 100) * getIssuer.i_amount;
    }
    // if (!getIssuer) {
    //   return res.status(200).json({
    //     code: "403",
    //     message: "issuer doesn't exist",
    //     data: {},
    //   });
    // }

    // generate reservation number
    let reservationNumber;
    let getReservationNumberSequence;
    let reservationNoSequence;
    let maxLoop = 0;
    do {
      // log debug
      winston.logger.debug(`${uniqueCode} checking reservation sequence...`);

      // get reservation
      getReservationNumberSequence = await model.getReservationNumberSequence(
        getPartner,
        today
      );
      reservationNoSequence = getReservationNumberSequence
        ? parseInt(getReservationNumberSequence.i_reservation_no_seq) + 1
        : 1;

      // log debug
      winston.logger.debug(`${uniqueCode} generating reservation number...`);

      reservationNumber = await generateReservationNumber(
        getPartner,
        moment(today).format("YYYYMMDD"),
        reservationNoSequence
      );

      if (maxLoop > 20) {
        // create log
        winston.logger.error(
          `500 internal server error (max loop) - backend server | ${error.message}`
        );

        return {
          code: "500",
          message:
            process.env.NODE_ENV != "production"
              ? error.message
              : "500 internal server error (max loop) - backend server.",
          data: {},
        };
      }

      maxLoop++;
    } while (reservationNumber == "XX");

    // log debug
    winston.logger.debug(
      `${uniqueCode} getting reservation expiration date on parameter...`
    );

    // get reservation expiration date by parameter
    let getReservationExpirationDateValue =
      await model.getReservationExpirationDateValue();
    let time = getReservationExpirationDateValue.c_value
      ? parseInt(getReservationExpirationDateValue.c_value)
      : 1;

    // log debug
    winston.logger.debug(
      `${uniqueCode} getting reservation expiration date measure on parameter...`
    );

    // get reservation expiration date  measure by parameter
    let getReservationExpirationDateMeasure =
      await model.getReservationExpirationDateMeasure();
    let measure = getReservationExpirationDateMeasure.c_value
      ? getReservationExpirationDateMeasure.c_value
      : "hours";

    let expired = moment(now).add(time, measure).format("YYYY-MM-DD HH:mm:ss");

    // binding data
    let data = {
      c_reservation_no: reservationNumber,
      d_reservation: now,
      c_ref_no: ref_no,
      i_partner: getPartner ? getPartner.i_partner : null,
      c_partner_code: getPartner ? getPartner.partner_code : null,
      c_partner_name: getPartner ? getPartner.partner_name : null,
      i_merchant: getPartner ? getPartner.i_merchant : null,
      c_merchant_code: getPartner ? getPartner.merchant_code : null,
      c_merchant_name: getPartner ? getPartner.merchant_name : null,
      c_mid: getPartner ? getPartner.mid : null,
      i_terminal: getPartner ? getPartner.i_terminal : null,
      c_terminal_code: getPartner ? getPartner.terminal_code : null,
      c_terminal_name: getPartner ? getPartner.terminal_name : null,
      c_tid: getPartner ? getPartner.tid : null,
      c_card_number: card_number,
      i_reservation_amount: amount,
      // i_issuer: getIssuer ? getIssuer.i_issuer : null,
      // c_issuer_code: getIssuer ? getIssuer.issuer_code : null,
      // c_issuer_name: getIssuer ? getIssuer.issuer_name : null,
      i_issuer_fee: issuerFee,
      // i_channel: null,
      // c_channel_code: null,
      // c_channel_name: null,
      i_channel_fee: channelFee,
      c_payment_ref_no: null,
      i_reservation_no_seq: reservationNoSequence,
      d_expired: expired,
      d_load_balance: null,
      c_load_balance_no: null,
      c_status: "P",
      c_status_name: "PENDING",
      d_create: now,
      i_create: null,
      c_create_username: null,
      c_create_fullname: null,
      d_modify: null,
      i_modify: null,
      c_modify_username: null,
      c_modify_fullname: null,
      d_delete: null,
      i_delete: null,
      c_delete_username: null,
      c_delete_fullname: null,
      c_flag: "-1",
    };

    // log debug
    winston.logger.debug(`${uniqueCode} inserting reservation transaction...`);

    // insert transaction
    await model.insertReservation(data);

    // log debug
    winston.logger.debug(`${uniqueCode} inserting log for card history...`);

    // log card history
    await model.createReserveBalanceLog({
      i_log_name: 90,
      d_log: now,
      c_card_number: card_number,
      c_source: "CMS - RESERVE BALANCE",
      c_location: getPartner ? getPartner.terminal_name : null,
      m_balance_before: balance > 0 ? balance : 0,
      m_amount: amount,
      m_balance_after: parseInt(balance) + parseInt(amount),
      j_new_data: data,
      j_old_data: null,
      c_note: `RESERVED BALANCE ${amount} FROM ${
        getPartner ? getPartner.terminal_name : null
      } SUCCESSFULLY`,
      c_status: "S",
      d_created: now,
      i_create: null,
      c_create_username: "HSM",
      c_create_fullname: "HARDWARE SECURE MODULE",
      c_category: "T",
    });

    result = {
      code: "00",
      message: "reservation saved successfully.",
      data: {
        reservation_number: reservationNumber,
      },
    };

    // log info
    winston.logger.info(
      `${uniqueCode} RESPONSE reservation: ${JSON.stringify(result)}`
    );

    return res.status(200).json(result);
  } catch (error) {
    // create log
    winston.logger.error(
      `500 internal server error - backend server | ${error.message}`
    );

    return res.status(200).json({
      code: "500",
      message:
        process.env.NODE_ENV != "production"
          ? error.message
          : "500 internal server error - backend server.",
      data: {},
    });
  }
};

// INQUIRY RESERVATION
const inquiryReservation = async (req, res) => {
  try {
    // param
    let { reservation_number, card_number, start_date, end_date } = req.body;

    // time
    let now = moment().format("YYYY-MM-DD HH:mm:ss");

    // validation parameter inquiry
    if (!reservation_number && !card_number) {
      return res.status(200).json({
        code: "400",
        message:
          "bad request. please add the reservation number or card number!",
        data: {},
      });
    }

    // validation inquiry date
    if ((!start_date && end_date) || (start_date && !end_date)) {
      return res.status(200).json({
        code: "400",
        message: "bad request. please check the date!",
        data: {},
      });
    }

    // check reservation
    if (reservation_number) {
      let byReservationNumber = await model.inquiryByReservationNumber(
        reservation_number
      );

      if (!byReservationNumber) {
        return res.status(200).json({
          code: "414",
          message: "reservation doesn't exist",
          data: {},
        });
      }

      return res.json({
        code: "00",
        message: "reservation has been found.",
        data: byReservationNumber,
      });
    } else if (card_number) {
      let byCardNumber = await model.inquiryByCardNumber(
        card_number,
        start_date,
        end_date
      );

      if (!byCardNumber) {
        return res.status(200).json({
          code: "414",
          message: "reservation doesn't exist",
          data: [],
        });
      }

      return res.json({
        code: "00",
        message: "reservation has been found.",
        data: byCardNumber,
      });
    }
  } catch (error) {
    return res.status(200).json({
      code: "500",
      message:
        process.env.NODE_ENV != "production"
          ? error.message
          : "500 internal server error - backend server.",
      data: {},
    });
  }
};

// GENERATE RESERVATION NUMBER
const generateReservationNumber = async (data, date, counter) => {
  let code = data.merchant_code ? data.merchant_code : "XXXXXXX";

  let prefix = "RSV";
  let reservationNumber =
    prefix + "" + code + "" + "" + date + counter.toString().padStart(3, "0");

  // insert to temp reservation number
  let insert = await model.insertReservationNumber(reservationNumber);
  if (!insert) {
    reservationNumber = "XX";
  }

  return reservationNumber;
};

module.exports = {
  validate,
  checkReservation,
  reservationValidate,
  reservation,
  inquiryReservation,
};
