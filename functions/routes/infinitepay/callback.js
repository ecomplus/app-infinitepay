const axios = require('axios')
// Encrypt package
const cryptoJS = require('crypto-js')

const getAppData = require('../../lib/store-api/get-app-data')

const getTransactionPix = (collectionTransactions, transactionId) => {
  return new Promise((resolve, reject) => {
    const transaction = collectionTransactions.doc(transactionId)
    transaction.get()
      .then((documentSnapshot) => {
        if (documentSnapshot.exists) {
          const storeId = documentSnapshot.data().storeId
          const orderId = documentSnapshot.data().orderId
          const secret = documentSnapshot.data().secret
          const transactionReference = documentSnapshot.data().transactionReference
          if (storeId && orderId && secret && transactionReference) {
            resolve({ storeId, orderId, secret, transactionReference })
          }
          reject(new Error('Transaction properties not found'))
        }
        reject(new Error('Transaction not found'))
      })
      .catch((e) => {
        console.error(e)
        reject(e)
      })
  })
}

exports.post = async ({ appSdk }, req, res) => {
  // https://gist.github.com/luisbebop/ca87e04da04bcf662f732b1b6848d6ca#integration-
  const transactionId = req.body && req.body.transaction_id
  const hasPix = req.query && req.query.pix
  const firestoreColl = 'infinitepay_transactions_pix'

  const callbackBody = req.body ? JSON.stringify(req.body) : ''
  console.log('>Body ', callbackBody, ' <')
  const callbackHeader = req.headers ? JSON.stringify(req.headers) : ''
  console.log('>Headers ', callbackHeader, ' <')

  console.log(`>> Callback Infinite: ${hasPix ? 'pix' : 'PaymentLink'} <`)

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
  } else if (hasPix && hasPix === 'confirm') {
    const collectionTransactions = require('firebase-admin').firestore().collection(firestoreColl)
    console.log('>Has Pix: ', hasPix, ' <')
    const pixId = req.body.transaction_identification
    if (pixId) {
      let storeId, orderId, secret, transactionReference
      try {
        const pixInfo = await getTransactionPix(collectionTransactions, pixId)
        storeId = pixInfo.storeId
        orderId = pixInfo.orderId
        secret = pixInfo.secret
        transactionReference = pixInfo.transactionReference
      } catch (e) {
        res.send({
          status: 500,
          msg: '#Erro get transaction'
        })
      }
      const storeID = parseInt(storeId, 10)
      console.log('>PIX #s: ', storeId, ' o: ', orderId, ' code: ', transactionReference, ' <')
      if (storeID > 100 && secret && orderId && transactionReference) {
      // https://www.infinitepay.io/docs#validacao-de-callback-do-pix-pago
        const signature = req.headers['x-callback-signature']
        const generatedSignature = cryptoJS.HmacSHA256(req.body, secret).toString()
        if (generatedSignature === signature) {
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
              // console.log('>>Transaction ', JSON.stringify(transaction), ' <<')
              const resource = `orders/${order._id}/payments_history.json`
              const method = 'POST'
              const body = {
                date_time: new Date().toISOString(),
                status: 'paid',
                flags: ['infinitepay']
              }
              if (transaction) {
                body.transaction_id = transaction._id
              }
              return appSdk.apiRequest(storeId, resource, method, body)
            })
            .then(() => {
              const transaction = order.transactions.find(({ intermediator }) => {
                return intermediator && intermediator.transaction_reference === String(transactionReference)
              })
              let notes = transaction.notes
              notes = notes.replaceAll('display:block', 'display:none') // disable QR Code
              notes = `${notes} # PIX Aprovado`
              transaction.notes = notes
              const resource = `orders/${order._id}.json`
              const method = 'PATCH'
              const body = {
                transactions: order.transactions
              }
              // Update to disable QR Code
              appSdk.apiRequest(storeId, resource, method, body).catch(console.error)
              res.sendStatus(200)
            })
            .catch(error => {
              const { response, config } = error
              let status
              if (response) {
                status = response.status
                const err = new Error(`#${storeId} InfinitePay callback PIX error ${status}`)
                err.url = config && config.url
                err.status = status
                err.response = JSON.stringify(response.data)
                console.error(err)
              }
              res.send({
                status: status || 500,
                msg: `#${storeId} InfinitePay callback PIX error`
              })
            })
        } else {
          res.send({
            status: 403,
            msg: `#${storeId} InfinitePay callback PIX error, signature invalid `
          })
        }
      }
      res.sendStatus(404)
    }
    res.sendStatus(404)
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
