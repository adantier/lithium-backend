'use strict'

const sendgridClient = require('@sendgrid/client')
sendgridClient.setApiKey(process.env.SENDGRID_API_KEY)

const {
  decodeToken
} = require('../../../middlewares/missionControl/taskSubmission/auth')
const {
  levels
} = require('../../../middlewares/missionControl/taskSubmission/levels')
const { createTokenFromAccountId } = require('../../../src/utils/account')
const { getUserDetails } = require('../../../src/utils/discord')
const { fetchAuth } = require('../../../src/utils/discord/oath')

const ethSigUtil = require('@metamask/eth-sig-util')
const SIGN_COPY = 'Sign the message below to confirm your account address.'
const SIGN_COPY_NEW =
  'Welcome to Lithium, please sign the transaction to authenticate your account, no gas will be required'
const jwt = require('jsonwebtoken')
const { sanitizeEntity } = require('strapi-utils/lib')
const { default: axios } = require('axios')

const isValidEmailAddress = (emailAddress) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)
}

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

const handleNewDiscordUser = async (ctx, code) => {
  const walletAddress = ''
  const updatedUser = await fetchAuth(ctx, code, walletAddress, true)
  const { discordHandle: discordUsername, userWithThisHandle } =
    await getUserDetails(ctx, walletAddress, updatedUser.id)
  if (!!userWithThisHandle) {
    await strapi.query('account').delete({ id: updatedUser.id })
    const createdLithiumToken = createTokenFromAccountId(userWithThisHandle.id)
    return {
      createdLithiumToken,
      username: userWithThisHandle.username,
      userId: userWithThisHandle.id,
      profilePictureUrl: userWithThisHandle.profilePictureUrl,
      walletAddress: userWithThisHandle?.walletAddress ?? ''
    }
  }

  const createdLithiumToken = createTokenFromAccountId(updatedUser.id)

  const userAlreadyExists = !!updatedUser?.profilePictureUrl

  const profilePictureUrl = userAlreadyExists
    ? updatedUser?.profilePictureUrl
    : `https://lithium-launchpad-cms.s3.eu-west-2.amazonaws.com/user-profile-pic-${updatedUser.id}.png`

  if (!userAlreadyExists)
    await strapi.query('account').update(
      { id: updatedUser.id },
      {
        profilePictureUrl,
        username: discordUsername
      }
    )

  return {
    createdLithiumToken,
    username: discordUsername,
    userId: updatedUser.id,
    profilePictureUrl,
    walletAddress: ''
  }
}

const handleDiscordExistingAccount = async (ctx, code, userId) => {
  const walletAddress = ''

  const userTokens = await fetchAuth(ctx, code, walletAddress, false, true)

  if (!userTokens) return ctx.throw(403, 'User not verified')

  const { discordUsername, discordId, discordHashNumber } =
    await getUserDetails(ctx, walletAddress, userId, userTokens)

  const userWithThisDiscordHandle = await strapi
    .query('account')
    .findOne({ discordHandle: discordUsername })

  if (userWithThisDiscordHandle)
    return {
      message: 'Discord handle already in use',
      user: sanitizeEntity(userWithThisDiscordHandle, {
        model: strapi.query('account').model
      }),
      newAuthToken: createTokenFromAccountId(userWithThisDiscordHandle?.id)
    }

  const { discord_access_token, discord_refresh_token, discord_expires_on } =
    userTokens

  const userWithThisId = await strapi.query('account').findOne({ id: userId })

  if (!userWithThisId) return ctx.throw(403, 'User not found')
  if (!userWithThisId?.token) {
    const createdToken = await strapi.query('tokens').create({
      discord_access_token,
      discord_refresh_token,
      discord_expires_on
    })

    await strapi.query('account').update(
      { id: userId },
      {
        discordHandle: discordUsername,
        discordId,
        discordHashNumber,
        tokens: [createdToken.id]
      }
    )
    return discordUsername
  }

  await strapi.query('account').update(
    { id: userId },
    {
      discordHandle: discordUsername,
      discordId,
      discordHashNumber
    }
  )

  await strapi.query('tokens').update(
    { id: userWithThisId?.token?.id },
    {
      discord_access_token,
      discord_refresh_token,
      discord_expires_on
    }
  )

  return discordUsername
}

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const oauthCallback = process.env.FRONTEND_URL
const oauth = require('../../../src/utils/twitter/oath')(oauthCallback)

module.exports = {
  requestTwitterToken: async (ctx) => {
    try {
      const { walletAddress, redirectUrl, userId } = ctx.request.body

      const lithiumToken = ctx.request.header['x-lithium-token']

      console.log('requestTwitterToken', { walletAddress, redirectUrl, userId })

      if (!redirectUrl) return ctx.throw(400, 'No redirect url provided')
      if (!lithiumToken) return ctx.throw(400, 'No token provided')

      const oauthWithRedirect = require('../../../src/utils/twitter/oath')(
        redirectUrl
      )
      const { oauth_token, oauth_token_secret } =
        await oauthWithRedirect.getOAuthRequestToken()

      console.log({ oauth_token, oauth_token_secret })

      const existingToken = await strapi
        .query('tokens')
        .findOne({ oauth_token })

      console.log({ existingToken, userId })

      let tokenId = existingToken?.id

      if (!existingToken) {
        const createdToken = await strapi.query('tokens').create({
          oauth_token,
          oauth_token_secret
        })
        tokenId = createdToken.id
      }

      console.log({ tokenId, lithiumToken })
      if (!!userId) {
        // decode token and check if userId matches

        const { accountId: userIdFromToken } = decodeToken(lithiumToken)

        if (userIdFromToken !== userId) return ctx.throw(403, 'Invalid token')

        if (existingToken) {
          await strapi.query('tokens').update(
            { id: existingToken.id },
            {
              oauth_token,
              oauth_token_secret
            }
          )
        }

        return { oauth_token }
      }

      if (lithiumToken === 'unset') {
        if (existingToken) return ctx.throw(400, 'Token already exists')

        const existingUserWithToken = await strapi
          .query('account')
          .findOne({ token: tokenId })
        console.log({ existingUserWithToken })
        if (!existingUserWithToken) {
          const createdAccount = await strapi.query('account').create({
            token: tokenId
          })
          console.log({ createdAccount })
        }

        return { oauth_token }
      }

      const { WalletAddress: addressFromToken } = decodeToken(lithiumToken)

      if (addressFromToken !== walletAddress)
        return ctx.throw(403, 'Invalid token')

      if (existingToken) {
        await strapi.query('tokens').update(
          { id: existingToken.id },
          {
            oauth_token,
            oauth_token_secret
          }
        )
      }

      return { oauth_token }
    } catch (error) {
      console.error(error)
      ctx.throw(400, 'Error getting twitter token')
    }
  },
  verifyTwitterToken: async (ctx) => {
    try {
      const { oauth_token, oauth_verifier, walletAddress, userId } =
        ctx.request.body

      const lithiumToken = ctx.request.header['x-lithium-token']

      if (!lithiumToken) return ctx.throw(400, 'No token provided')

      const existingToken = await strapi
        .query('tokens')
        .findOne({ oauth_token })

      if (!existingToken?.oauth_token_secret)
        return ctx.throw(400, 'Token does not exist')

      const { oauth_token_secret } = existingToken

      const { oauth_access_token, oauth_access_token_secret } =
        await oauth.getOAuthAccessToken(
          oauth_token,
          oauth_token_secret,
          oauth_verifier
        )

      await strapi.query('tokens').update(
        { id: existingToken.id },
        {
          oauth_token,
          oauth_token_secret,
          oauth_access_token,
          oauth_access_token_secret
        }
      )

      console.log(ctx.request.body, 'raw body from fe')

      const { data } = await oauth.getProtectedResource(
        'https://api.twitter.com/2/users/me',
        'GET',
        oauth_access_token,
        oauth_access_token_secret
      )

      const parsed = JSON.parse(data)

      if (!parsed?.data?.username)
        return ctx.throw(400, 'Error getting twitter username')

      const { username } = parsed.data

      const userWithThisTwitterHandle = await strapi
        .query('account')
        .findOne({ twitterHandle: username })

      console.log({ userWithThisTwitterHandle, userId, lithiumToken })

      if (userId && lithiumToken !== 'unset') {
        // decode token and check if userId matches
        const { accountId: userIdFromToken } = decodeToken(lithiumToken)

        if (userIdFromToken !== userId) return ctx.throw(403, 'Invalid token')

        if (
          userWithThisTwitterHandle &&
          Number(userWithThisTwitterHandle.id) !== Number(userId)
        )
          return {
            message: 'Twitter handle already in use',
            user: sanitizeEntity(userWithThisTwitterHandle, {
              model: strapi.query('account').model
            }),
            newAuthToken: createTokenFromAccountId(
              userWithThisTwitterHandle?.id
            )
          }

        await strapi.query('account').update(
          { id: userId },
          {
            twitterHandle: username,
            token: existingToken.id
          }
        )

        return username
      }

      if (lithiumToken === 'unset') {
        const user =
          userWithThisTwitterHandle ??
          (await strapi.query('account').findOne({ token: existingToken.id }))

        if (!user) return ctx.throw(400, 'User does not exist')

        const profilePictureUrl = userWithThisTwitterHandle
          ? user?.profilePictureUrl
          : `https://lithium-launchpad-cms.s3.eu-west-2.amazonaws.com/user-profile-pic-${user?.id}.png`

        if (!userWithThisTwitterHandle)
          await strapi.query('account').update(
            { id: user.id },
            {
              twitterHandle: username,
              token: existingToken.id,
              profilePictureUrl,
              username
            }
          )

        const createdLithiumToken = createTokenFromAccountId(user.id)

        return {
          createdLithiumToken,
          username,
          userId: user.id,
          profilePictureUrl,
          walletAddress: ''
        }
      }

      console.log('updating')
      const { WalletAddress: addressFromToken } = decodeToken(lithiumToken)

      if (addressFromToken !== walletAddress)
        return ctx.throw(403, 'Invalid token')

      const existingUser = await strapi
        .query('account')
        .findOne({ WalletAddress: walletAddress })

      if (!existingUser) return ctx.throw(400, 'User does not exist')

      await strapi
        .query('account')
        .update(
          { id: existingUser.id },
          { twitterHandle: username, token: existingToken.id }
        )

      return username
    } catch (error) {
      console.error(error)
      ctx.throw(400, 'Error verifying twitter token')
    }
  },
  addProjectToUser: async (ctx) => {
    const { walletAddress, projectId } = ctx.params

    const lithiumToken = ctx.request.header['x-lithium-token']

    if (!lithiumToken) return ctx.throw(400, 'No token provided')

    const { WalletAddress: addressFromToken } = decodeToken(lithiumToken)

    if (addressFromToken !== walletAddress)
      return ctx.throw(403, 'Invalid token')

    const project = await strapi.query('project').findOne({ id: projectId })

    if (!project) return ctx.throw(400, "can't find project")

    const user = await strapi
      .query('account')
      .findOne({ WalletAddress: walletAddress })

    if (!user) return ctx.throw(400, "can't find user")

    const projectIds = user.projects.map(({ id }) => id)

    if (projectIds.includes(Number(projectId)))
      return ctx.throw(400, 'user already has this project')

    const projects = [Number(projectId), ...projectIds]

    try {
      await strapi.query('account').update({ id: user.id }, { projects })
    } catch (error) {
      console.error(error)
      ctx.throw(400, 'error adding user to project')
    }

    return projects
  },
  addProjectToUserBySlug: async (ctx) => {
    const { walletAddress, slug } = ctx.params

    const lithiumToken = ctx.request.header['x-lithium-token']

    if (!lithiumToken) return ctx.throw(400, 'No token provided')

    const { WalletAddress: addressFromToken } = decodeToken(lithiumToken)

    if (addressFromToken !== walletAddress)
      return ctx.throw(403, 'Invalid token')

    const project = await strapi.query('project').findOne({ slug })

    if (!project) return ctx.throw(400, "can't find project")

    const user = await strapi
      .query('account')
      .findOne({ WalletAddress: walletAddress })

    if (!user) return ctx.throw(400, "can't find user")

    const projectIds = user.projects.map(({ id }) => id)

    if (projectIds.includes(Number(project.id)))
      return ctx.throw(400, 'user already has this project')

    const projects = [project, ...user.projects]

    try {
      await strapi.query('account').update({ id: user.id }, { projects })
    } catch (error) {
      console.error(error)
      ctx.throw(400, 'error adding user to project')
    }

    return projects
  },
  verifyDiscordCode: async (ctx) => {
    try {
      const { code, userId } = ctx.request.body
      const lithiumToken = ctx.request.header['x-lithium-token']
      if (!code) return ctx.throw(400, 'No code provided')
      if (!lithiumToken) return ctx.throw(400, 'No token provided')

      if (userId && lithiumToken !== 'unset')
        return await handleDiscordExistingAccount(ctx, code, userId)

      if (lithiumToken === 'unset') return await handleNewDiscordUser(ctx, code)
      if (!code) return ctx.throw(400, 'No code provided')
    } catch (error) {
      console.error(error)
      ctx.throw(400, 'Error getting discord tokens')
    }
  },
  signUpOrLoginWithWallet: async (ctx) => {
    const {
      request: {
        header,
        body: { walletAddress, signedMessage }
      }
    } = ctx

    try {
      const isValid = verifyWallet(signedMessage, walletAddress)

      if (!isValid) ctx.throw(400, 'Invalid signed message')
      const user = await strapi
        .query('account')
        .findOne({ WalletAddress: walletAddress })

      if (!user) {
        const createdUser = await strapi.query('account').create({
          WalletAddress: walletAddress,
          profilePictureUrl: ''
        })
        const profilePictureUrl = `https://lithium-launchpad-cms.s3.eu-west-2.amazonaws.com/user-profile-pic-${createdUser.id}.png`
        const createdLithiumToken = createTokenFromAccountId(createdUser.id)
        return {
          createdLithiumToken,
          username: walletAddress,
          userId: createdUser.id,
          profilePictureUrl,
          walletAddress
        }
      }
      const createdLithiumToken = createTokenFromAccountId(user.id)
      return {
        createdLithiumToken,
        username: user?.username ?? walletAddress,
        userId: user.id,
        profilePictureUrl: user.profilePictureUrl,
        walletAddress
      }
    } catch (error) {
      console.error(error)
      ctx.throw(400, 'Error with login/signup with wallet')
    }
  },
  addWalletToAccount: async (ctx) => {
    const {
      request: {
        header,
        body: { walletAddress, signedMessage, userId }
      }
    } = ctx

    try {
      const lithiumToken = header?.['x-lithium-token']
      if (!lithiumToken) return ctx.throw(400, 'No token provided')
      const { accountId: userIdFromToken } = decodeToken(lithiumToken)
      if (!userIdFromToken) ctx.throw(400, 'No userId provided')
      if (Number(userIdFromToken) !== Number(userId))
        ctx.throw(400, 'Invalid token')
      if (!userId) ctx.throw(400, 'No userId provided')
      const isValid = verifyWallet(signedMessage, walletAddress)

      if (!isValid) ctx.throw(400, 'Invalid signed message')

      const userWithThisWalletAddress = await strapi
        .query('account')
        .findOne({ WalletAddress: walletAddress })

      if (userWithThisWalletAddress) {
        return {
          message: 'Wallet address already in use',
          user: sanitizeEntity(userWithThisWalletAddress, {
            model: strapi.query('account').model
          }),
          newAuthToken: createTokenFromAccountId(userWithThisWalletAddress?.id)
        }
      }

      await strapi.query('account').update(
        { id: userId },
        {
          WalletAddress: walletAddress
        }
      )

      return { message: 'success' }
    } catch (error) {
      console.error(error)
      ctx.throw(400, 'Error adding wallet to account')
    }
  },
  ammendAccount: async (ctx) => {
    const { id: userIdFromReqParams } = ctx.params

    const {
      request: { header, body }
    } = ctx

    const lithiumToken = header['x-lithium-token']

    if (!lithiumToken) return ctx.throw(400, 'No token provided')

    const { accountId } = decodeToken(lithiumToken)

    if (accountId !== Number(userIdFromReqParams))
      return ctx.throw(403, 'Invalid token')

    const sanitizedInput = sanitizeEntity(body, {
      model: strapi.models.account
    })

    const oldAccount = await strapi.query('account').findOne({
      id: accountId
    })

    const hasEmailChanged =
      !!sanitizedInput?.Email && oldAccount.Email !== sanitizedInput.Email

    let signupSuccess = true

    if (hasEmailChanged) {
      const newEmail = sanitizedInput.Email
      const emailAlreadyExists = await strapi
        .query('account')
        .findOne({ Email: newEmail })

      console.log({ emailAlreadyExists, accountId, newEmail })

      if (
        emailAlreadyExists &&
        Number(emailAlreadyExists?.id) !== Number(accountId)
      )
        return ctx.throw(400, 'Email already exists')

      const validEmail = isValidEmailAddress(newEmail)
      if (!validEmail) return ctx.throw(400, 'Invalid email address')

      // console.log({ newEmail })

      // const dataCheck = {
      //   query: `email LIKE '${newEmail}%'`
      // }

      // const requestCheck = {
      //   url: `/v3/marketing/contacts/search`,
      //   method: 'POST',
      //   body: dataCheck
      // }
      // try {
      //   const response = await sendgridClient.request(requestCheck)
      //   console.log(JSON.stringify(response?.[0], null, 2))
      //   if (response?.[0]?.body?.contact_count > 0) {
      //     const contactEmailAddress = response?.[0]?.body?.result[0]?.email
      //     console.log({ contactEmailAddress })
      //     if (contactEmailAddress.toLowerCase() === newEmail.toLowerCase()) {
      //       return ctx.throw(400, 'Email address already in use')
      //     }
      //   }
      // } catch (error) {
      //   console.error(error, 'error checking email address')
      //   signupSuccess = false
      //   return ctx.throw(400, 'Email address already in use')
      // }

      const data = {
        list_ids: ['195facff-2f3a-422b-9a7a-918344ee7f48'],
        contacts: [
          {
            email: `${newEmail}`
          }
        ]
      }

      const request = {
        url: `/v3/marketing/contacts`,
        method: 'PUT',
        body: data
      }

      try {
        await sendgridClient.request(request)
      } catch (error) {
        console.error(error?.response?.body)
        signupSuccess = false
        return ctx.throw(400, 'Error updating email address')
      }
    }

    if (!signupSuccess) return ctx.throw(400, 'Error updating email address')

    const updatedAccount = await strapi
      .query('account')
      .update({ id: accountId }, sanitizedInput)

    return sanitizeEntity(updatedAccount, { model: strapi.models.account })
  },
  getAccount: async (ctx) => {
    const { id: userIdFromReqParams } = ctx.params

    const {
      request: { header }
    } = ctx

    const lithiumToken = header['x-lithium-token']

    if (!lithiumToken) return ctx.throw(400, 'No token provided')

    const { accountId } = decodeToken(lithiumToken)

    if (accountId !== Number(userIdFromReqParams))
      return ctx.throw(403, 'Invalid token')

    const account = await strapi.query('account').findOne({ id: accountId })
    if (!account) return ctx.throw(404, 'Account not found')
    delete account.token
    return sanitizeEntity(account, { model: strapi.models.account })
  },
  deleteAccount: async (ctx) => {
    const { id: userIdFromReqParams } = ctx.params

    const {
      request: { header }
    } = ctx

    try {
      const lithiumToken = header['x-lithium-token']

      if (!lithiumToken) return ctx.throw(400, 'No token provided')

      const { accountId } = decodeToken(lithiumToken)

      if (accountId !== Number(userIdFromReqParams))
        return ctx.throw(403, 'Invalid token')

      const account = await strapi.query('account').findOne({ id: accountId })

      if (!account) return ctx.throw(404, 'Account not found')

      await strapi.query('account').delete({ id: accountId })

      return true
    } catch (error) {
      console.error(error)
      return ctx.throw(400, 'Error deleting account')
    }
  },
  isUsernameAvailable: async (ctx) => {
    const { username } = ctx.params
    const { header } = ctx.request
    const lithiumToken = header['x-lithium-token']
    if (!lithiumToken) return ctx.throw(400, 'No token provided')
    const { accountId } = decodeToken(lithiumToken)
    if (!accountId) return ctx.throw(400, 'Invalid token')

    const account = await strapi.query('account').findOne({ username })
    return !account?.id
  },
  getLevelAndXpByAccountIdAndProjectId: async (ctx) => {
    const { accountId, projectId } = ctx.params
    const { header } = ctx.request
    const lithiumToken = header['x-lithium-token']

    if (!lithiumToken) return ctx.throw(400, 'No token provided')

    const { accountId: accountIdFromToken } = decodeToken(lithiumToken)

    if (!accountId || Number(accountId) !== Number(accountIdFromToken))
      return ctx.throw(400, 'Invalid token')

    try {
      const userProjectXp = await strapi
        .query('user-project-xp')
        .find({ account: accountId, project: projectId })

      const totalXp = userProjectXp.reduce((acc, curr) => {
        return acc + curr.XP
      }, 0)

      const level = levels.reduce((acc, curr, i, arr) => {
        if (i === 0 && totalXp < curr) return 1

        if (acc && totalXp < levels[curr - 2]) {
          // exit early hack
          arr.splice(1)
          return acc
        }

        if (totalXp >= curr) return i + 2

        return acc
      }, 0)

      const currentLevelCeiling = levels[level - 1]
      const currentLevelFloor = levels[level - 2]

      if (!userProjectXp?.length)
        return ctx.throw(404, 'User project xp not found')

      return { level, totalXp, currentLevelCeiling, currentLevelFloor }
    } catch (error) {
      console.error({ error }, 'error getting user project xp')
    }
  }
}
