'use strict'

const { sanitizeEntity } = require('strapi-utils/lib')
const {
  decodeToken
} = require('../../../middlewares/missionControl/taskSubmission/auth')
const {
  updateUserXP
} = require('../../../middlewares/missionControl/taskSubmission')

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  signUpToPromotionalMaterial: async (ctx) => {
    try {
      const { accountId, projectId } = ctx.params
      const lithiumToken = ctx.request.header['x-lithium-token']

      const { accountId: accountIdFromToken } = decodeToken(lithiumToken)
      if (Number(accountIdFromToken) !== Number(accountId))
        return ctx.badRequest(403, 'You do not have access to this resource')

      const user = await strapi.query('account').findOne({ id: accountId })
      if (!user) return ctx.badRequest(404, 'User not found')
      const project = await strapi.query('project').findOne({ id: projectId })
      if (!project) return ctx.badRequest(404, 'Project not found')

      const userAlreadySignedUp = await strapi
        .query('project-preferences')
        .findOne({ account: accountId, project: projectId })

      if (userAlreadySignedUp)
        return ctx.badRequest(400, 'User already signed up')

      const emailTask = project.tasks.filter(({ isEmailTask }) => isEmailTask)

      const taskId = emailTask[0]?.id
      if (!taskId) return ctx.badRequest(400, 'No email task found')

      const createdSubmission = await strapi.query('task-submission').create({
        accountIdOfUser: accountId,
        taskId: taskId,
        hasCompleted: true,
        scoreOutOfTen: 10,
        completionMethod: 'binary',
        project: projectId
      })

      if (!createdSubmission)
        return ctx.badRequest(400, 'Submission not created')

      if (!!emailTask?.[0]?.xpReward)
        await updateUserXP(
          strapi,
          ctx,
          accountId,
          projectId,
          createdSubmission.id,
          emailTask[0].xpReward
        )

      await strapi.query('project-preferences').create({
        account: accountId,
        project: projectId,
        marketingPreferences: {
          raiseAnnouncements: true,
          productUpdates: true,
          weeklyNewsletter: true,
          vestingUpdates: true
        }
      })

      return { message: 'success' }
    } catch (err) {
      console.error(err)
      return ctx.badRequest(500, 'Something went wrong')
    }
  },
  ammendPromotionalMaterial: async (ctx) => {
    try {
      // Get the accountId and projectId from the request params
      const { accountId, projectId } = ctx.params
      // get prefs from body
      const { marketingPreferences } = ctx.request.body
      const lithiumToken = ctx.request.header['x-lithium-token']
      // check the account id matches lithium-token header
      const { accountId: accountIdFromToken } = decodeToken(lithiumToken)
      if (Number(accountIdFromToken) !== Number(accountId))
        return ctx.badRequest(403, 'You do not have access to this resource')

      // check user and PROJECT exists
      const user = await strapi.query('account').findOne({ id: accountId })
      if (!user) return ctx.badRequest(404, 'User not found')
      const project = await strapi.query('project').findOne({ id: projectId })
      if (!project) return ctx.badRequest(404, 'Project not found')

      // check if user is already signed up
      const userAlreadySignedUp = await strapi
        .query('project-preferences')
        .findOne({ account: accountId, project: projectId })

      if (!userAlreadySignedUp)
        return ctx.badRequest(400, 'User has not signed up')

      // create new project preferences with the user and project and all opted in
      await strapi.query('project-preferences').update(
        { id: userAlreadySignedUp.id },
        {
          marketingPreferences
        }
      )

      return { message: 'success' }
    } catch (err) {
      console.error(err)
      return ctx.badRequest(500, 'Something went wrong')
    }
  },
  fetchPromotionalSettings: async (ctx) => {
    try {
      // Get the accountId and projectId from the request params
      const { accountId, projectId } = ctx.params
      const lithiumToken = ctx.request.header['x-lithium-token']
      // check the account id matches lithium-token header
      const { accountId: accountIdFromToken } = decodeToken(lithiumToken)
      if (Number(accountIdFromToken) !== Number(accountId))
        return ctx.badRequest(403, 'You do not have access to this resource')

      // check user and PROJECT exists
      const user = await strapi.query('account').findOne({ id: accountId })
      if (!user) return ctx.badRequest(404, 'User not found')
      const project = await strapi.query('project').findOne({ id: projectId })
      if (!project) return ctx.badRequest(404, 'Project not found')

      // check if user is already signed up
      const userAlreadySignedUp = await strapi
        .query('project-preferences')
        .findOne({ account: accountId, project: projectId })
      if (!userAlreadySignedUp) return ctx.badRequest(400, 'User not signed up')

      return sanitizeEntity(userAlreadySignedUp, {
        model: strapi.models['project-preferences']
      })
    } catch (err) {
      console.error(err)
      return ctx.badRequest(500, 'Something went wrong')
    }
  }
}
