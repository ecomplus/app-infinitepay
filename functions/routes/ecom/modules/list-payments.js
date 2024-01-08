const { baseUri } = require('../../../__env')
const fs = require('fs')
const path = require('path')
const addInstallments = require('../../../lib/payments/add-installments')
const { getToken } = require('../../../lib/inifinitepay/create-acess')

exports.post = async ({ appSdk }, req, res) => {
  const { storeId } = req
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
  const disableLinkPayment = config.payment_link ? config.payment_link.disable : false

  /* if (!config.infinitepay_user && !disableLinkPayment) {
    return configError('NO_INFINITE_USER', 'Username da InfinitePay não configurado')
  }
  if ((!config.client_id || !config.client_secret)) {
    return configError('NO_INFINITE_KEY', 'Client ID/Client Secrect InfinitePay não configurado')
  } */

  // TODO: Disable link Payment, see payment link documentation with JWT

  // if (!config.infinitepay_api_key && !disableLinkPayment) {
  //   return configError('NO_INFINITE_KEY', 'Chave de API InfinitePay não configurada')
  // }

  if (config.pix && config.pix.enable && !config.pix.key_pix) {
    return configError('NO_INFINITE_KEY_PIX', 'Chave Pix InfinitePay não configurada')
  }

  const isSandbox = false // TODO: false
  console.log('> List Payment #', storeId, `${isSandbox ? '-isSandbox' : ''}`)

  const tokenJWT = await getToken(config.client_id, config.client_secret,
    isSandbox, storeId, 'card')

  // https://apx-mods.e-com.plus/api/v1/list_payments/response_schema.json?store_id=100
  const response = {
    payment_gateways: []
  }

  const listPaymentMethods = ['payment_link', 'credit_card', 'account_deposit']

  const intermediator = {
    name: 'InfinitePay',
    link: 'https://infinitepay.io/',
    code: 'infinitepay'
  }

  // setup payment gateway object
  listPaymentMethods.forEach(paymentMethod => {
    const isPix = paymentMethod === 'account_deposit'
    const isCreditCard = paymentMethod === 'credit_card'
    const isLinkPayment = paymentMethod === 'payment_link'

    const methodConfig = isPix ? config.pix : (config[paymentMethod] || {})
    const minAmount = methodConfig?.min_amount || 0

    const methodEnable = isPix ? methodConfig.enable : !methodConfig.disable
    // TODO: See payment link documentation with JWT
    // const methodEnable = isPix ? methodConfig.enable : (isLinkPayment ? false : !methodConfig.disable)

    const validateAmount = amount.total ? (amount.total >= minAmount) : true // Workaround for showcase

    if (methodEnable && validateAmount) {
      const label = methodConfig.label ? methodConfig.label : (isCreditCard ? 'Cartão de crédito' : (isLinkPayment ? 'Cartão de crédito - Link de Pagamento' : 'Pix'))

      const gateway = {
        label,
        icon: methodConfig.icon,
        text: methodConfig.text,
        payment_method: {
          code: isLinkPayment ? 'balance_on_intermediary' : paymentMethod,
          name: `${label} - ${intermediator.name}`
        },
        intermediator
      }
      console.log('get gateway', JSON.stringify(gateway))

      const { installments, discount } = config
      if (installments && (isCreditCard || isLinkPayment)) {
        // list all installment options and default one
        addInstallments(amount, installments, gateway, response)
      }

      if (isPix && !gateway.icon) {
        gateway.icon = 'https://us-central1-ecom-pix.cloudfunctions.net/app/pix.png'
      }

      if (isCreditCard) {
        if (!gateway.icon) {
          gateway.icon = `${baseUri}/infinitepay.png`
        }
        //
        gateway.js_client = {
          script_uri: `https://ipayjs.infinitepay.io/${isSandbox ? 'development' : 'production'}/ipay-latest.min.js`,
          onload_expression: `window._infiniteJwtTokenCard="${tokenJWT}"; window._infiniteCardSandbox="${isSandbox}";` +
            fs.readFileSync(path.join(__dirname, '../../../public/onload-expression.min.js'), 'utf8'),
          cc_hash: {
            function: '_infiniteHashCard',
            is_promise: true
          }
        }
      }

      if (isPix && discount && discount.value > 0 && (!amount.discount || discount.cumulative_discount !== false)) {
        gateway.discount = {
          apply_at: discount.apply_at,
          type: discount.type,
          value: discount.value
        }
        if (discount.apply_at !== 'freight') {
          // set as default discount option
          response.discount_option = {
            ...gateway.discount,
            label: config.discount_option_label || `${label}`
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
      console.log('get label', JSON.stringify(gateway))
      response.payment_gateways.push(gateway)
    }
  })
  return res.send(response)
}
