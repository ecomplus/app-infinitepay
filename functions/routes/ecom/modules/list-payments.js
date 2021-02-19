const { baseUri } = require('../../../__env')
const addInstallments = require('../../../lib/payments/add-installments')

exports.post = ({ appSdk }, req, res) => {
  // https://apx-mods.e-com.plus/api/v1/list_payments/schema.json?store_id=100
  const { params, application } = req.body
  const amount = params.amount || {}

  const configError = (error, message) => {
    return res.status(409).send({
      error,
      message: `${message} (lojista deve configurar o aplicativo)`
    })
  }

  const config = Object.assign({}, application.data, application.hidden_data)
  if (!config.infinitepay_user) {
    return configError('NO_INFINITE_USER', 'Username da InfinitePay não configurado')
  }
  if (!config.infinitepay_api_key) {
    return configError('NO_INFINITE_KEY', 'Chave de API InfinitePay não configurada')
  }

  // https://apx-mods.e-com.plus/api/v1/list_payments/response_schema.json?store_id=100
  const response = {
    payment_gateways: []
  }

  // setup payment gateway object
  const gateway = {
    label: 'Cartão de crédito - InfinitePay',
    icon: `${baseUri}/infinitepay.png`,
    payment_method: {
      code: 'balance_on_intermediary',
      name: 'Cartão de crédito via link InfinitePay'
    },
    intermediator: {
      name: 'InfinitePay',
      link: 'https://infinitepay.io/',
      code: 'infinitepay'
    },
    ...config.gateway_options
  }

  const { installments, discount } = config
  if (installments) {
    // list all installment options and default one
    addInstallments(amount, installments, gateway, response)
  }

  if (discount && discount.value > 0 && (!amount.discount || discount.cumulative_discount !== false)) {
    gateway.discount = {
      apply_at: discount.apply_at,
      type: discount.type,
      value: discount.value
    }
    if (discount.apply_at !== 'freight') {
      // set as default discount option
      response.discount_option = {
        ...gateway.discount,
        label: config.discount_option_label || 'InfinitePay'
      }
    }

    if (discount.min_amount) {
      // check amount value to apply discount
      if (amount.total < discount.min_amount) {
        delete gateway.discount
      }
      if (response.discount_option) {
        response.discount_option.min_amount = discount.min_amount
      }
    }
  }

  response.payment_gateways.push(gateway)
  return res.send(response)
}
