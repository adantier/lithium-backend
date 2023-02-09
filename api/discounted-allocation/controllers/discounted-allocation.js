'use strict'

const {
  decodeToken
} = require('../../../middlewares/missionControl/taskSubmission/auth')
const {
  checkAndCreateAllocation
} = require('../../project/controllers/project')

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  byProjectAndUser: async (ctx) => {
    const { slug, accountId } = ctx.params

    const accessToken = ctx.request.header['x-lithium-token']

    if (!accessToken) return ctx.throw(400, 'No token provided')

    try {
      const { accountId: accountIdFromToken } = decodeToken(accessToken)
      if (Number(accountId) !== Number(accountIdFromToken))
        return ctx.throw(403, 'Invalid token')
    } catch (error) {
      console.error(error, 'decoding token')
      return ctx.throw(400, 'Invalid token')
    }

    const project = await strapi.query('project').findOne({ slug })

    if (!project?.id) return ctx.throw(400, 'Project does not exist')

    const userObject = await strapi.query('account').findOne({ id: accountId })

    const allocationViaAccountId = await strapi
      .query('discounted-allocation')
      .findOne({ accountId, project: project.id })

    const allocationViaWalletAddress =
      !!userObject?.WalletAddress &&
      (await strapi.query('discounted-allocation').findOne({
        walletAddress: userObject.WalletAddress,
        project: project.id
      }))

    const allocation = allocationViaWalletAddress ?? allocationViaAccountId

    let invisibleAllocation = 0
    // find all task submissions for this user and project
    const taskSubmissions = await strapi
      .query('task-submission')
      .find({ accountIdOfUser: Number(accountId), project: project.id })

    taskSubmissions
      .filter((taskSubmission) => taskSubmission.hasCompleted)
      .filter((taskSubmission) => {
        const now = new Date()
        const taskSubmissionDate = new Date(taskSubmission.created_at)
        const diff = now - taskSubmissionDate
        const diffInHours = diff / (1000 * 60 * 60)
        return diffInHours <= 24
      })
      .filter(({ isSubtask }) => !isSubtask)
      .forEach((taskSubmission) => {
        const task = project.tasks.find(
          (task) => task.id === taskSubmission.taskId
        )

        const { scoreOutOfTen, completionMethod, hasCompleted } = taskSubmission

        const {
          rewardAmount,
          isExtraAllocation,
          twitterTask,
          discordTask,
          telegramTask,
          subtasks
        } = task

        if (!!subtasks?.length || !hasCompleted) return
        if (scoreOutOfTen === 0) return

        const isInstantTask =
          Boolean(twitterTask) || Boolean(discordTask) || Boolean(telegramTask)

        if (!isExtraAllocation || isInstantTask) return

        const score =
          completionMethod !== 'oneToTenScore' ? 10 : Number(scoreOutOfTen)

        invisibleAllocation += rewardAmount * (score / 10)
      })

    if (!allocation) {
      const createdAllocation = await checkAndCreateAllocation(
        ctx,
        Number(accountId),
        project.id,
        project?.baselineAllocation ?? 200
      )
      return createdAllocation.amount
    }

    return Number(allocation.amount) - invisibleAllocation
  }
}
