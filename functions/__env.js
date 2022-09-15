// setup server and app options from Functions config (and mocks)
const { pkg, server } = require('firebase-functions').config()
const functionName = server.functionName || 'app'
const projectId = process.env.GCLOUD_PROJECT

module.exports = {
  functionName,
  operatorToken: server && server.operator_token,
  baseUri: (server && server.base_uri) ||
    `https://us-central1-${projectId}.cloudfunctions.net/${functionName}`,
  hostingUri: `https://${projectId}.web.app`,
  pkg: {
    ...pkg
  }
}
