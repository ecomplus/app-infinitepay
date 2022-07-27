const Axios = require('./create-axios')
const auth = require('./create-auth')
// typeScope ===  card, if scope card_tokenization
// typeScope === transaction, if scope for transaction

const firestoreColl = 'infinitepay_tokens'

const AxiosOrToken = (resolve, reject, clienId, clientSecret, isSandbox, storeId, typeScope, self) => {
  let scope = 'transactions'
  if (typeScope === 'card') {
    scope = 'card_tokenization'
  }

  let documentRef
  if (firestoreColl) {
    documentRef = require('firebase-admin')
      .firestore()
      .doc(`${firestoreColl}/${storeId}-${typeScope}`)
  }

  const authenticate = (accessToken, resolve) => {
    if (self) {
      const axios = Axios(accessToken, isSandbox)
      resolve(axios)
    } else {
      resolve(accessToken)
    }
  }

  const handleAuth = (resolve) => {
    console.log('> Infinite Auth ', storeId)
    auth(clienId, clientSecret, scope, storeId, isSandbox)
      .then((resp) => {
        authenticate(resp.access_token, resolve)
        if (documentRef) {
          documentRef.set({ ...resp, isSandbox }).catch(console.error)
        }
      })
      .catch(reject)
  }

  if (documentRef) {
    documentRef.get()
      .then((documentSnapshot) => {
        const data = documentSnapshot.data() || null
        if (documentSnapshot.exists && data && data.expires_in && new Date(data.expires_in).getTime() > Date.now()) {
          authenticate(data.access_token, resolve)
        } else {
          handleAuth(resolve)
        }
      })
      .catch(console.error)
  } else {
    handleAuth(resolve)
  }
}

const CreateAxios = (clienId, clientSecret, isSandbox, storeId, typeScope) => {
  return new Promise((resolve, reject) => {
    AxiosOrToken(resolve, reject, clienId, clientSecret, isSandbox, storeId, typeScope, this)
  })
}

const getToken = (clienId, clientSecret, isSandbox, storeId, typeScope) => {
  return new Promise((resolve, reject) => {
    AxiosOrToken(resolve, reject, clienId, clientSecret, isSandbox, storeId, typeScope)
  })
}

module.exports = {
  CreateAxios,
  getToken
}
