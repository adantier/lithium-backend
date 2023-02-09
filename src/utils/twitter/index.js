const oauthCallback = process.env.FRONTEND_URL
const oauth = require('../../../src/utils/twitter/oath')(oauthCallback)

const returnTokens = async (ctx, userHandle) => {
  const user = await strapi
    .query('account')
    .findOne({ twitterHandle: userHandle })

  if (!user.token) return ctx.response.badRequest('No twitter token found')
  const { oauth_access_token, oauth_access_token_secret } = user.token
  return { oauth_access_token, oauth_access_token_secret }
}

const checkRetweet = async (ctx, tweetId, userHandle) => {
  const tokens = await returnTokens(ctx, userHandle)
  const { oauth_access_token, oauth_access_token_secret } = tokens
  let next_token = null
  const users = []
  do {
    const { data } = await oauth.getProtectedResource(
      `https://api.twitter.com/2/tweets/${tweetId}/retweeted_by?user.fields=public_metrics&max_results=100${
        next_token ? `&pagination_token=${next_token}` : ''
      }`,
      'GET',
      oauth_access_token,
      oauth_access_token_secret
    )

    const parsed = JSON.parse(data)

    const next_paginaion = parsed.meta?.next_token
    next_token = next_paginaion

    if (parsed?.data?.length)
      users.push(...parsed?.data?.map((user) => user.username))

    if (users.includes(userHandle)) return true
  } while (next_token)

  return ctx.badRequest(400, 'No retweets found')
}

const checkFollow = async (ctx, toFollow, userHandle) => {
  const tokens = await returnTokens(ctx, userHandle)
  const { oauth_access_token, oauth_access_token_secret } = tokens

  try {
    const resUsers = await oauth.getProtectedResource(
      `https://api.twitter.com/2/users/by/username/${userHandle}`,
      'GET',
      oauth_access_token,
      oauth_access_token_secret
    )
    console.log({ resUsers })
    console.log(resUsers?.response?.headers)
    const parsedUser = JSON.parse(resUsers.data)
    const { id: userId } = parsedUser.data

    let next_token = null
    const users = []
    do {
      const { data } = await oauth.getProtectedResource(
        `https://api.twitter.com/2/users/${userId}/following${
          next_token
            ? `?pagination_token=${next_token}&max_results=500`
            : '?max_results=500'
        }`,
        'GET',
        oauth_access_token,
        oauth_access_token_secret
      )
      const parsed = JSON.parse(data)

      console.log({ parsed })
      const next_paginaion = parsed.meta?.next_token
      next_token = next_paginaion

      users.push(...parsed?.data?.map((user) => user.username.toLowerCase()))
      if (users.includes(toFollow.toLowerCase())) return true
    } while (next_token)
    console.log('users', users, 'end of loop')
  } catch (error) {
    console.error(error)
    return ctx.badRequest(400, 'Error checking follow')
  }
  return ctx.badRequest(402, 'No retweets found')
}

const checkLike = async (ctx, tweetId, userHandle) => {
  console.log('check like', tweetId, userHandle)
  const tokens = await returnTokens(ctx, userHandle)
  const { oauth_access_token, oauth_access_token_secret } = tokens

  try {
    let next_token = null
    do {
      const { data } = await oauth.getProtectedResource(
        `https://api.twitter.com/2/tweets/${tweetId}/liking_users${
          next_token ? `?pagination_token=${next_token}` : ''
        }`,
        'GET',
        oauth_access_token,
        oauth_access_token_secret
      )
      const parsed = JSON.parse(data)
      console.log(parsed)
      const next_paginaion = parsed.meta?.next_token
      next_token = next_paginaion
      const user = parsed?.data?.find(
        (user) => user.username.toLowerCase() === userHandle.toLowerCase()
      )
      if (user) return true
    } while (next_token)
    return false
  } catch (error) {
    console.error(error)
    return ctx.badRequest(400, 'Error checking follow')
  }
  return ctx.badRequest(400, 'No retweets found')
}

module.exports = { checkRetweet, checkFollow, checkLike }
