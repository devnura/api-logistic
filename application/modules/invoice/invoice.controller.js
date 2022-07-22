const { param, body, validationResult } = require("express-validator");
const helper = require("../../helpers/helper");
const winston = require("../../helpers/winston.logger");
const model = require("./invoice.model");
const moment = require("moment");
const knex = require("../../../infrastructure/database/knex");

moment.locale("id");

var result = {};
var uniqueCode;

// VALIDATION
const validate = (method) => {
  switch (method) {
    case "generateInvoice":
      return [
        body('trx_date').notEmpty().withMessage('trx_date is required!').isISO8601().withMessage('invalid trx_date format YYYY-MM-DD !').escape().trim(),
      ];
    case "postingInvoice":
      return [
        body('trx_date').notEmpty().withMessage('trx_date is required!').isISO8601().withMessage('invalid trx_date format YYYY-MM-DD !').escape().trim(),
      ];
    default:
      break;
  }
};

// POSTING INVOICE
const apiGenerateInvoice = async (req, res) => {

  try {
    // generate unique code
    uniqueCode = helper.getUniqueCode();
    // return uniqueCode

    // log info
    winston.logger.info(
      `${uniqueCode} REQUEST generate invoice: ${JSON.stringify(req.body)}`
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
        `${uniqueCode} RESPONSE generate invoice: ${JSON.stringify(result)}`
      );

      return res.status(200).json(result);
    }

    // time
    let invoiceDate = moment(req.body.trx_date).format("YYYY-MM-DD")

    let invoice = await _generateInvoice(invoiceDate, uniqueCode)
    
    result = {
      code: "200",
      message: "Succes posting",
      data: invoice
    };

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

// RETRY POSTING INVOICE
const apiPostingInvoice = async (req, res) => {
  try {
    // generate unique code
    uniqueCode = helper.getUniqueCode()

    // log info
    winston.logger.info(
      `${uniqueCode} REQUEST posting invoice: ${JSON.stringify(req.body)}`
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
        `${uniqueCode} RESPONSE generate invoice: ${JSON.stringify(result)}`
      );

      return res.status(200).json(result);
    }

    // return uniqueCode
    winston.logger.info(`SCHEDULER-RETRY-${uniqueCode} RE-TRY POSTING INVOICE`)

    const invoice = await _postingInvoice(uniqueCode)

    result = {
      code: "200",
      message: "Succes",
      data: invoice,
    }

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
}

const _generateInvoice = async (invoiceDate, uniqueCode) => {

  let invoice = []

  await knex.transaction(async trx => {

    winston.logger.info(`SCHEDULER-FB70-${uniqueCode} TRANSACTION 1`);

    winston.logger.info(`SCHEDULER-FB70-${uniqueCode} execute payment.sp_payment_req_topup_online(${invoiceDate})`);

    invoice = await model.generateInvoice(invoiceDate, trx)

    winston.logger.info(`SCHEDULER-FB70-${uniqueCode} result payment.sp_payment_req_topup_online ${JSON.stringify(invoice)}`);
    
    if(invoice.length > 0) for (const key in invoice) {

      winston.logger.info(`SCHEDULER-FB70-${uniqueCode} insert posting et ${JSON.stringify(invoice[key])}`)

      let postingEt = await model.insertPostingEt(invoice[key], trx)
    
      winston.logger.info(`SCHEDULER-FB70-${uniqueCode} success insert posting et : ${JSON.stringify(postingEt)}`)
    }

  })

  if(invoice.length > 0){
    
    winston.logger.info(`SCHEDULER-FB70-${uniqueCode} preparing posting FB70 to SAP`);

    const url = 'http://piqas.kereta-api.co.id:51500/XISOAPAdapter/MessageServlet?senderParty=&senderService=KCI_ETICKETING_2&receiverParty=&receiverService=&interface=SI_KCI_CMS_FI01&interfaceNamespace=urn:Posting_ETicketing_2'

    for (const key in invoice) {
    
      let xmlHeader = {
        doc_header_text : invoice[key].doc_header_text ? invoice[key].doc_header_text : "",
        ba: invoice[key].ba ? invoice[key].ba : "",
        doc_date : invoice[key].doc_date ? invoice[key].doc_date : "",
        posting_date : invoice[key].posting_date ? invoice[key].posting_date : "",
        fisc_year : invoice[key].fisc_year ? invoice[key].fisc_year : "",
        fisc_period : invoice[key].fisc_period ? invoice[key].fisc_period: "",
        doc_type: invoice[key].doc_type ? invoice[key].doc_type : "",
        c_invoice_no : invoice[key].c_invoice_no ? invoice[key].c_invoice_no : ""
      }

      let xmlItem = ['S', 'H'].map(item => {
        return {
          c_account_code_topup : item == 'S' ? invoice[key].c_account_code_topup : "",
          c_account_topup : item == 'H' ? invoice[key].c_account_topup : "",
          ba : invoice[key].ba,
          amount : invoice[key].amount,
          posting_date : invoice[key].posting_date,
          c_invoice_no : invoice[key].c_invoice_no,
          item_text : `${item == 'S' ? "DEBIT" : "KREDIT"} INVOICE CMS ${invoice[key].doc_header_text}`,
          de_cre : item
        }
      });

      let xmlRequest = helper.generateXMLRequest('ZFMCMS_FI_001', xmlHeader, xmlItem)

      winston.logger.info(`SCHEDULER-FB70-${uniqueCode} REQUEST posting ${invoice[key].c_invoice_no} to SAP : ${xmlRequest}`);
      
      const response = await helper.postingSAP(url, xmlRequest)

      winston.logger.info(`SCHEDULER-FB70-${uniqueCode} RESPONSE posting ${invoice[key].c_invoice_no} to SAP : ${JSON.stringify(response)}`);

      // new transaction
      await knex.transaction(async trx => {

        const resSAP = helper.getXMLData(response)

        winston.logger.info(`SCHEDULER-FB70-${uniqueCode} TRANSACTION 2`);
        // UPDATE CMS
        winston.logger.info(`SCHEDULER-FB70-${uniqueCode} SET resposn FB70 to CMS :  ${JSON.stringify(resSAP)}`)

        const cms = await model.setReturnSAP(invoice[key], resSAP, trx)

        winston.logger.info(`SCHEDULER-FB70-${uniqueCode} RESULT CMS : ${JSON.stringify(cms)}`)

      })
    }
  }

  return invoice

}

const _postingInvoice = async (uniqueCode) => {
  let postingEt = []
  await knex.transaction(async trx => {

    postingEt = await model.getPostingEt(trx)

    winston.logger.info(`SCHEDULER-RETRY-${uniqueCode} GET POSTING ET : ${JSON.stringify(postingEt)}`)

    for (const item of postingEt) {
    
      let xmlHeader = {
        doc_header_text : item.doc_header_text ? item.doc_header_text : "",
        ba: item.ba ? item.ba : "",
        doc_date : item.doc_date ? item.doc_date : "",
        posting_date : item.posting_date ? item.posting_date : "",
        fisc_year : item.fiscal_year ? item.fiscal_year : "",
        fisc_period : item.fis_period ? item.fis_period: "",
        doc_type: item.doc_type ? item.doc_type : "",
        c_invoice_no : item.reference ? item.reference : ""
      }

      let xmlItem = ['S', 'H'].map(key => {
        return {
          c_account_code_topup : key == 'S' ? item.customer : "",
          c_account_topup : key == 'H' ? item.account : "",
          ba : item.ba,
          amount : item.amount,
          posting_date : item.posting_date,
          c_invoice_no : item.reference,
          item_text :key == 'S' ? item.text1 : item.text2,
          de_cre : key
        }
      });

      let xmlRequest = helper.generateXMLRequest('ZFMCMS_FI_001', xmlHeader, xmlItem)

      winston.logger.info(`SCHEDULER-RETRY-${uniqueCode} REQUEST posting ${item.reference} to SAP : ${xmlRequest}`);
      
      const url = 'http://piqas.kereta-api.co.id:51500/XISOAPAdapter/MessageServlet?senderParty=&senderService=KCI_ETICKETING_2&receiverParty=&receiverService=&interface=SI_KCI_CMS_FI01&interfaceNamespace=urn:Posting_ETicketing_2'

      const response = await helper.postingSAP(url, xmlRequest)

      winston.logger.info(`SCHEDULER-RETRY-${uniqueCode} RESPONSE posting ${item.reference} to SAP : ${JSON.stringify(response)}`);

      // new transaction
      // await knex.transaction(async trx => {

      const resSAP = helper.getXMLData(response)

      winston.logger.info(`SCHEDULER-RETRY-${uniqueCode} TRANSACTION 2`);
      // UPDATE CMS
      winston.logger.info(`SCHEDULER-RETRY-${uniqueCode} SET resposn FB70 to CMS :  ${JSON.stringify(resSAP)}`)

      const cms = await model.setReturnSAP({c_invoice_no : item.reference}, resSAP, trx)

      winston.logger.info(`SCHEDULER-RETRY-${uniqueCode} RESULT CMS : ${JSON.stringify(cms)}`)
      // })
    }
    
  })

  return postingEt

}

module.exports = {
  validate,
  apiPostingInvoice,
  apiGenerateInvoice,
  _postingInvoice,
  _generateInvoice
};