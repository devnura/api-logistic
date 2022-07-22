const CryptoJS = require("crypto-js");
const {v4} = require('uuid');
// ENCRYPT TEXT
const encryptText = (text) => {
  try {
    return CryptoJS.AES.encrypt(text, process.env.SECRET_KEY).toString();
  } catch (error) {
    return error.message;
  }
};

// DECRYPT TEXT
const decryptText = (cipherText) => {
  try {
    return CryptoJS.AES.decrypt(cipherText, process.env.SECRET_KEY).toString(
      CryptoJS.enc.Utf8
    );
  } catch (error) {
    return error.message;
  }
};

// RANDOM UNIQUE CODE
function getUniqueCode() {
  return v4();
}

// GENERATE XML REQUEST
function generateXMLRequest(urn, headers, items) {
  let xmlRequest = ''
  
  switch (urn.toUpperCase()) {
    case 'ZFMCMS_FI_001':

      let xmlItem = ''

      items.map((item, index) => {
        xmlItem += `<item>
                        <!--Optional:-->
                        <ITEMNO_ACC>${String(index+1).padStart(10, '0')}</ITEMNO_ACC>
                        <!--Optional:-->
                        <CUSTOMER>${item.c_account_code_topup ? item.c_account_code_topup : ""}</CUSTOMER>
                        <!--Optional:-->
                        <GL_ACCOUNT>${item.c_account_topup ? item.c_account_topup : ""}</GL_ACCOUNT>
                        <!--Optional:-->
                        <BUS_AREA>${item.ba ? item.ba : ""}</BUS_AREA>
                        <!--Optional:-->
                        <AMT_DOCCUR>${item.amount ? item.amount : ""}</AMT_DOCCUR>
                        <!--Optional:-->
                        <BLINE_DATE>${item.posting_date ? item.posting_date : ""}</BLINE_DATE>
                        <!--Optional:-->
                        <COSTCENTER></COSTCENTER>
                        <!--Optional:-->
                        <PROFITCENTER></PROFITCENTER>
                        <!--Optional:-->
                        <ALLOC_NMBR>${item.c_invoice_no ? item.c_invoice_no : ""}</ALLOC_NMBR>
                        <!--Optional:-->
                        <ITEM_TEXT>${item.item_text ? item.item_text : ""}</ITEM_TEXT>
                        <!--Optional:-->
                        <DE_CRE_IND>${item.de_cre}</DE_CRE_IND>
                    </item>`
      })

      xmlRequest = `<SOAP:Envelope xmlns:SOAP='http://schemas.xmlsoap.org/soap/envelope/'
                      xmlns:urn='urn:sap-com:document:sap:rfc:functions'>
                      <SOAP:Body>
                          <!--Optional-->
                          <urn:${urn}>
                              <!--You may enter the following 7 items in any order-->
                              <!--Optional:-->
                              <I_SIMULATE></I_SIMULATE>
                              <I_S_HEADER>
                                <!--Optional:-->
                                <HEADER_TXT>${headers.doc_header_text}</HEADER_TXT>
                                <!--Optional:-->
                                <COMP_CODE>${headers.ba}</COMP_CODE>
                                <!--Optional:-->
                                <DOC_DATE>${headers.doc_date}</DOC_DATE>
                                <!--Optional:-->
                                <PSTNG_DATE>${headers.posting_date}</PSTNG_DATE>
                                <!--Optional:-->
                                <FISC_YEAR>${headers.fisc_year}</FISC_YEAR>
                                <!--Optional:-->
                                <FIS_PERIOD>${headers.fisc_period}</FIS_PERIOD>
                                <!--Optional:-->
                                <!--default-->
                                <DOC_TYPE>${headers.doc_type}</DOC_TYPE>
                                <!--Optional:-->
                                <REF_DOC_NO>${headers.c_invoice_no}</REF_DOC_NO>
                                <!--Optional:-->
                                <CURRENCY>IDR</CURRENCY>
                              </I_S_HEADER>
                              <I_T_ITEM>
                                  <!--Zero or more repetitions:-->
                                  ${xmlItem}
                              </I_T_ITEM>
                              <!--Optional:-->
                              <C_T_RETURN>
                                  <!--Zero or more repetitions:-->
                                  <item>
                                      <!--Optional:-->
                                      <TYPE></TYPE>
                                      <!--Optional:-->
                                      <DOC_NUMBER></DOC_NUMBER>
                                      <!--Optional:-->
                                      <MESSAGE_1></MESSAGE_1>
                                      <!--Optional:-->
                                      <MESSAGE_2></MESSAGE_2>
                                      <!--Optional:-->
                                      <MESSAGE_3></MESSAGE_3>
                                      <!--Optional:-->
                                      <MESSAGE_4></MESSAGE_4>
                                      <!--Optional:-->
                                      <MESSAGE_5></MESSAGE_5>
                                      <!--Optional:-->
                                      <MESSAGE_6></MESSAGE_6>
                                      <!--Optional:-->
                                      <MESSAGE_7></MESSAGE_7>
                                      <!--Optional:-->
                                      <MESSAGE_8></MESSAGE_8>
                                      <!--Optional:-->
                                      <MESSAGE_9></MESSAGE_9>
                                      <!--Optional:-->
                                      <MESSAGE_10></MESSAGE_10>
                                  </item>
                              </C_T_RETURN>
                          </urn:${urn}>
                      </SOAP:Body>
                  </SOAP:Envelope>`
      break;
    default:
      console.log('Sorry, we are out of ' + urn + '.');
  }
  
  return xmlRequest

}

// POSTING SAP
async function postingSAP(url, body){
  try {

    const axios = require("axios");

    const credential = {
      username: "basisxiqas",
      password: "12345678"
    }

    const config = { 
      headers : {
        'Content-Type': 'text/xml',
        'responseType': 'text',
      },
      auth: {
        username: credential.username,
        password: credential.password
      }
    }

    const resp = await axios.post(url, body, config)

    return {
      status : resp.status,
      message: "Success",
      data : resp.data
    }

  } catch (error) {
        // Error 😨

        if (error.response) {
          /*
           * The request was made and the server responded with a
           * status code that falls out of the range of 2xx
           */
          return {
            status : error.response.status,
            message: error.message,
            data : []
          }
      } else if (error.request) {
          /*
           * The request was made but no response was received, `error.request`
           * is an instance of XMLHttpRequest in the browser and an instance
           * of http.ClientRequest in Node.js
           */
          return {
            status : 500,
            message: "can't connect to sap network".toUpperCase(),
            data : []
          }
      } else {
          // Something happened in setting up the request and triggered an Error
          return {
            status : 500,
            message: error.message,
            data : []
          }
      }
  }
}

// GET SOAP RESPONSE DATA
function getXMLData(response) {
  const xml2js = require('xml2js');
// console.log(xmlString)
  let resSAP = {
    type: '',
    message : '',
    data : {
      E_DOCUMENTYEAR: '',
      E_DOCUMENTNUMBER: '',
      // ITEM: [],
    }
  }

  if(response.status == 200){
    
    const options = {
      explicitArray: false,
      tagNameProcessors: [xml2js.processors.stripPrefix]
    }

    xml2js.parseString(response.data, options, (err, result) => {

      if (err) throw err

      let soapBody = result.Envelope.Body;

      if (soapBody.$) delete soapBody.$

      resSAP.data.E_DOCUMENTYEAR = soapBody['ZFMCMS_FI_001.Response']['E_DOCUMENTYEAR'] ? soapBody['ZFMCMS_FI_001.Response']['E_DOCUMENTYEAR'] : "0000" 
      resSAP.data.E_DOCUMENTNUMBER = soapBody['ZFMCMS_FI_001.Response']['E_DOCUMENTNUMBER'] ? soapBody['ZFMCMS_FI_001.Response']['E_DOCUMENTNUMBER'] : ""

      if(soapBody['ZFMCMS_FI_001.Response']['C_T_RETURN']['item']){
      if (!Array.isArray(soapBody['ZFMCMS_FI_001.Response']['C_T_RETURN']['item'])) {
          // resSAP.data.ITEM.push(soapBody['ZFMCMS_FI_001.Response']['C_T_RETURN']['item'])
          resSAP.type = soapBody['ZFMCMS_FI_001.Response']['C_T_RETURN']['item']['TYPE']
          resSAP.message = soapBody['ZFMCMS_FI_001.Response']['C_T_RETURN']['item']['MESSAGE_1']
        } else {
          // resSAP.data.ITEM = soapBody['ZFMCMS_FI_001.Response']['C_T_RETURN']['item']
          resSAP.type = soapBody['ZFMCMS_FI_001.Response']['C_T_RETURN']['item'][0]['TYPE']
          resSAP.message = soapBody['ZFMCMS_FI_001.Response']['C_T_RETURN']['item'][0]['MESSAGE_1']
        }
      }

    });

  }else {

    resSAP.type = 'E'
    resSAP.message = response.message ? response.message : "aa"

  }


  return resSAP

}

module.exports = {
  encryptText,
  decryptText,
  getUniqueCode,
  generateXMLRequest,
  postingSAP,
  getXMLData
};
