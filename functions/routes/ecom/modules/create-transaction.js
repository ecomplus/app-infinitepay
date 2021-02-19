const { baseUri } = require('../../../__env')
const axios = require('axios')

exports.post = ({ appSdk }, req, res) => {
  const { params, application } = req.body
  const { storeId } = req
  const config = Object.assign({}, application.data, application.hidden_data)

  const orderId = params.order_id
  const { amount } = params
  console.log('> Transaction #', storeId, orderId)

  const transaction = {
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

  res.send({
    redirect_to_payment: true,
    transaction
  })

  // https://gist.github.com/luisbebop/ca87e04da04bcf662f732b1b6848d6ca#integration-
  // https://infinitepay.io/docs#listar-wallets
  const infinitepayAxiosConfig = {
    headers: {
      Authorization: config.infinitepay_api_key
    }
  }
  const callbackUrl = `${baseUri}/infinitepay/callback`
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
