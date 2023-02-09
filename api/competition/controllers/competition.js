'use strict'
const { isValidAddress } = require('ethereumjs-util')
const {
  decodeToken
} = require('../../../middlewares/missionControl/taskSubmission/auth')

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  entriesByUser: async (ctx) => {
    const { request } = ctx

    const [competition, accountId] = request.url
      .split('entries-by-user/')[1]
      .split('/')

    const accessToken = ctx.request.header['x-lithium-token']

    try {
      const { accountId: accountIdFromToken } = decodeToken(accessToken)

      if (Number(accountIdFromToken) !== Number(accountId))
        return ctx.throw(400, 'You do not have access to this resource')

      const userModel = await strapi.query('account').findOne({ id: accountId })

      if (!userModel?.id) return ctx.throw(400, 'User not found')

      const entries = await strapi
        .query('competition-entry')
        .find({ account: accountId, competition })

      return entries?.length ?? 0
    } catch (error) {
      console.error(error)
      return ctx.throw(400, 'Something went wrong')
    }
  }
}
