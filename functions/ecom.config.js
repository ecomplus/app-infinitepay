/* eslint-disable comma-dangle, no-multi-spaces, key-spacing */

/**
 * Edit base E-Com Plus Application object here.
 * Ref.: https://developers.e-com.plus/docs/api/#/store/applications/
 */

const app = {
  app_id: 110373,
  title: 'InfinitePay Link',
  slug: 'infinitepay',
  type: 'external',
  state: 'active',
  authentication: true,

  /**
   * Uncomment modules above to work with E-Com Plus Mods API on Storefront.
   * Ref.: https://developers.e-com.plus/modules-api/
   */
  modules: {
    /**
     * Triggered to calculate shipping options, must return values and deadlines.
     * Start editing `routes/ecom/modules/calculate-shipping.js`
     */
    // calculate_shipping:   { enabled: true },

    /**
     * Triggered to validate and apply discount value, must return discount and conditions.
     * Start editing `routes/ecom/modules/apply-discount.js`
     */
    // apply_discount:       { enabled: true },

    /**
     * Triggered when listing payments, must return available payment methods.
     * Start editing `routes/ecom/modules/list-payments.js`
     */
    list_payments:        { enabled: true },

    /**
     * Triggered when order is being closed, must create payment transaction and return info.
     * Start editing `routes/ecom/modules/create-transaction.js`
     */
    create_transaction:   { enabled: true },
  },

  /**
   * Uncomment only the resources/methods your app may need to consume through Store API.
   */
  auth_scope: {
    'stores/me': [
      'GET'            // Read store info
    ],
    procedures: [
      'POST'           // Create procedures to receive webhooks
    ],
    products: [
      // 'GET',           // Read products with public and private fields
      // 'POST',          // Create products
      // 'PATCH',         // Edit products
      // 'PUT',           // Overwrite products
      // 'DELETE',        // Delete products
    ],
    brands: [
      // 'GET',           // List/read brands with public and private fields
      // 'POST',          // Create brands
      // 'PATCH',         // Edit brands
      // 'PUT',           // Overwrite brands
      // 'DELETE',        // Delete brands
    ],
    categories: [
      // 'GET',           // List/read categories with public and private fields
      // 'POST',          // Create categories
      // 'PATCH',         // Edit categories
      // 'PUT',           // Overwrite categories
      // 'DELETE',        // Delete categories
    ],
    customers: [
      // 'GET',           // List/read customers
      // 'POST',          // Create customers
      // 'PATCH',         // Edit customers
      // 'PUT',           // Overwrite customers
      // 'DELETE',        // Delete customers
    ],
    orders: [
      'GET',           // List/read orders with public and private fields
      // 'POST',          // Create orders
      'PATCH',         // Edit orders
      // 'PUT',           // Overwrite orders
      // 'DELETE',        // Delete orders
    ],
    carts: [
      // 'GET',           // List all carts (no auth needed to read specific cart only)
      // 'POST',          // Create carts
      // 'PATCH',         // Edit carts
      // 'PUT',           // Overwrite carts
      // 'DELETE',        // Delete carts
    ],

    /**
     * Prefer using 'fulfillments' and 'payment_history' subresources to manipulate update order status.
     */
    'orders/fulfillments': [
      // 'GET',           // List/read order fulfillment and tracking events
      // 'POST',          // Create fulfillment event with new status
      // 'DELETE',        // Delete fulfillment event
    ],
    'orders/payments_history': [
      // 'GET',           // List/read order payments history events
      'POST',          // Create payments history entry with new status
      // 'DELETE',        // Delete payments history entry
    ],

    /**
     * Set above 'quantity' and 'price' subresources if you don't need access for full product document.
     * Stock and price management only.
     */
    'products/quantity': [
      // 'GET',           // Read product available quantity
      // 'PUT',           // Set product stock quantity
    ],
    'products/variations/quantity': [
      // 'GET',           // Read variaton available quantity
      // 'PUT',           // Set variation stock quantity
    ],
    'products/price': [
      // 'GET',           // Read product current sale price
      // 'PUT',           // Set product sale price
    ],
    'products/variations/price': [
      // 'GET',           // Read variation current sale price
      // 'PUT',           // Set variation sale price
    ],

    /**
     * You can also set any other valid resource/subresource combination.
     * Ref.: https://developers.e-com.plus/docs/api/#/store/
     */
  },

  admin_settings: {
    infinitepay_user: {
      schema: {
        type: 'string',
        maxLength: 255,
        title: 'Username na InfinitePay',
        description: 'Seu usuário (@) para link de pagamento'
      },
      hide: false
    },
    infinitepay_api_key: {
      schema: {
        type: 'string',
        maxLength: 255,
        title: 'Chave de API InfinitePay'
      },
      hide: true
    },
    client_id: {
      schema:{
        type: 'string',
        maxLength: 255,
        title: 'Client ID ',
        description: 'Seu Client ID de acesso a API do Infinitepay, solicitação via e-mail: dev@infinitepay.io',
      },
      hide: true
    },
    client_secret: {
      schema:{
        type: 'string',
        maxLength: 255,
        title: 'Client Secret',
        description: 'Seu Client Secret de acesso a API do Infinitepay, solicitação via e-mail: dev@infinitepay.io',
      },
      hide: true
    },
    discount: {
      schema: {
        type: 'object',
        required: [
          'value'
        ],
        additionalProperties: false,
        properties: {
          apply_at: {
            type: 'string',
            enum: [
              'total',
              'subtotal',
              'freight'
            ],
            default: 'subtotal',
            title: 'Aplicar desconto em',
            description: 'Em qual valor o desconto deverá ser aplicado no checkout'
          },
          cumulative_discount: {
            type: 'boolean',
            default: true,
            title: 'Desconto cumulativo',
            description: 'Se a promoção poderá ser aplicada junto a cupons e campanhas de desconto'
          },
          min_amount: {
            type: 'integer',
            minimum: 1,
            maximum: 999999999,
            title: 'Pedido mínimo',
            description: 'Montante mínimo para aplicar o desconto'
          },
          type: {
            type: 'string',
            enum: [
              'percentage',
              'fixed'
            ],
            default: 'percentage',
            title: 'Tipo de desconto',
            description: 'Desconto com valor percentual ou fixo'
          },
          value: {
            type: 'number',
            minimum: -99999999,
            maximum: 99999999,
            title: 'Valor do desconto',
            description: 'Valor percentual ou fixo a ser descontado, dependendo to tipo configurado'
          }
        },
        title: 'Desconto',
        description: 'Desconto a ser aplicado para pagamentos via Pix'
      },
      hide: false
    },
    installments: {
      schema: {
        type: 'object',
        required: [
          'max_number'
        ],
        additionalProperties: false,
        properties: {
          min_installment: {
            type: 'number',
            minimum: 1,
            maximum: 99999999,
            default: 5,
            title: 'Parcela mínima',
            description: 'Valor mínimo da parcela'
          },
          max_number: {
            type: 'integer',
            minimum: 2,
            maximum: 999,
            title: 'Máximo de parcelas',
            description: 'Número máximo de parcelas'
          },
          monthly_interest: {
            type: 'number',
            minimum: 0,
            maximum: 9999,
            default: 0,
            title: 'Juros mensais',
            description: 'Taxa de juros mensal, zero para parcelamento sem juros'
          },
          max_interest_free: {
            type: 'integer',
            minimum: 2,
            maximum: 999,
            title: 'Parcelas sem juros',
            description: 'Mesclar parcelamento com e sem juros (ex.: até 3x sem juros e 12x com juros)'
          },
          interest_free_min_amount: {
            type: 'integer',
            minimum: 1,
            maximum: 999999999,
            title: 'Mínimo sem juros',
            description: 'Montante mínimo para parcelamento sem juros'
          }
        },
        title: 'Parcelamento',
        description: 'Opções de parcelamento no cartão via InfinitePay'
      },
      hide: false
    },
    payment_link: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          disable: {
            type: 'boolean',
            default: true,
            title: 'Desabilitar link de pagamento',
            description: 'Desabilitar pagamento com link de pagamento'
          },
          label: {
            type: 'string',
            maxLength: 50,
            title: 'Rótulo',
            description: 'Nome da forma de pagamento exibido para os clientes',
            default: 'Cartão de crédito - Link Pagamento InfinitePay'
          },
          text: {
            type: 'string',
            maxLength: 1000,
            title: 'Descrição',
            description: 'Texto auxiliar sobre a forma de pagamento, pode conter tags HTML'
          },
          icon: {
            type: 'string',
            maxLength: 255,
            format: 'uri',
            title: 'Ícone',
            description: 'Ícone customizado para a forma de pagamento, URL da imagem'
          }
        },
        title: 'Link de Pagamento',
        description: 'Opções de forma de pagamento via InfinitePay'
      },
      hide: false
    },
    credit_card: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          disable: {
            type: 'boolean',
            default: false,
            title: 'Desabilitar checkout transparente',
            description: 'Desabilitar pagamento com cartão via checkout transparente'
          },
          label: {
            type: 'string',
            maxLength: 50,
            title: 'Rótulo',
            description: 'Nome da forma de pagamento exibido para os clientes',
            default: 'Cartão de crédito - InfinitePay'
          },
          text: {
            type: 'string',
            maxLength: 1000,
            title: 'Descrição',
            description: 'Texto auxiliar sobre a forma de pagamento, pode conter tags HTML'
          },
          icon: {
            type: 'string',
            maxLength: 255,
            format: 'uri',
            title: 'Ícone',
            description: 'Ícone customizado para a forma de pagamento, URL da imagem'
          }
        },
        title: 'Checkout transparente',
        description: 'Configurações adicionais para cartão de crédito via checkout transparente'
      },
      hide: false
    },
    pix: {
      schema: {
        type: 'object',
        title: 'Pix',
        description: 'Configurações adicionais para Pix.',
        additionalProperties: false,
        properties: {
          enable: {
            type: 'boolean',
            default: false,
            title: 'Habilitar PIX',
            description: 'Habilitar pagamento com PIX via InfinitePay'
          },
          key_pix: {
            type: 'string',
            maxLength: 255,
            title: 'Chave Pix InfinitePay',
            description: 'Sua chave Pix da InfinitePay'
          },
          label: {
            type: 'string',
            maxLength: 50,
            title: 'Rótulo',
            description: 'Nome da forma de pagamento exibido para os clientes',
            default: 'Pix'
          },
          text: {
            type: 'string',
            maxLength: 1000,
            title: 'Descrição',
            description: 'Texto auxiliar sobre a forma de pagamento, pode conter tags HTML'
          },
          icon: {
            type: 'string',
            maxLength: 255,
            format: 'uri',
            title: 'Ícone',
            description: 'Ícone customizado para a forma de pagamento, URL da imagem'
          },
          min_amount: {
            type: 'number',
            minimum: 0,
            maximum: 999999999,
            title: 'Pedido mínimo',
            default: 0,
            description: 'Montante mínimo para listar meio de pagamento via Pix'
          }
        },
      },
      hide: false
    },
  }
}

/**
 * List of Procedures to be created on each store after app installation.
 * Ref.: https://developers.e-com.plus/docs/api/#/store/procedures/
 */

const procedures = []

/**
 * Uncomment and edit code above to configure `triggers` and receive respective `webhooks`:

const { baseUri } = require('./__env')

procedures.push({
  title: app.title,

  triggers: [
    // Receive notifications when new order is created:
    {
      resource: 'orders',
      action: 'create',
    },

    // Receive notifications when order financial/fulfillment status changes:
    {
      resource: 'orders',
      field: 'financial_status',
    },
    {
      resource: 'orders',
      field: 'fulfillment_status',
    },

    // Receive notifications when products/variations stock quantity changes:
    {
      resource: 'products',
      field: 'quantity',
    },
    {
      resource: 'products',
      subresource: 'variations',
      field: 'quantity'
    },

    // Receive notifications when cart is edited:
    {
      resource: 'carts',
      action: 'change',
    },

    // Receive notifications when customer is deleted:
    {
      resource: 'customers',
      action: 'delete',
    },

    // Feel free to create custom combinations with any Store API resource, subresource, action and field.
  ],

  webhooks: [
    {
      api: {
        external_api: {
          uri: `${baseUri}/ecom/webhook`
        }
      },
      method: 'POST'
    }
  ]
})

 * You may also edit `routes/ecom/webhook.js` to treat notifications properly.
 */

exports.app = app

exports.procedures = procedures
