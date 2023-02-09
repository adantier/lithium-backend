const client_id = process.env.DISCORD_CLIENT_ID
const client_secret = process.env.DISCORD_CLIENT_SECRET
const axios = require('axios')

const refreshDiscordToken = async (ctx, refresh_token, WalletAddress) => {
  const params = new URLSearchParams()
  params.append('client_id', client_id)
  params.append('client_secret', client_secret)
  params.append('grant_type', 'refresh_token')
  params.append('refresh_token', refresh_token)

  const { data } = await axios.post(
    'https://discord.com/api/oauth2/token',
    params
  )

  const user = await strapi.query('account').findOne({ WalletAddress })

  if (!user) return ctx.badRequest('User does not exist')
  if (!data.access_token)
    return ctx.badRequest('No access token provided by discord API')
  if (!data.refresh_token)
    return ctx.badRequest('No refresh token provided by discord API')

  const {
    access_token: discord_access_token,
    refresh_token: discord_refresh_token,
    expires_in
  } = data

  const tokenBody = {
    discord_access_token,
    discord_refresh_token,
    discord_expires_on: new Date(Date.now() + expires_in).toISOString()
  }

  if (!user?.token) return ctx.badRequest('No token found for user')

  await strapi.query('tokens').update({ id: user.token.id }, tokenBody)
  return data
}

const returnTokensByWalletAddressOrUserId = async (
  ctx,
  WalletAddress,
  userId = -1
) => {
  const searchObject = userId > 0 ? { id: userId } : { WalletAddress }
  const user = await strapi.query('account').findOne(searchObject)

  console.log({ user, searchObject, userId })

  if (!user) return ctx.response.badRequest('No user found')
  const { token: userTokens } = user

  console.log({ userTokens })

  if (!userTokens?.discord_access_token)
    return ctx.response.badRequest('No tokens found')

  let { discord_access_token, discord_refresh_token, discord_expires_on } =
    userTokens

  console.log('has destructured?')

  if (new Date(discord_expires_on) < new Date()) {
    console.log('trying to refresh')
    const updatedTokens = await refreshDiscordToken(
      ctx,
      discord_refresh_token,
      WalletAddress
    )
    const { access_token } = updatedTokens
    discord_access_token = access_token
  }

  console.log('should return?!')

  return { discord_access_token }
}

const getUserDetails = async (
  ctx,
  WalletAddress,
  userId = -1,
  manualTokens = null
) => {
  console.log({ manualTokens })
  // return
  if (manualTokens?.discord_access_token) {
    try {
      const { data: discordUserResponse } = await axios.get(
        'https://discord.com/api/oauth2/@me',
        {
          headers: {
            Authorization: `Bearer ${manualTokens.discord_access_token}`
          }
        }
      )
      console.log({ discordUserResponse })
      if (!discordUserResponse?.user?.username)
        return ctx.badRequest('No discord user found')
      return {
        discordUsername: discordUserResponse.user.username,
        discordId: discordUserResponse.user.id,
        discordHashNumber: Number(discordUserResponse.user.discriminator)
      }
    } catch (error) {
      console.error(error)
    }
  }

  const searchObject = userId > 0 ? { id: userId } : { WalletAddress }
  const user = await strapi.query('account').findOne(searchObject)

  if (!user) return ctx.response.badRequest('No user found')
  const userTokens = await returnTokensByWalletAddressOrUserId(
    ctx,
    WalletAddress,
    userId
  )

  if (!userTokens?.discord_access_token)
    return ctx.response.badRequest('No tokens found')

  const { discord_access_token } = userTokens
  const params = new URLSearchParams()
  params.append('client_id', client_id)
  params.append('client_secret', client_secret)
  params.append('access_token', discord_access_token)

  const { data: discordUserResponse } = await axios.get(
    'https://discord.com/api/oauth2/@me',
    {
      headers: {
        Authorization: `Bearer ${discord_access_token}`
      }
    }
  )
  if (!discordUserResponse?.user?.id)
    return ctx.response.badRequest('No discord user found')

  const {
    user: { id: discordId, username: discordHandle, discriminator }
  } = discordUserResponse

  const discordHashNumber = Number(discriminator)

  const userWithThisHandle = await strapi
    .query('account')
    .findOne({ discordHandle })

  if (!userWithThisHandle) {
    await strapi
      .query('account')
      .update({ id: user.id }, { discordId, discordHandle, discordHashNumber })
  }
  return { discordHandle, userWithThisHandle }
}

const isUserInChannel = async (ctx, accountId, serverId) => {
  try {
    const user = await strapi.query('account').findOne({ id: accountId })

    if (!user) return ctx.response.badRequest('No user found')
    const userTokens = await returnTokensByWalletAddressOrUserId(
      ctx,
      null,
      Number(accountId)
    )

    console.log({ userTokens })

    if (!userTokens?.discord_access_token)
      return ctx.response.badRequest('No tokens found')
    const { discord_access_token } = userTokens

    const params = new URLSearchParams()
    params.append('client_id', client_id)
    params.append('client_secret', client_secret)
    params.append('access_token', discord_access_token)
    const userGuilds = await axios.get(
      'https://discord.com/api/users/@me/guilds',
      {
        headers: {
          Authorization: `Bearer ${discord_access_token}`
        }
      }
    )

    console.log({ userGuilds })

    if (!userGuilds?.data?.length)
      return ctx.response.badRequest('No guilds found')
    const guild = userGuilds.data.find((guild) => guild.id === serverId)

    if (!guild) return ctx.response.badRequest('No guild found')
    return true
  } catch (err) {
    console.error(err)
    return ctx.response.badRequest('No guild found')
  }
}

module.exports = { getUserDetails, isUserInChannel }
