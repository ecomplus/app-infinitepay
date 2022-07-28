const { baseUri } = require('../../../__env')
const axios = require('axios')
const addInstallments = require('../../../lib/payments/add-installments')
const { CreateAxios } = require('../../../lib/inifinitepay/create-acess')

exports.post = async ({ appSdk, admin }, req, res) => {
  /* JSON Schema reference for the Create Transaction module objects:
  * `params`: https://apx-mods.e-com.plus/api/v1/create_transaction/schema.json?store_id=100
  * `response`: https://apx-mods.e-com.plus/api/v1/create_transaction/response_schema.json?store_id=100
  */

  const { params, application } = req.body
  const { storeId } = req
  const config = Object.assign({}, application.data, application.hidden_data)

  const isSandbox = false
  const infiniteAxios = CreateAxios(config.client_id, config.client_secret,
    isSandbox, storeId, 'transactions')

  const orderId = params.order_id
  const orderNumber = params.order_number
  const { amount, items, buyer, to } = params

  console.log('> Transaction #', storeId, orderId, `${isSandbox ? 'isSandbox' : ''}`)

  const transaction = {
    amount: amount.total
  }
  const callbackUrl = `${baseUri}/infinitepay/callback`

  const transactionLink = {
    payment_link: `https://pay.infinitepay.io/${config.infinitepay_user}/` +
      amount.total.toFixed(2).replace('.', ',') +
      `?metadata=${storeId}::${orderId}`,
    intermediator: {
      payment_method: params.payment_method,
      transaction_reference: `@${config.infinitepay_user}`
    },
    currency_id: params.currency_id,
    currency_symbol: params.currency_symbol,
    amount: amount.total,
    status: {
      current: 'pending'
    }
  }

  let data = {}
  if (params.payment_method.code === 'credit_card') {
    const IPCustumer = {
      document_number: buyer.doc_number,
      first_name: buyer.fullname.split(' ')[0],
      last_name: buyer.fullname.split(' ')[buyer.fullname.split(' ').length - 1],
      email: buyer.email,
      phone_number: buyer.phone.number,
      address: to.street,
      complement: to.complement || undefined,
      city: to.city,
      state: to.province || to.province_code,
      zip: to.zip
    }
    let finalAmount = Math.floor(amount.total * 100) / 100
    let installmentsNumber = params.installments_number
    if (installmentsNumber > 1) {
      if (config.installments) {
        // list all installment options
        const { gateway } = addInstallments(amount, config.installments)
        const installmentOption = gateway.installment_options &&
          gateway.installment_options.find(({ number }) => number === installmentsNumber)
        if (installmentOption) {
          transaction.installments = installmentOption
          finalAmount = transaction.installments.total =
            Math.round(installmentOption.number * installmentOption.value * 100) / 100
        } else {
          installmentsNumber = 1
        }
      }
    }

    const payerIp = params.browser_ip
    data = JSON.parse(Buffer.from(params.credit_card.hash, 'base64'))
    data.metadata.risk.payer_ip = payerIp
    data.metadata.orderId = orderId
    data.metadata.orderNumber = orderNumber
    data.metadata.callback_url = callbackUrl

    data.customer = IPCustumer
    data.payment = {
      amount: Math.floor(finalAmount * 100),
      installments: installmentsNumber,
      payment_method: 'credit',
      capture_method: 'ecommerce'
    }
    const ipItems = []
    items.forEach(item => {
      ipItems.push({
        id: item.sku || item.variation_id || item.product_id,
        description: item.name || item.sku,
        amount: Math.floor((item.final_price || item.price) * 100),
        quantity: item.quantity
      })
    })

    data.order = {
      id: orderId,
      amount: Math.floor(finalAmount * 100),
      items: ipItems,
      delivery_details: {
        email: data.email,
        name: data.customer.first_name + ' ' + data.customer.last_name,
        phone_number: `${data.customer.phone_number}`,
        address: {
          line1: to.street + ', ' + String(to.number) || 's/n',
          line2: to.complement || '',
          city: to.city,
          state: to.province || to.province_code,
          zip: to.zip,
          country: 'BR'
        }
      }
    }

    infiniteAxios
      .then((axios) => {
        // url: 'https://cloudwalk.github.io/infinitepay-docs/#autorizando-um-pagamento',
        const headers = {
          Accept: 'application/json'
        }
        if (isSandbox) {
          headers.Env = 'mock'
        }
        return axios.post('/v2/transactions', data, { headers })
      })
      .then((response) => {
        const { data } = response.data
        const { attributes } = data
        const intermediator = {
          transaction_id: attributes.nsu,
          payment_method: params.payment_method
        }
        if (attributes.authorization_id) {
          console.log('Authorized transaction in InfinitePay')
          intermediator.transaction_code = attributes.authorization_id
          transaction.status = {
            current: 'paid',
            updated_at: attributes.created_at || new Date().toISOString()
          }
        } else {
          transaction.status = {
            current: 'unauthorized',
            updated_at: attributes.created_at || new Date().toISOString()
          }
        }
        transaction.intermediator = intermediator
        res.send({
          redirect_to_payment: false,
          transaction
        })
      })

      .catch(error => {
        console.log(error.response)
        // try to debug request error
        const errCode = 'INFINITEPAY_TRANSACTION_ERR'
        let { message } = error
        const err = new Error(`${errCode} #${storeId} - ${orderId} => ${message}`)
        if (error.response) {
          const { status, data } = error.response
          if (status !== 401 && status !== 403) {
            err.payment = JSON.stringify(transaction)
            err.status = status
            if (typeof data === 'object' && data) {
              err.response = JSON.stringify(data)
            } else {
              err.response = data
            }
          } else if (data && Array.isArray(data.errors) && data.errors[0] && data.errors[0].message) {
            message = data.errors[0].message
          }
        }
        console.error(err)
        res.status(409)
        res.send({
          error: errCode,
          message
        })
      })
  } else {
    res.send({
      redirect_to_payment: params.payment_method.code === 'balance_on_intermediary',
      transaction: transactionLink
    })
  }

  // https://gist.github.com/luisbebop/ca87e04da04bcf662f732b1b6848d6ca#integration-
  // https://infinitepay.io/docs#listar-wallets
  if (params.payment_method.code === 'balance_on_intermediary') {
    const infinitepayAxiosConfig = {
      headers: {
        Authorization: config.infinitepay_api_key
      }
    }
    axios.get('https://api.infinitepay.io/v1/wallets', infinitepayAxiosConfig)

      .then(({ data }) => {
        const { results } = data
        const merchantWallets = results.filter(({ role }) => role === 'merchant')
        if (!merchantWallets.find(wallet => wallet.callback_url === callbackUrl)) {
          const endpoint = `https://api.infinitepay.io/v1/wallets/${merchantWallets[0].wallet_id}`
          const data = {
            callback_url: callbackUrl
          }
          return axios.patch(endpoint, data, infinitepayAxiosConfig)
        }
      })

      .catch(error => {
        const { response, config } = error
        if (response) {
          const { status, data } = response
          const err = new Error(`Failed trying to setup #${storeId} InfinitePay callbacks (${status})`)
          err.url = config && config.url
          err.status = status
          err.response = JSON.stringify(data)
          return console.error(err)
        }
        console.error(error)
      })
  }
}
