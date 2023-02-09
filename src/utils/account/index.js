const jwt = require('jsonwebtoken')

const createTokenFromAccountId = (accountId) =>
  jwt.sign({ accountId }, process.env.TOKEN_KEY, {
    expiresIn: '30d'
  })

module.exports = { createTokenFromAccountId }
