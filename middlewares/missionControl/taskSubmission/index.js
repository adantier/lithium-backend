const {
  checkAndCreateAllocation
} = require('../../../api/project/controllers/project')
const { isUserInChannel } = require('../../../src/utils/discord')
const {
  checkRetweet,
  checkFollow,
  checkLike
} = require('../../../src/utils/twitter')
const { decodeToken } = require('./auth')

// update user XP
const updateUserXP = async (
  strapi,
  ctx,
  account,
  project,
  taskSubmission,
  xpEarned
) => {
  if (!xpEarned) return ctx.badRequest('XP earned must be greater than 0')
  if (Number.isNaN(xpEarned))
    return ctx.badRequest('XP earned must be a number')

  await strapi.query('user-project-xp').create({
    account,
    project,
    task_submission: taskSubmission,
    XP: xpEarned
  })
  return
}

const submitCompetitionEntries = async (strapi, ctx, user, score, task) => {
  const {
    competition: { id: competitionId },
    rewardAmount: numberOfEntries
  } = task

  for (let i = 0; i < Math.round(numberOfEntries * (score / 10)); i++) {
    try {
      await strapi.query('competition-entry').create({
        competition: competitionId,
        account: user.id
      })
    } catch (e) {
      console.error(e)
      return ctx.throw(400, 'Error submitting competition entry')
    }
  }
}

const checkAndSetFinalTask = async (
  ctx,
  parsedBody,
  user,
  project,
  subtask
) => {
  const { taskId, accountIdOfUser, subtaskId } = parsedBody
  const task = project.tasks.find(({ id }) => id === taskId)
  const { subtasks } = task
  const userSubmissions = await strapi
    .query('task-submission')
    .find({ accountIdOfUser, taskId })

  const hasCompletedAllSubtasks = subtasks
    .filter(({ id }) => id !== subtaskId)
    .every((subtask) => {
      const submission = userSubmissions.find(
        ({ subtaskId }) => subtaskId === subtask.id
      )
      return submission?.hasCompleted
    })

  if (hasCompletedAllSubtasks) {
    let totalScore = 0

    userSubmissions.forEach(({ completionMethod, scoreOutOfTen }) => {
      if (completionMethod === 'binary' && scoreOutOfTen !== 0) {
        totalScore += 10
        return
      }
      totalScore += Number(scoreOutOfTen)
    })

    const averageScore = totalScore / userSubmissions.length

    const createdSubmission = await strapi.query('task-submission').create({
      taskId,
      accountIdOfUser,
      isSubtask: false,
      hasCompleted: true,
      completionMethod: 'oneToTenScore',
      scoreOutOfTen: Math.round(averageScore),
      project
    })

    console.log(task?.xpReward, 'in final completed task')

    if (!!task?.xpReward && createdSubmission?.id) {
      await updateUserXP(
        strapi,
        ctx,
        user.id,
        project.id,
        createdSubmission.id,
        Math.round((averageScore / 10) * task.xpReward)
      )
    }

    if (task?.competition) {
      await submitCompetitionEntries(
        strapi,
        ctx,
        user,
        Math.round(averageScore),
        task
      )
    }

    return true
  }
  return false
}

const handleSubtask = async (
  strapi,
  ctx,
  parsedBody,
  originalBody,
  project,
  user,
  next
) => {
  const { taskId, subtaskId, accountIdOfUser } = parsedBody

  const task = project.tasks.find(({ id }) => id === taskId)

  const subtask = task.subtasks.find(({ id }) => id === subtaskId)

  console.log({ taskId, subtaskId, accountIdOfUser, subtask })

  if (!subtask) return ctx.response.badRequest('No subtask found')

  console.log('has made it')

  const fuckElon = await strapi.query('fuck-elon').findOne({ id: 1 })
  const bypassTwitterApi = Boolean(fuckElon?.bypassTwitterApi)

  console.log({ fuckElon })

  const {
    id,
    twitterTaskType,
    accountHandleOrTweetUrl,
    discordServerId,
    completionMethod,
    requiresSocial,
    internalName,
    publicName,
    instructions
  } = subtask

  const bodySpread = { ...originalBody }

  const complete = async (hasCompleted = false, isInstant = false) => {
    console.log('running complete subtask')
    parsedBody.isSubtask = true
    parsedBody.subtaskId = id
    parsedBody.completionMethod = completionMethod
    parsedBody.privateName = internalName
    parsedBody.publicName = publicName
    parsedBody.instructions = instructions ?? ''
    parsedBody.hasCompleted = hasCompleted

    bodySpread.data = JSON.stringify(parsedBody)

    ctx.request.body = {
      ...bodySpread
    }

    ctx.response.body = {
      message: 'success'
    }

    console.log({ hasCompleted, isInstant })
    if (isInstant) {
      await checkAndSetFinalTask(ctx, parsedBody, user, project, subtask)
    }

    console.log('triggering next await')
    return await next()
  }

  console.log({ completionMethod, requiresSocial })

  if (!requiresSocial || requiresSocial === 'None') await complete()

  switch (requiresSocial) {
    case 'Twitter':
      if (bypassTwitterApi) return await complete(true, true)
      const { twitterHandle } = user
      const taskType = twitterTaskType
      const tweetId = accountHandleOrTweetUrl
        .split('/status/')
        .pop()
        .split('?')[0]
      if (!twitterHandle)
        return ctx.response.badRequest('No twitter handle provided')
      if (twitterTaskType === 'Retweet') {
        const hasRetweeted = await checkRetweet(ctx, tweetId, twitterHandle)
        const hasCompleted = hasRetweeted
        if (!hasCompleted) ctx.throw(400, 'Not completed')
        return await complete(hasCompleted, true)
      }
      if (taskType === 'Follow') {
        const toFollow = accountHandleOrTweetUrl
        const hasFollowed = await checkFollow(ctx, toFollow, twitterHandle)
        const hasCompleted = hasFollowed
        if (!hasFollowed)
          return ctx.response.badRequest('You have not joined the server')
        if (!hasCompleted) ctx.throw(400, 'Not completed')
        return await complete(hasCompleted, true)
      }

      if (taskType === 'Like') {
        const hasLiked = await checkLike(ctx, tweetId, twitterHandle)
        const hasCompleted = hasLiked
        if (!hasCompleted) ctx.throw(400, 'Not completed')
        return await complete(hasCompleted, true)
      }
      break
    case 'Discord':
      const { discordHandle } = user
      if (!discordHandle)
        return ctx.response.badRequest('No discord handle provided')
      const hasJoined = await isUserInChannel(
        ctx,
        accountIdOfUser,
        discordServerId
      )
      const hasCompleted = hasJoined
      if (!hasJoined)
        return ctx.response.badRequest('You have not joined the server')
      if (!hasCompleted) ctx.throw(400, 'Not completed')
      return await complete(hasCompleted, true)
    case 'Telegram':
      return await complete(true, true)
    default:
      console.log('in default here, should not be here!')
      break
  }

  return 'success'
}

const handlePost = async (strapi, ctx, request, body, next) => {
  const { header } = request

  if (!header?.['x-lithium-token'])
    return ctx.response.badRequest('No token provided')

  if (!body.data) return ctx.response.badRequest('No data provided')

  const parsedData = JSON.parse(body?.data)

  if (typeof parsedData !== 'object')
    return ctx.response.badRequest('Malformed data')

  const { accountIdOfUser, isSubtask } = parsedData

  const accountId = decodeToken(header['x-lithium-token'])?.accountId
  if (!accountId) return ctx.response.badRequest('Malformed token')

  if (Number(accountId) !== Number(accountIdOfUser))
    return ctx.response.badRequest(
      "Don't have permission to post this submission"
    )

  console.log('nearly there!')

  const project = await strapi.query('project').findOne({
    id: parsedData.project
  })

  if (!project) return ctx.response.badRequest('No project found')

  const user = await strapi.query('account').findOne({ id: accountIdOfUser })

  if (!user) return ctx.response.badRequest('No user found')

  const { twitterHandle, discordHandle, telegramHandle } = user

  console.log('approaching switch')

  if (isSubtask) {
    console.log('is subtask')
    return await handleSubtask(
      strapi,
      ctx,
      parsedData,
      body,
      project,
      user,
      next
    )
  }

  const fuckElon = await strapi.query('fuck-elon').findOne({ id: 1 })
  const bypassTwitterApi = Boolean(fuckElon?.bypassTwitterApi)

  const task = project.tasks.find(
    (t) => Number(t.id) === Number(parsedData.taskId)
  )

  if (!task) return ctx.response.badRequest('No task found')

  const taskSubmissionsOfUser = await strapi.query('task-submission').findOne({
    accountIdOfUser,
    project: project.id,
    taskId: task.id
  })

  console.log('has got submissions of user')

  if (taskSubmissionsOfUser && !isSubtask)
    return ctx.response.badRequest('You have already submitted for this task')

  const requiresSocial = task?.requiresSocial

  let hasCompleted = false

  if (requiresSocial && requiresSocial !== 'None') {
    const { twitterTask, telegramTask, discordTask } = task
    console.log('in switch')
    switch (requiresSocial) {
      case 'Twitter':
        if (bypassTwitterApi) {
          hasCompleted = true
          break
        }

        if (!twitterHandle)
          return ctx.response.badRequest('No twitter handle found')

        const { taskType, accountHandleOrTweetUrl } = twitterTask

        const tweetId = accountHandleOrTweetUrl.split('/status/').pop()

        if (twitterTask?.taskType) {
          if (taskType === 'Retweet') {
            const hasRetweeted = await checkRetweet(ctx, tweetId, twitterHandle)
            hasCompleted = hasRetweeted
          }

          if (taskType === 'Follow') {
            const toFollow = accountHandleOrTweetUrl
            const hasFollowed = await checkFollow(ctx, toFollow, twitterHandle)
            hasCompleted = hasFollowed
            if (!hasFollowed)
              return ctx.response.badRequest('You have not joined the server')
          }

          if (taskType === 'Like') {
            const hasLiked = await checkLike(ctx, tweetId, twitterHandle)
            hasCompleted = hasLiked
          }
          if (!hasCompleted)
            return ctx.response.badRequest('User has not completed this task')

          break
        }
      case 'Discord':
        if (!discordHandle)
          return ctx.response.badRequest('No discord handle found')
        if (!discordTask)
          return ctx.response.badRequest('No discord task found')
        if (!discordTask?.taskType)
          return ctx.response.badRequest('No task type found')
        console.log('startind discord task')
        const { taskType: discordTaskType, serverId } = discordTask

        if (discordTaskType === 'Join') {
          console.log('pre joi!')
          const hasJoined = await isUserInChannel(
            ctx,
            accountIdOfUser,
            serverId
          )
          console.log('has joined', hasJoined)
          if (!hasJoined)
            return ctx.response.badRequest('You have not joined the server')
          hasCompleted = hasJoined
        }
        console.log('has completed and checked discord!', hasCompleted)
        break
      case 'Telegram':
        const { taskType: telegramTaskType } = telegramTask
        if (telegramTaskType === 'LinkClick') hasCompleted = true
        break
      default:
        return ctx.response.badRequest('No socials handle found')
    }
  }

  const bodySpread = { ...body }

  parsedData.userSocials = {
    twitterHandle,
    discordHandle,
    telegramHandle
  }

  parsedData.completionMethod = task.completionMethod
  parsedData.privateName = task.internalName
  parsedData.publicName = task.publicName
  parsedData.instructions = task?.instructions ?? ''
  parsedData.hasCompleted = hasCompleted

  bodySpread.data = JSON.stringify(parsedData)

  console.log({ parsedData })

  // ctx.request.body = {
  //   ...bodySpread
  // }

  const createdSubmission = await strapi.query('task-submission').create({
    ...parsedData
  })

  console.log({ createdSubmission, dataPassed: bodySpread.data })

  if (hasCompleted && createdSubmission?.id) {
    let userAllocation = await strapi.query('discounted-allocation').findOne({
      accountId: accountIdOfUser,
      project: project.id
    })

    if (task.isExtraAllocation) {
      if (!userAllocation) {
        userAllocation = await checkAndCreateAllocation(
          ctx,
          accountIdOfUser,
          project.id,
          project?.baselineAllocation ?? 0
        )
      }

      await strapi
        .query('discounted-allocation')
        .update(
          { id: userAllocation.id },
          { amount: userAllocation.amount + task.rewardAmount }
        )
    }

    if (!!task?.xpReward) {
      const xpEarned = task.xpReward
      console.log('runnign XP update')
      await updateUserXP(
        strapi,
        ctx,
        user.id,
        project.id,
        createdSubmission.id,
        xpEarned
      )
      console.log('has not exited!')
    }

    if (task?.competition) {
      const isBinary =
        task.completionMethod === 'binary' && body?.scoreOutOfTen !== 0
      const score = isBinary ? 10 : body?.scoreOutOfTen ?? 10

      await submitCompetitionEntries(strapi, ctx, user, Math.round(score), task)
    }
  }

  if (!createdSubmission?.id) {
    return ctx.response.badRequest('Could not create submission')
  }

  ctx.response.body = {
    message: 'success'
  }

  return ctx.response
  // return ctx.
  // return await next()
}

const returnFalse = (ctx) => ctx.response.badRequest('Forbidden')

const taskSubmissions = async (strapi, ctx, request, body, next) => {
  const { method, header } = request
  if (!header?.['x-lithium-token'])
    return ctx.response.badRequest('No token provided')

  switch (method) {
    case 'POST':
      return await handlePost(strapi, ctx, request, body, next)
    case 'GET':
      return await next()
    default:
      return returnFalse(ctx)
  }
}

const handleSubtaskAdminPut = async (
  strapi,
  ctx,
  project,
  currentTask,
  body,
  next
) => {
  const {
    accountIdOfUser,
    walletAddressOfUser,
    subtaskId: currentSubtaskId
  } = body
  const { subtasks } = currentTask

  const searchObject = accountIdOfUser
    ? { accountIdOfUser, taskId: currentTask.id }
    : { walletAddressOfUser, taskId: currentTask.id }

  const userSubmissions = await strapi
    .query('task-submission')
    .find(searchObject)

  const allSubtaskIds = subtasks.map(({ id }) => id)

  const allCompletedSubtasks = [
    ...userSubmissions
      .filter(
        ({ isSubtask, subtaskId, hasCompleted }) =>
          isSubtask && subtaskId !== currentSubtaskId && hasCompleted
      )
      .map(({ subtaskId }) => subtaskId),
    currentSubtaskId
  ]

  if (allCompletedSubtasks.length === allSubtaskIds.length) {
    const allocationSearchObject = accountIdOfUser
      ? { accountId: accountIdOfUser, project: project.id }
      : { walletAddress: walletAddressOfUser, project: project.id }

    const userAllocation = await strapi
      .query('discounted-allocation')
      .findOne(allocationSearchObject)

    let totalScore = 0

    userSubmissions.forEach(({ completionMethod, scoreOutOfTen }) => {
      console.log({ completionMethod, scoreOutOfTen })
      if (
        (completionMethod === 'binary' || !completionMethod) &&
        scoreOutOfTen !== 0
      ) {
        totalScore += 10
        return
      }
      totalScore += Number(scoreOutOfTen)
    })

    const averageScore = totalScore / userSubmissions.length

    const taskId = currentTask.id

    if (currentTask?.isExtraAllocation) {
      if (!userAllocation) return ctx.throw(400, 'No allocation found')
      await strapi.query('discounted-allocation').update(
        { id: userAllocation.id },
        {
          amount: Math.round(
            userAllocation.amount +
              currentTask.rewardAmount * (averageScore / 10)
          )
        }
      )
    }
    const createdSubmission = await strapi.query('task-submission').create({
      taskId,
      accountIdOfUser,
      walletAddressOfUser,
      isSubtask: false,
      hasCompleted: true,
      completionMethod: 'oneToTenScore',
      scoreOutOfTen: Math.round(averageScore),
      project
    })

    if (!!currentTask?.xpReward && createdSubmission?.id) {
      const userSearchObject = accountIdOfUser
        ? { id: accountIdOfUser }
        : { WalletAddress: walletAddressOfUser }
      const user = await strapi.query('account').findOne(userSearchObject)
      if (!user) return ctx.throw(400, 'No user found')
      const xpEarned = Math.round(currentTask.xpReward * (averageScore / 10))
      console.log({ averageScore, xpEarned })

      await updateUserXP(
        strapi,
        ctx,
        user.id,
        project.id,
        createdSubmission.id,
        xpEarned
      )
    }
  }

  if (currentTask?.competition) {
    const userSearchObject = accountIdOfUser
      ? { id: accountIdOfUser }
      : { WalletAddress: walletAddressOfUser }
    const user = await strapi.query('account').findOne(userSearchObject)
    if (!user) return ctx.throw(400, 'No user found')

    await submitCompetitionEntries(
      strapi,
      ctx,
      user,
      Math.round(averageScore),
      currentTask
    )
  }

  return await next()
}

const handleAdminTaskSubmission = async (strapi, ctx, request, body, next) => {
  console.log('in handle admin task submission')
  const { project: projectId, id: submissionId } = body
  console.log({ request, body }, 'admin task submission request')
  if (!projectId) return ctx.response.badRequest('No project provided')
  const project = await strapi.query('project').findOne({
    id: projectId
  })

  if (!body.hasCompleted) return await next()

  const { walletAddressOfUser, taskId, isSubtask, accountIdOfUser } = body

  if (!walletAddressOfUser && !accountIdOfUser)
    return ctx.response.badRequest('No user provided')

  if (!project) return ctx.response.badRequest('No project found')

  const currentTask = project.tasks.find(({ id }) => id === taskId)

  if (!currentTask) return ctx.response.badRequest('No task found')

  const { completionMethod, rewardAmount, isExtraAllocation } = currentTask

  const isBinary = completionMethod === 'binary' && body?.scoreOutOfTen !== 0
  if (isSubtask) {
    return await handleSubtaskAdminPut(
      strapi,
      ctx,
      project,
      currentTask,
      body,
      next
    )
  }

  const userAllocation = await strapi.query('discounted-allocation').findOne({
    walletAddress: walletAddressOfUser,
    accountId: accountIdOfUser,
    project: projectId
  })

  const userSearchObject = accountIdOfUser
    ? { id: accountIdOfUser }
    : { WalletAddress: walletAddressOfUser }
  const user = await strapi.query('account').findOne(userSearchObject)
  const score = isBinary ? 10 : body?.scoreOutOfTen

  if (currentTask?.competition) {
    await submitCompetitionEntries(
      strapi,
      ctx,
      user,
      Math.round(score),
      currentTask
    )
  }

  if (!!currentTask?.xpReward) {
    const xpEarned = Math.round((score / 10) * currentTask.xpReward)
    console.log('runnign XP update')
    await updateUserXP(strapi, ctx, user.id, projectId, submissionId, xpEarned)
    console.log('has not exited!')
  }

  if (isExtraAllocation) {
    if (!userAllocation) return ctx.throw(400, 'No allocation found')
    const extraAllocation = isBinary
      ? rewardAmount
      : parseInt((rewardAmount / 10) * body?.scoreOutOfTen)

    await strapi
      .query('discounted-allocation')
      .update(
        { id: userAllocation.id },
        { amount: Math.round(userAllocation.amount + extraAllocation) }
      )

    return await next()
  }

  return await next()
}

module.exports = { taskSubmissions, handleAdminTaskSubmission, updateUserXP }
