const knex = require("../../../infrastructure/database/knex");

// CHECK CARD NUMBER
const checkCardNumber = (cardNumber) => {
  let result = knex("t_m_card_product")
    .where("c_card_number", cardNumber)
    .where("c_status", "!=", "X")
    .first();
  return result;
};

// GET RESERVATION
const getReservationNumberSequence = (data, date) => {
  let result = knex("trx.t_d_reservation_balance")
    .select("i_reservation_no_seq")
    .orderBy("i_reservation_no_seq", "desc")
    .whereNotNull("i_reservation_no_seq")
    .where("i_partner", data.i_partner)
    .where("i_merchant", data.i_merchant)
    .whereRaw("??::date = ?", ["d_reservation", date])
    .first();
  return result;
};

// GET PARTNER, MERCHANT, TERMINAL FROM TID
const getPartner = (mid, tid) => {
  let result = knex
    .select(
      "t_m_partner.i_partner",
      "t_m_partner.c_code as partner_code",
      "t_m_partner.c_name as partner_name",
      "t_m_merchant.i_merchant",
      "t_m_merchant.c_code as merchant_code",
      "t_m_merchant.c_name as merchant_name",
      "t_m_merchant.e_mid as mid",
      "t_m_terminal.i_terminal",
      "t_m_terminal.c_code as terminal_code",
      "t_m_terminal.c_name as terminal_name",
      "t_m_terminal.e_tid as tid"
    )
    .from("t_m_terminal")
    .leftJoin(
      "t_m_merchant",
      "t_m_terminal.i_merchant",
      "t_m_merchant.i_merchant"
    )
    .leftJoin("t_m_partner", "t_m_merchant.i_partner", "t_m_partner.i_partner")
    .where("t_m_merchant.e_mid", mid)
    .where("t_m_terminal.e_tid", tid)
    .where("t_m_terminal.c_status", "A")
    .where("t_m_merchant.c_status", "A")
    .where("t_m_partner.c_status", "A")
    .first();
  return result;
};

// GET ISSUER FEE
const getIssuer = (id, time) => {
  let result = knex("t_c_partner_fee")
    .select("i_issuer_fee_perc", "i_channel_fee_perc", "i_amount")
    .where("i_partner", id)
    .where("c_status", "A")
    .where("d_valid", "<=", time)
    .orderBy("d_valid", "desc")
    .first();
  return result;
};

// GET RESERVATION EXPIRATION DATE FROM GLOBAL PARAMETER
const getReservationExpirationDateValue = () => {
  let result = knex("t_m_global_parameter")
    .select("c_value")
    .where("c_code", "HSM_EXP_RSV_VAL")
    .where("c_status", "A")
    .first();
  return result;
};

// GET RESERVATION EXPIRATION DATE MEASURE FROM GLOBAL PARAMETER
const getReservationExpirationDateMeasure = () => {
  let result = knex("t_m_global_parameter")
    .select("c_value")
    .where("c_code", "HSM_EXP_RSV_MEA")
    .where("c_status", "A")
    .first();
  return result;
};

// GET BI REGULATION STATUS FROM GLOBAL PARAMETER
const getBIRegulationStatus = () => {
  let result = knex("t_m_global_parameter")
    .select("c_value")
    .where("c_code", "HSM_BI_REGULATION_STAT")
    .where("c_status", "A")
    .first();
  return result;
};

// GET MAX AMOUNT ON THE CARD FROM GLOBAL PARAMETER
const getMaxAmountOnTheCard = () => {
  let result = knex("t_m_global_parameter")
    .select("c_value")
    .where("c_code", "HSM_BI_MAX_AMOUNT_ON_THE_CARD")
    .where("c_status", "A")
    .first();
  return result;
};

// GET MAX TOPUP PER MONTH FROM GLOBAL PARAMETER
const getMaxTopupPerMonth = () => {
  let result = knex("t_m_global_parameter")
    .select("c_value")
    .where("c_code", "HSM_BI_MAX_TOPUP_PER_MONTH")
    .where("c_status", "A")
    .first();
  return result;
};

// GET MAX RESERVATION FROM GLOBAL PARAMETER
const getMaxReservation = () => {
  let result = knex("t_m_global_parameter")
    .select("c_value")
    .where("c_code", "HSM_MAX_RSV_PEN")
    .where("c_status", "A")
    .first();
  return result;
};

// INQUIRY BY RESERVATION NUMBER
let inquiryByReservationNumber = (reservationNumber) => {
  let result = knex("trx.t_d_reservation_balance")
    .select(
      "c_reservation_no as reservation_number",
      "d_reservation as reservation_date",
      "c_ref_no as ref_no",
      "c_partner_name as partner_name",
      "c_merchant_name as merchant_name",
      "c_terminal_name as terminal_name",
      "c_card_number as card_number",
      "i_reservation_amount as reservation_amount",
      "i_issuer_fee as issuer_fee",
      "i_channel_fee as channel_fee",
      "c_status as status_code",
      "c_status_name as description"
    )
    .where("c_reservation_no", reservationNumber)
    .first();
  return result;
};

// INQUIRY BY CARD NUMBER
let inquiryByCardNumber = (cardNumber, startDate, endDate) => {
  let result = knex("trx.t_d_reservation_balance")
    .select(
      "c_reservation_no as reservation_number",
      "d_reservation as reservation_date",
      "c_ref_no as ref_no",
      "c_partner_name as partner_name",
      "c_merchant_name as merchant_name",
      "c_terminal_name as terminal_name",
      "c_card_number as card_number",
      "i_reservation_amount as reservation_amount",
      "i_issuer_fee as issuer_fee",
      "i_channel_fee as channel_fee",
      "c_status as status_code",
      "c_status_name as description"
    )
    .where("c_card_number", cardNumber);

  if (startDate && endDate) {
    result.whereRaw("??::date >= ?", ["d_reservation", startDate]);
    result.whereRaw("??::date <= ?", ["d_reservation", endDate]);
  }
  return result;
};

// GET RESERVATION PENDING
const getReservationPending = (cardNumber, time) => {
  let result = knex("trx.t_d_reservation_balance")
    .count("* as total_reservation")
    .where("c_card_number", cardNumber)
    .where("c_status", "P")
    .where("d_expired", ">=", time)
    .first();
  return result;
};

// GET RESERVATION WITH FLAG
const getReservationWithFlag = (cardNumber, time) => {
  let result = knex("trx.t_d_reservation_balance")
    .count("* as total_reservation")
    .where("c_card_number", cardNumber)
    .whereIn("c_status", ["P", "I"])
    .where("d_expired", ">=", time)
    .whereNotNull("c_flag")
    .first();
  return result;
};

// INSERT RESERVATION
const insertReservation = (data) => {
  let result = knex("trx.t_d_reservation_balance").insert(data);
  return result;
};

// GET LAST BALANCE FROM CARD HISTORY
const getLastBalanceFromCardHistory = (cardNumber) => {
  let result = knex("log.t_log_card")
    .select("m_balance_after")
    .where("c_card_number", cardNumber)
    .where("c_status", "S")
    .where("m_balance_after", ">", 0)
    .orderBy("d_log", "desc")
    .limit(1)
    .first();
  return result;
};

// GET ACCUMULATION BALANCE IN THIS MONTH FROM CARD HISTORY
const getAccumulationBalanceInThisMonthFromCardHistory = (
  cardNumber,
  year,
  month
) => {
  let result = knex("log.t_log_card")
    .sum("m_amount as accumulation_balance")
    .where("c_card_number", cardNumber)
    .where("c_status", "S")
    .where("m_balance_after", ">", 0)
    .whereRaw("DATE_PART('YEAR', ??) = ?", ["d_log", year])
    .whereRaw("DATE_PART('MONTH', ??) = ?", ["d_log", month])
    .whereIn("i_log_name", [90])
    .groupBy("c_card_number")
    .first();
  return result;
};

// CREATE LOG FOR CARD HISTORY
const createReserveBalanceLog = (data) => {
  let result = knex("log.t_log_card").insert(data);
  return result;
};

// GET RESERVATION PENDING AND IN PROGRESS
const getReservationWithPendingAndInProgressStatus = (cardNumber) => {
  let result = knex("trx.t_d_reservation_balance")
    .count("* as total_reservation_pending")
    .where("c_card_number", cardNumber)
    .whereIn("c_status", ["P", "I"])
    .first();
  return result;
};

const insertReservationNumber = (reservationNumber) => {
  let result = knex("trx.t_d_reservation_no_validate")
    .insert({
      c_reservation_no: reservationNumber,
    })
    .onConflict("c_reservation_no")
    .ignore();
  return result;
};

module.exports = {
  checkCardNumber,
  getReservationNumberSequence,
  getPartner,
  getIssuer,
  getReservationExpirationDateValue,
  getReservationExpirationDateMeasure,
  getBIRegulationStatus,
  getMaxAmountOnTheCard,
  getMaxTopupPerMonth,
  getMaxReservation,
  inquiryByReservationNumber,
  inquiryByCardNumber,
  getReservationPending,
  getReservationWithFlag,
  insertReservation,
  getLastBalanceFromCardHistory,
  getAccumulationBalanceInThisMonthFromCardHistory,
  createReserveBalanceLog,
  getReservationWithPendingAndInProgressStatus,
  insertReservationNumber,
};
