// Encrypt package
const cryptoJS = require('crypto-js')

const secret = '1173-632df57973321213f88a516d-1663956346196'
const body = {
  transaction_identification: 'Wrx2hTQQmBlPufpJF2wSb8t1v',
  is_internal: true,
  wallet_id: 'accYTOQ741Y4WK1',
  amount: 5817,
  credit_party: {
    key: 'ecomplus@meu.pix',
    name: 'E-Com Club Softwares para e-commerce LTDA',
    wallet_id: 'accYTOQ741Y4WK1'
  },
  debit_party: {
    key: 'automation@meu.pix',
    name: 'CONDOMNIO DOS PINHEIROS - BLOCO IV',
    wallet_id: 'accNBMKUBXGVS48'
  }
}
const body2 = '{"transaction_identification":"cvcl77m8bscnUNguTRV549egt","is_internal":true,"wallet_id":"accYTOQ741Y4WK1","amount":5817,"credit_party":{"key":"ecomplus@meu.pix","name":"E-Com Club Softwares para e-commerce LTDA","wallet_id":"accYTOQ741Y4WK1"},"debit_party":{"key":"automation@meu.pix","name":"CONDOMNIO DOS PINHEIROS - BLOCO IV","wallet_id":"accNBMKUBXGVS48"}}'

const generatedSignature = cryptoJS.HmacSHA256(body2, secret).toString()

// console.log('>> ', generatedSignature)

// let teste = '<img src="https://gerarqrcodepix.com.br/api/v1?brcode=00020101021226600014BR.GOV.BCB.PIX0116ecomplus@meu.pix0218Pagamento ecomplus520400005303986540566.235802BR5925E-Com Club Softwares para6014BELO HORIZONTE61083011004462290525nQTYAsd8NFhcInBFU5rb9y9ha630454CF&tamanho=256" style="display:block;margin:0 auto"><lable style="display:block;margin:1 auto"> 00020101021226600014BR.GOV.BCB.PIX0116ecomplus@meu.pix0218Pagamento ecomplus520400005303986540566.235802BR5925E-Com Club Softwares para6014BELO HORIZONTE61083011004462290525nQTYAsd8NFhcInBFU5rb9y9ha630454CF </lable>'
// teste = teste.replaceAll('display:block', 'display:none')

console.log('>> ', generatedSignature)

// const test = 2.99

// console.log('> ', Math.floor(test))
