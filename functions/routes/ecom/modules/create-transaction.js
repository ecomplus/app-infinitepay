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

  const isSandbox = false // TODO: false
  const infiniteAxios = CreateAxios(config.client_id, config.client_secret,
    isSandbox, storeId, 'transactions')

  const orderId = params.order_id
  const orderNumber = params.order_number
  const { amount, items, buyer, to } = params

  console.log('> Transaction #s:', storeId, ' #order:', orderId, ` ${isSandbox ? 'isSandbox' : ''} <`)

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

  let finalAmount = Math.floor(amount.total * 100) / 100
  let data = {}
  const paymentMethod = params.payment_method.code
  if (paymentMethod === 'credit_card') {
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
      country: 'BR',
      zip: to.zip
    }
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
        document_number: (data.customer && data.customer.document_number) || buyer.doc_number,
        email: data.customer.email,
        name: data.customer.first_name + ' ' + data.customer.last_name,
        phone_number: `${data.customer.phone_number}`,
        line1: to.street + ', ' + String(to.number) || 's/n',
        line2: to.complement || '',
        city: to.city,
        state: to.province || to.province_code,
        zip: to.zip,
        country: 'BR'
      }
    }

    data.billing_details = data.order.delivery_details

    infiniteAxios
      .then((axios) => {
        console.log('>> SendTransaction Infinite: ', data, ' <<')
        // url: 'https://cloudwalk.github.io/infinitepay-docs/#autorizando-um-pagamento',
        const headers = {
          Accept: 'application/json'
        }
        if (isSandbox) {
          headers.Env = 'mock'
        }
        // console.log('>>Before data: ', data)
        const timeout = 40000
        return axios.post('/v2/transactions', data, { headers, timeout })
      })
      .then((response) => {
        const { data } = response.data
        const { attributes } = data
        console.log('>>Response Attributes: ', attributes, ' <<<')
        const intermediator = {
          transaction_code: attributes.nsu,
          transaction_reference: attributes.authorization_code,
          payment_method: params.payment_method
        }
        if (attributes.authorization_id && attributes.authorization_code && attributes.authorization_code === '00') {
          console.log('Authorized transaction in InfinitePay #s:', storeId, ' o:', orderId)
          intermediator.transaction_id = attributes.authorization_id
          transaction.status = {
            current: 'paid',
            updated_at: attributes.created_at || new Date().toISOString()
          }
        } else {
          console.log(`Unauthorized transaction in InfinitePay code: 
          ${attributes.authorization_code} #s: ${storeId} o: ${orderId}`)

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
        console.log('Error: ', JSON.stringify(error), ' <<<')
        let { message } = error
        // Handle request timeout
        // https://github.com/axios/axios/blob/d59c70fdfd35106130e9f783d0dbdcddd145b58f/lib/adapters/http.js#L213-L218
        if (error.code && error.code === 'ECONNABORTED' && message.includes('timeout')) {
          transaction.intermediator = {
            payment_method: params.payment_method
          }
          transaction.status = {
            current: 'under_analysis',
            updated_at: new Date().toISOString()
          }
          res.send({
            redirect_to_payment: false,
            transaction
          })
        } else {
          console.log(error.response)
          // try to debug request error
          const errCode = 'INFINITEPAY_TRANSACTION_ERR'
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
        }
      })
  } else if (paymentMethod === 'account_deposit') {
    const firestoreColl = 'infinitepay_transactions_pix'

    const transactionReference = new Date().getTime()
    const secret = Buffer.from(`${storeId}-${orderId}-${transactionReference}`).toString('base64')
    console.log('>> secret: ', (isSandbox ? secret : ''))

    data.amount = Math.floor(finalAmount * 100)
    data.capture_method = 'pix'
    data.metadata = {
      origin: 'ecomplus',
      payment_method: 'pix',
      order_id: orderId,
      callback: {
        validate: `${callbackUrl}?pix=denied&order_id=${orderId}`,
        confirm: `${callbackUrl}?pix=confirm&order_id=${orderId}`,
        secret
      },
      orderId,
      storeId,
      transactionReference
    }

    infiniteAxios
      .then((axios) => {
        console.log('>> SendTransaction PIX Infinite: ', JSON.stringify(data), ' <<')
        // url: 'https://cloudwalk.github.io/infinitepay-docs/#autorizando-um-pagamento',
        const headers = {
          Accept: 'application/json'
        }
        return axios.post('/v2/transactions', data, { headers })
      })
      .then((response) => {
        const { data } = response.data
        const { attributes } = data
        console.log('>>Response Attributes: ', attributes, ' <<<')
        const intermediator = {
          transaction_code: attributes.nsu,
          payment_method: params.payment_method
        }
        const brCode = attributes.br_code
        const transactionId = attributes.nsu_host
        if (brCode && transactionId) {
          const pixKey = config.pix.key_pix

          const pixCodeHost = 'https://gerarqrcodepix.com.br/api/v1'

          const pixCodeParams = `nome=${encodeURIComponent(params.domain.split('.')[1])}
          &cidade=${encodeURIComponent(to.city || params.domain)}
          &txid=${transactionId}&chave=${pixKey}&valor=${parseFloat(finalAmount.toFixed(2))}`

          const qrCodeSrc = `${pixCodeHost}?saida=qr&${pixCodeParams}`

          // const qrCodeSrc = `https://gerarqrcodepix.com.br/api/v1?brcode=${brCode}&tamanho=256`
          transaction.notes = '<div style="display:block;margin:0 auto"> ' +
            `<img src="${qrCodeSrc}" style="display:block;margin:0 auto"> ` +
            `<input readonly type="text" id="pix-copy" value="${brCode}" />` +
            `<button type="button" class="btn btn-sm btn-light" onclick="let codePix = document.getElementById('pix-copy')
          codePix.select()
          document.execCommand('copy')">Copiar Pix</button></div>`

          console.log('Authorized transaction PIX in InfinitePay #s:', storeId, ' o:', orderId)
          intermediator.transaction_id = transactionId
          intermediator.transaction_reference = `${transactionReference}`
          transaction.status = {
            current: 'pending',
            updated_at: attributes.created_at || new Date().toISOString()
          }
          const updatedAt = new Date().toISOString()
          const documentRef = require('firebase-admin')
            .firestore()
            .doc(`${firestoreColl}/${transactionId}`)
          if (documentRef) {
            documentRef.set({
              isSandbox,
              orderId,
              orderNumber,
              storeId,
              secret,
              transactionReference,
              status: 'pending',
              updatedAt
            }).catch(console.error)
          }
        } else {
          console.log('Unauthorized transaction PIX in InfinitePay #s:', storeId, ' o:', orderId)
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
        console.log('Error: ', JSON.stringify(error), ' <<<')
        let { message } = error
        // try to debug request error
        const errCode = 'INFINITEPAY_TRANSACTION_ERR'
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
