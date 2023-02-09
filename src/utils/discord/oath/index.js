const { default: axios } = require('axios')

const client_id = process.env.DISCORD_CLIENT_ID
const client_secret = process.env.DISCORD_CLIENT_SECRET
const redirect_uri = process.env.DISCORD_REDIRECT_URL

module.exports = {
  fetchAuth: async (
    ctx,
    code,
    WalletAddress,
    isNewUser = false,
    returnTokensOnly = false
  ) => {
    if (!code) return ctx.badRequest('No code provided')
    try {
      const params = new URLSearchParams()
      params.append('client_id', client_id)
      params.append('client_secret', client_secret)
      params.append('code', code)
      params.append('grant_type', 'authorization_code')
      params.append('redirect_uri', redirect_uri)
      params.append('scope', 'identify, guilds')
      const { data } = await axios.post(
        'https://discord.com/api/oauth2/token',
        params
      )

      const user = isNewUser
        ? await strapi.query('account').create()
        : await strapi.query('account').findOne({ WalletAddress })

      if (!user && !returnTokensOnly)
        return ctx.badRequest('User does not exist')
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

      if (returnTokensOnly) return tokenBody

      if (user?.token) {
        await strapi.query('tokens').update({ id: user.token.id }, tokenBody)
        return data
      }

      const token = await strapi.query('tokens').create(tokenBody)

      await strapi.query('account').update(
        { id: user.id },
        {
          token: token.id
        }
      )

      const userAfterUpdate = await strapi
        .query('account')
        .findOne({ id: user.id })

      return userAfterUpdate
    } catch (error) {
      console.error(error)
    }
  }
}
