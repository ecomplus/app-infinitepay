const axios = require('axios')
// Encrypt package
const cryptoJS = require('crypto-js')

const getAppData = require('../../lib/store-api/get-app-data')

exports.post = ({ appSdk }, req, res) => {
  // https://gist.github.com/luisbebop/ca87e04da04bcf662f732b1b6848d6ca#integration-
  const transactionId = req.body && req.body.transaction_id
  const hasPix = req.query && req.query.pix
  if (transactionId && !hasPix) {
    const { metadata } = req.body
    if (metadata && /[\d]+::[a-f0-9]+/.test(metadata)) {
      let [storeId, orderId] = metadata.split('::')
      storeId = parseInt(storeId, 10)

      if (storeId > 100) {
        console.log('> Callback #', storeId, orderId)
        let infinitepayTransaction, order
        // read configured E-Com Plus app data
        return getAppData({ appSdk, storeId })
          .then(config => {
            // double check InfinitePay transaction
            // https://infinitepay.io/docs#mostrar-transacao
            return axios.get(`https://api.infinitepay.io/v1/transactions/${transactionId}`, {
              headers: {
                Authorization: config.infinitepay_api_key
              }
            }).then(({ data }) => {
              infinitepayTransaction = data
              return config
            })
          })

          .then(config => {
            // get E-Com Plus order
            const resource = `orders/${orderId}.json`
            return appSdk
              .apiRequest(storeId, resource)
              .then(({ response }) => {
                order = response.data
                return config
              })
          })

          .then(() => {
            // add new transaction status to payment history
            const transaction = order.transactions.find(({ intermediator }) => {
              return intermediator && intermediator.transaction_id === String(transactionId)
            })
            const resource = `orders/${order._id}/payments_history.json`
            const method = 'POST'
            const body = {
              date_time: new Date().toISOString(),
              status: parseStatus(infinitepayTransaction.status),
              flags: ['infinitepay']
            }
            if (transaction) {
              body.transaction_id = transaction._id
            }
            return appSdk.apiRequest(storeId, resource, method, body)
          })

          .then(() => {
            res.sendStatus(200)
          })

          .catch(error => {
            const { response, config } = error
            let status
            if (response) {
              status = response.status
              const err = new Error(`#${storeId} InfinitePay callback error ${status}`)
              err.url = config && config.url
              err.status = status
              err.response = JSON.stringify(response.data)
              console.error(err)
            } else {
              if (error.appWithoutAuth) {
                status = 204
              }
              console.error(error)
            }
            if (!res.headersSent) {
              res.sendStatus(status || 500)
            }
          })
      }
    }

    const msg = `Unexptected or undefined metadata '${JSON.stringify(metadata)}'`
    console.log(`> Callback ignored: ${msg}`)
    return res.status(203).send(msg)
  } else if (hasPix) {
    const { metadata } = req.body
    if (metadata && /[\d]+::[a-f0-9]+/.test(metadata)) {
      let [storeId, orderId, transactionReference] = metadata.split('::')
      storeId = parseInt(storeId, 10)
      if (storeId > 100) {
        console.log('> Callback PIX #s:', storeId, ' o:', orderId)
        if (hasPix === 'confirm') {
          const secret = Buffer.from(`${storeId}-${orderId}`, 'base64').toString()
          const signature = req.headers['X-Callback-Signature']
          const generatedSignature = cryptoJS.HmacSHA256(req.body, secret)
          console.log('>> ', (generatedSignature === signature))
          const test = true // TODO: remove
          if (test) {
            let order
            return getAppData({ appSdk, storeId })
              .then(config => {
                // get E-Com Plus order
                const resource = `orders/${orderId}.json`
                return appSdk
                  .apiRequest(storeId, resource)
                  .then(({ response }) => {
                    order = response.data
                    return config
                  })
              })
              .then(() => {
                // add new transaction status to payment history
                const transaction = order.transactions.find(({ intermediator }) => {
                  return intermediator && intermediator.transaction_reference === String(transactionReference)
                })
                console.log('>>Transaction ', transaction)
                // const resource = `orders/${order._id}/payments_history.json`
                // const method = 'POST'
                // const body = {
                //   date_time: new Date().toISOString(),
                //   status: 'paid',
                //   flags: ['infinitepay']
                // }
                // if (transaction) {
                //   body.transaction_id = transaction._id
                // }
                // return appSdk.apiRequest(storeId, resource, method, body)
              })
              // .then(() => {
              //   res.sendStatus(200)
              // })
              // .catch(error => {
              //   const { response, config } = error
              //   let status
              //   if (response) {
              //     status = response.status
              //     const err = new Error(`#${storeId} InfinitePay callback PIX error ${status}`)
              //     err.url = config && config.url
              //     err.status = status
              //     err.response = JSON.stringify(response.data)
              //     console.error(err)
              //   } else {
              // })
          }
        }
      }
    }
  }

  res.sendStatus(403)
}

const parseStatus = infinitepayStatus => {
  switch (infinitepayStatus) {
    case 'approved':
      return 'paid'
    case 'processing':
    case 'analyzing':
      return 'under_analysis'
    case 'authorized':
    case 'paid':
    case 'refunded':
      return infinitepayStatus
    case 'waiting_payment':
      return 'pending'
    case 'pending_refund':
      return 'in_dispute'
    case 'refused':
      return 'unauthorized'
    case 'chargedback':
      return 'refunded'
    case 'pending_review':
      return 'authorized'
  }
  return 'unknown'
}
