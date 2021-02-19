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
}
