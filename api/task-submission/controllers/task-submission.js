'use strict'

const { isValidAddress } = require('ethereumjs-util')
const {
  decodeToken
} = require('../../../middlewares/missionControl/taskSubmission/auth')
const { sanitizeEntity } = require('strapi-utils')

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  byProjectAndUser: async (ctx) => {
    // get the project id from the url
    const { request } = ctx
    const params = request.url.split(
      '/task-submissions/by-user-and-project/'
    )[1]
    const projectId = params.split('/')[0]
    const accountIdOfUser = params.split('/')[1]

    const accessToken = ctx.request.header['x-lithium-token']
    if (!accessToken) return ctx.throw(400, 'No token provided')

    try {
      const { accountId: accountIdFromToken } = decodeToken(accessToken)
      if (Number(accountIdOfUser) !== Number(accountIdFromToken))
        return ctx.throw(400, 'You do not have access to this resource')

      const user = await strapi
        .query('account')
        .findOne({ id: accountIdOfUser })

      if (!user) return ctx.throw(400, 'User not found')

      const { WalletAddress } = user

      const allSubs = []

      const taskSubmissionsByAccountIdAndProject = await strapi
        .query('task-submission')
        .find({
          project: projectId,
          accountIdOfUser
        })

      allSubs.push(...taskSubmissionsByAccountIdAndProject)

      if (!!WalletAddress) {
        const taskSubmissionsByProjectAndWalletAddress = await strapi
          .query('task-submission')
          .find({
            project: projectId,
            walletAddressOfUser: WalletAddress
          })
        allSubs.push(...taskSubmissionsByProjectAndWalletAddress)
      }

      return allSubs.map((submission) =>
        sanitizeEntity(submission, {
          model: strapi.models['task-submission']
        })
      )
    } catch (err) {
      console.error(err)
      return ctx.throw(400, 'error decoding token')
    }
  }
}
