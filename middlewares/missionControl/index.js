const {
  taskSubmissions,
  handleAdminTaskSubmission
} = require('./taskSubmission')

const isUrl = (url) =>
  url.split('https://').length > 1 || url.split('http://').length > 1

const binaryTasks = ['Retweet', 'Follow', 'Like']

const validateProject = async (strapi, ctx, data, next) => {
  const { tasks } = data

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]

    if (!!task?.xpReward && task?.xpReward % 50 !== 0)
      return ctx.response.badRequest('XP reward must be a multiple of 50')

    if (task?.requiresSocial === 'Twitter') {
      if (binaryTasks.includes(task?.twitterTask?.taskType))
        task.completionMethod = 'binary'

      if (task?.twitterTask?.taskType === 'Retweet') {
        if (!isUrl(task?.twitterTask?.accountHandleOrTweetUrl)) {
          return ctx.response.badRequest('Please provide a valid tweet URL')
        }
      }
      if (task?.twitterTask?.taskType === 'Follow') {
        if (isUrl(task?.twitterTask?.accountHandleOrTweetUrl)) {
          return ctx.response.badRequest(
            'Please provide a valid twitter handle'
          )
        }
      }
    }
  }

  ctx.request.body = {
    ...data
  }
  await next()
}

module.exports = (strapi) => {
  return {
    initialize() {
      strapi.app.use(async (ctx, next) => {
        const { request } = ctx
        const { method, url, body: data } = request

        const isMissionControlAdmin =
          url &&
          url?.split('::')?.[1]?.split('.')[0] === 'project' &&
          url.split('content-type-builder').length === 1

        const isUnpublish = url.split('unpublish').length > 1
        if (isUnpublish) return await next()

        const isStrapiInternal =
          url.split('/').includes('publish') ||
          url.split('/').includes('configuration') ||
          url.split('/').includes('relations')

        if (isStrapiInternal) return next()

        const isTaskSubmission = url
          .split('/')
          [url.split('/').length - 1]?.split('?')
          ?.includes('task-submissions')

        const isAdminTaskSubmission =
          url &&
          url.split('/').includes('content-manager') &&
          url.split('/').includes('collection-types') &&
          url
            .split('/')
            .includes('application::task-submission.task-submission')

        const { body } = request

        if (isAdminTaskSubmission && method === 'PUT')
          return await handleAdminTaskSubmission(
            strapi,
            ctx,
            request,
            body,
            next
          )

        if (isTaskSubmission)
          return await taskSubmissions(strapi, ctx, request, body, next)

        if (!isMissionControlAdmin) return next()

        if (isMissionControlAdmin && (method === 'POST' || method === 'PUT'))
          return await validateProject(strapi, ctx, body, next)

        await next()
      })
    }
  }
}
