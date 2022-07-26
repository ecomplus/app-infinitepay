const axios = require('axios')
module.exports = (accessToken, isSandbox) => {
  // https://github.com/ecomplus/app-infinitepay/issues/77#issuecomment-1189795488

  const headers = {
    'Content-Type': 'application/json'
  }
  if (accessToken) {
    console.log('> token ', accessToken)
    headers.Authorization = `Bearer ${accessToken}`
  }
  console.log('CreateAxios ', isSandbox)
  return axios.create({
    baseURL: `https://api${isSandbox ? '-staging' : ''}.infinitepay.io`,
    headers
  })
}
