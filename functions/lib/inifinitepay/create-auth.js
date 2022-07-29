module.exports = (clienId, clientSecret, scope, storeId, isSandbox) => new Promise((resolve, reject) => {
  //  https://github.com/ecomplus/app-infinitepay/issues/77#issuecomment-1189795488
  let accessToken
  const axios = require('./create-axios')(accessToken, isSandbox)
  const request = isRetry => {
    console.log(`>> Create Auth s:${storeId}-${scope}-Sandbox: ${isSandbox}`)
    axios.post('/v2/oauth/token', {
      grant_type: 'client_credentials',
      client_id: clienId,
      client_secret: clientSecret,
      scope
    })
      .then(({ data }) => resolve(data))
      .catch(err => {
        if (!isRetry && err.response && err.response.status >= 429) {
          setTimeout(() => request(true), 7000)
        }
        reject(err)
      })
  }
  request()
})
