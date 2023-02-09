const ethSigUtil = require('@metamask/eth-sig-util')
const SIGN_COPY = 'Sign the message below to confirm your account address.'
const SIGN_COPY_NEW =
  'Welcome to Lithium, please sign the transaction to authenticate your account, no gas will be required'
const jwt = require('jsonwebtoken')
const { sanitizeEntity } = require('strapi-utils/lib')

const checkWalletExists = (strapi, WalletAddress) =>
  strapi.query('account').findOne({
    WalletAddress
  })

const verifyWallet = (signedMessage, walletAddress) => {
  const recovered = ethSigUtil.recoverPersonalSignature({
    data: SIGN_COPY,
    signature: signedMessage
  })
  const recoveredNewCopy = ethSigUtil.recoverPersonalSignature({
    data: SIGN_COPY_NEW,
    signature: signedMessage
  })
  return (
    recovered.toLowerCase() === walletAddress.toLowerCase() ||
    recoveredNewCopy.toLowerCase() === walletAddress.toLowerCase()
  )
}

const createToken = (WalletAddress) =>
  jwt.sign({ WalletAddress }, process.env.TOKEN_KEY, {
    expiresIn: '30d'
  })

const handlePost = async (strapi, ctx, request, data, next) => {
  const { WalletAddress } = data

  const { header } = request

  const token = header['x-lithium-token']

  const decoded = jwt.verify(token, process.env.TOKEN_KEY)

  if (decoded?.WalletAddress !== WalletAddress)
    return ctx.throw(403, 'Invalid token')

  const account = await checkWalletExists(strapi, WalletAddress)
  if (account) return ctx.throw(400, 'User already exists')

  return await next()
}

const handleGet = async (strapi, ctx, request, url, next) => {
  if (url.split('?').length === 1)
    return ctx.throw(400, 'Can only request a single wallet')

  const walletAddressFromQuery = url.split('WalletAddress_in=')[1]

  const account = checkWalletExists(strapi, walletAddressFromQuery)

  const { header } = request

  if (!account) return ctx.response.badRequest('No Account Exists')

  if (!header?.['x-lithium-token'] && account)
    return ctx.response.badRequest('No token provided')

  const token = header['x-lithium-token']
  try {
    const decoded = jwt.verify(token, process.env.TOKEN_KEY)
    if (decoded?.WalletAddress !== walletAddressFromQuery)
      return ctx.throw(403, 'Invalid token')
  } catch (e) {
    console.log(e, 'in catch block')
    console.log(e.message, 'in catch block type')
    const token = createToken(walletAddressFromQuery)
    data = { ...account }
    ctx.set('X-Lithium-Token', token)

    return ctx.response.badRequest('Needs new token')
  }

  const user = await strapi.query('account').findOne({
    WalletAddress: walletAddressFromQuery
  })

  delete user.token
  user.projects = user.projects.filter(
    ({ landingPageOnly }) => !landingPageOnly
  )

  ctx.response.body = [sanitizeEntity(user, { model: strapi.models.account })]
  // return
  return next()
}

const handlePut = async (strapi, ctx, request, data, next) => {
  const { WalletAddress, Email, twitterHandle, discordHandle, telegramHandle } =
    data
  const account = checkWalletExists(strapi, WalletAddress)
  const { header } = request

  if (data?.signedMessage) {
    const { signedMessage } = data
    const isVerified = verifyWallet(signedMessage, WalletAddress)
    if (!isVerified) return ctx.throw(400, 'Invalid signature')
    const token = createToken(WalletAddress)
    data = { ...account }
    ctx.set('X-Lithium-Token', token)
    return ctx.response.badRequest('Needs new token')
  }

  if (!data?.signedMessage) {
    if (!header?.['x-lithium-token']) return ctx.throw(400, 'No token provided')
    const token = header['x-lithium-token']
    const decoded = jwt.verify(token, process.env.TOKEN_KEY)

    if (decoded?.WalletAddress !== WalletAddress)
      return ctx.throw(403, 'Invalid token')
  }

  return next()
}

module.exports = (strapi) => {
  return {
    initialize() {
      strapi.app.use(async (ctx, next) => {
        const { request } = ctx
        const { method, url } = request

        if (url.split('?')[0]?.split('/')?.[1] !== 'accounts')
          return await next()

        const { body: data } = request

        if (method === 'GET') return handleGet(strapi, ctx, request, url, next)
        if (method === 'PUT') return handlePut(strapi, ctx, request, data, next)
        if (method === 'POST')
          return handlePost(strapi, ctx, request, data, next)

        await next()
      })
    }
  }
}
