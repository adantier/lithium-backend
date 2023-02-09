const csv = require('csvtojson')
const requestNode = require('request')

const handleCsv = async (csvId) => {
  if (!csvId) ctx.throw(400, 'Please provide a CSV file')

  const csvFile = await strapi.plugins['upload'].services.upload.fetch({
    id: csvId
  })

  if (!csvFile) ctx.throw(400, 'Please provide a CSV file')
  if (!csvFile?.url)
    ctx.throw(400, "Couldn't find CSV file upload, please try again")

  const jsonArray = await csv().fromStream(requestNode.get(csvFile.url))
  const firstKey = Object.keys(jsonArray[0])[0]
  const accountIds = []

  for (let i = 0; i < jsonArray.length; i++) {
    accountIds.push(jsonArray[i][firstKey])
  }

  return accountIds
}

const handleCompetitionUpdate = async (strapi, ctx, data, next) => {
  if (data?.winnersCsv) {
    const accountIds = await handleCsv(data?.winnersCsv)
    console.log({ accountIds })
    if (accountIds.length > 0) {
      ctx.request.body = {
        ...data,
        winnersJSON: JSON.stringify(accountIds)
      }
    }
  }

  return await next()
}

module.exports = (strapi) => {
  return {
    initialize() {
      strapi.app.use(async (ctx, next) => {
        const { request } = ctx
        const { method, url, body: data } = request

        const isAdminUpdate =
          url
            .split('/content-manager/collection-types/application::')?.[1]
            ?.split('/')?.[0] === 'competition.competition' && method === 'PUT'

        console.log({ method, url, isAdminUpdate })

        if (isAdminUpdate)
          return handleCompetitionUpdate(strapi, ctx, data, next)

        return await next()
      })
    }
  }
}
