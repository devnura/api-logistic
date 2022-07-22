
// GET PARTNER, MERCHANT, TERMINAL FROM TID
const generateInvoice = async (invoiceDate, trx) => {

  let result = await trx.select(trx.raw(`* FROM payment.sp_payment_req_topup_online('${invoiceDate}')`))

  return result;

}

const insertPostingEt = async (invoice, trx) => {
  console.log("invoice : ", invoice)
  let type = ['S', 'H']
  let et = []
  let posting_et = []
  type.forEach((item, index) => {
    let data = {
      file_name: invoice.file_name,
      tcode: invoice.tcode,
      reversal: invoice.reversal,
      doc_type: invoice.doc_type,
      fiscal_year: invoice.fisc_year,
      posting_date: invoice.posting_date,
      doc_date: invoice.doc_date,
      no_dok: invoice.c_invoice_no,
      reference: invoice.c_invoice_no,
      amount: invoice.amount,
      ba: invoice.ba,
      indeks: (index+1),
      totalidx: type.length,
      doc_header_text: `POSTING INVOICE CMS ${invoice.c_invoice_no}`,
      pos_status : null
    }
    
    if(item == 'H'){
      data = {...data, ...{
        text: `KREDIT INVOICE CMS ${invoice.doc_header_text}`,
        debit_kredit: item,
        account: invoice.c_account_topup,
        customer: null
      }}
    }else{
      data = {...data, ...{
        text: `DEBIT INVOICE CMS ${invoice.doc_header_text}`,
        debit_kredit: item,
        account: null,
        customer: invoice.c_account_code_topup
      }}
    }

    et.push(data)

  }); 

  posting_et = await trx('public.posting_et').insert(et, ['indeks', 'customer', 'account', 'ba', 'fiscal_year', 'amount', 'no_dok', 'text', 'debit_kredit'])

  return posting_et[0]

}

const getPostingEt = async(trx) => {

  const result =  await trx('public.posting_et').select([
    'doc_header_text',
    'ba',
    'doc_date',
    'posting_date',
    'fiscal_year',
    trx.raw(`TO_CHAR(doc_date::DATE, 'MM') AS fis_period`),
    'doc_type',
    'reference',
    'tcode',
    'amount',
    trx.raw(`'IDR' AS currency`),
    trx.raw(`(SELECT customer FROM public.posting_et where no_dok = no_dok and debit_kredit = 'S') as customer `),
    trx.raw(`(SELECT account FROM public.posting_et where no_dok = no_dok and debit_kredit = 'H') as account `),
    trx.raw(`(SELECT text FROM public.posting_et where no_dok = no_dok and debit_kredit = 'S') as text1`),
    trx.raw(`(SELECT text FROM public.posting_et where no_dok = no_dok and debit_kredit = 'H') as text2`)
  ])
  .where('tcode', '=', "FB70")
  .where('status0', '!=', "S")
  .orWhere({
    'status0' : null,
  })
  .groupBy(['doc_header_text', 'ba', 'doc_header_text', 'tcode', 'ba', 'amount', 'posting_date', 'doc_date', 'doc_type', 'fiscal_year', 'reference'])

  return result
  
}

const setReturnSAP =  async (invoice, resSAP, trx) => {
  let t_invoice = {}
  let t_load_balance = {}

  if(resSAP.type == 'S'){
    // update invoice
    t_invoice = await trx('payment.t_d_invoice').update({
      c_return_sap: resSAP.data.E_DOCUMENTNUMBER
    }, ['c_invoice_no','c_return_sap'])
    .where({
      c_invoice_no: invoice.c_invoice_no
    });
    
    // update load balance
    t_load_balance = await trx('trx.t_d_load_balance').update({
      c_return_sap: resSAP.data.E_DOCUMENTNUMBER
    }, ['c_load_balance_no', 'c_return_sap'])
    .whereRaw(`c_load_balance_no IN (SELECT c_load_balance_no FROM payment.t_d_payment_request_topup_online WHERE c_payment = '${invoice.c_invoice_no}')`)

  }

  // update posting et
  const posting_et = await trx('public.posting_et').update({
    pos_status : resSAP.type == 'S' ? 0 : 3,
    status0 : resSAP.type,
    no_doksap : resSAP.data.E_DOCUMENTNUMBER ? resSAP.data.E_DOCUMENTNUMBER : null,
    status1 : resSAP.message ? resSAP.message : null
  }, ['file_name','status0']).where({
    reference: invoice.c_invoice_no
  })

  return {
    invoice : t_invoice,
    load_balance : t_load_balance,
    posting_et : posting_et
  }
  
}

module.exports = {
  generateInvoice,
  insertPostingEt,
  setReturnSAP,
  getPostingEt
};