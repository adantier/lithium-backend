'use strict'
const _ = require('lodash')

const PAGE_LENGTH = 5

const initTiers = {
  0: {
    Backer: {
      allocation: '15',
      required: '2000000000000000000000'
    },
    Starter: {
      allocation: '75',
      required: '6000000000000000000000'
    },
    Investor: {
      allocation: '150',
      required: '10000000000000000000000'
    },
    Strategist: {
      allocation: '350',
      required: '25000000000000000000000'
    },
    Venturist: {
      allocation: '750',
      required: '50000000000000000000000'
    },
    Evangelist: {
      allocation: '1125',
      required: '70000000000000000000000'
    }
  },
  30: {
    Backer: {
      allocation: '30',
      required: '2000000000000000000000'
    },
    Starter: {
      allocation: '115',
      required: '6000000000000000000000'
    },
    Investor: {
      allocation: '225',
      required: '10000000000000000000000'
    },
    Strategist: {
      allocation: '550',
      required: '25000000000000000000000'
    },
    Venturist: {
      allocation: '1125',
      required: '50000000000000000000000'
    },
    Evangelist: {
      allocation: '1650',
      required: '70000000000000000000000'
    }
  },
  60: {
    Backer: {
      allocation: '60',
      required: '2000000000000000000000'
    },
    Starter: {
      allocation: '225',
      required: '6000000000000000000000'
    },
    Investor: {
      allocation: '350',
      required: '10000000000000000000000'
    },
    Strategist: {
      allocation: '825',
      required: '25000000000000000000000'
    },
    Venturist: {
      allocation: '1650',
      required: '50000000000000000000000'
    },
    Evangelist: {
      allocation: '2350',
      required: '70000000000000000000000'
    }
  },
  90: {
    Backer: {
      allocation: '200',
      required: '2000000000000000000000'
    },
    Starter: {
      allocation: '600',
      required: '6000000000000000000000'
    },
    Investor: {
      allocation: '850',
      required: '10000000000000000000000'
    },
    Strategist: {
      allocation: '1650',
      required: '25000000000000000000000'
    },
    Venturist: {
      allocation: '2350',
      required: '50000000000000000000000'
    },
    Evangelist: {
      allocation: '3000',
      required: '70000000000000000000000'
    },
    Evangelist_Pro: {
      allocation: '7500',
      required: '300000000000000000000000'
    }
  }
}

const { isValidAddress } = require('ethereumjs-util')
const {
  decodeToken
} = require('../../../middlewares/missionControl/taskSubmission/auth')
const { sanitizeEntity } = require('strapi-utils')
const { sub, isWithinInterval } = require('date-fns')

const calculateRewardsAvailable = (tasks, submissions = []) => {
  let rewardsAvailable = 0

  tasks.forEach((task) => {
    console.log({ task })
    const { isExpired, expiresOn, availableFrom } = task
    if (isExpired) return
    if (expiresOn && new Date(expiresOn).getTime() < new Date().getTime())
      return
    if (
      availableFrom &&
      new Date(availableFrom).getTime() > new Date().getTime()
    )
      return

    if (submissions.some(({ taskId }) => taskId === task.id)) return
    rewardsAvailable++
  })
  return rewardsAvailable
}

const formatProjectsForHomepage = async (
  projects,
  submissions = [],
  isArchive = false
) => {
  const allProjects = []

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i]

    const {
      id,
      name,
      ticker,
      projectMedia,
      chain,
      tasks,
      metaDescription,
      slug
    } = project

    let pool = project?.pool

    const rewardTypesRaw = []

    tasks.forEach((task) => {
      const { isExtraAllocation, isNativeTokenProjectReward } = task
      rewardTypesRaw.push(
        isExtraAllocation
          ? 'Allocation'
          : isNativeTokenProjectReward
          ? ticker
          : 'USDC'
      )
    })
    //
    const rewardTypes = [...new Set(rewardTypesRaw)]

    if (typeof pool === 'number') {
      const fetchedPool = await strapi.query('pools').findOne({ id: pool })
      pool = fetchedPool
    }

    const hasUpcomingPool =
      pool?.privateSale?.start &&
      new Date(pool?.privateSale?.start).getTime() > new Date().getTime()

    const formattedProject = {
      id,
      name,
      ticker,
      tagline: metaDescription,
      featuredProjectImage: projectMedia?.featuredProjectImage[0]?.url,
      projectThumbnail: projectMedia?.projectThumbnail?.url,
      chain,
      rewardTypes,
      slug,
      totalTasks: tasks.length,
      totalRewardsAvailable: isArchive
        ? 0
        : calculateRewardsAvailable(tasks, submissions),
      hasUpcomingPool,
      isComingSoon: !!project?.isComingSoon
    }

    if (projectMedia?.featuredProjectImage?.[0]?.url)
      formattedProject.featuredProjectImage =
        projectMedia.featuredProjectImage[0].url

    if (projectMedia?.projectThumbnail?.url)
      formattedProject.projectThumbnail = projectMedia.projectThumbnail.url

    if (pool?.privateSale?.price || pool?.tgePrice) {
      formattedProject.communityPrice = Number(pool.privateSale.price)
      formattedProject.tgePrice = Number(pool.tgePrice)
    }

    allProjects.push(formattedProject)
  }

  return allProjects
}

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const checkAndCreateAllocation = async (
  ctx,
  accountId,
  project,
  amount = 0
) => {
  try {
    let allocation = await strapi
      .query('discounted-allocation')
      .findOne({ accountId, project })

    if (allocation) return allocation

    const userAccount = await strapi.query('account').findOne({ id: accountId })

    const lithiumPlusMember = await strapi
      .query('lithium-plus-member')
      .findOne({ walletAddress: userAccount?.WalletAddress })

    if (lithiumPlusMember) {
      const { tier, lockDays } = lithiumPlusMember

      const allocation = initTiers?.[lockDays]?.[tier]?.allocation

      if (!allocation) return ctx.badRequest('Invalid allocation')
      amount = parseInt(allocation) + parseInt(amount)
    }

    allocation = await strapi.query('discounted-allocation').create({
      accountId,
      amount,
      project
    })

    return allocation
  } catch (error) {
    console.error(error)
  }
}

module.exports = {
  byUserLanding: async (ctx) => {
    const { request } = ctx
    const walletAddress = request.url.split('/projects/by-user/')[1]

    console.log({ walletAddress })

    const isValid = isValidAddress(walletAddress)

    if (!isValid) return ctx.throw(400, 'Invalid address')

    const accessToken = ctx.request.header['x-lithium-token']

    if (!accessToken) return ctx.throw(400, 'No token provided')

    try {
      const { WalletAddress: addressFromToken } = decodeToken(accessToken)
      if (addressFromToken.toLowerCase() !== walletAddress.toLowerCase())
        return ctx.throw(400, 'You do not have access to this resource')

      const user = await strapi
        .query('account')
        .findOne({ WalletAddress: walletAddress })

      const { projects: projectsForUser } = user

      return projectsForUser
        .filter(({ published_at }) => published_at)
        .map((project) =>
          sanitizeEntity(project, { model: strapi.models.project })
        )
    } catch (err) {
      console.error(err)
      return ctx.throw(400, 'error decoding token')
    }
  },
  byUser: async (ctx) => {
    const { request } = ctx
    const walletAddress = request.url.split('/projects/by-user/')[1]

    const isValid = isValidAddress(walletAddress)

    if (!isValid) return ctx.throw(400, 'Invalid address')

    const accessToken = ctx.request.header['x-lithium-token']

    if (!accessToken) return ctx.throw(400, 'No token provided')

    try {
      const { WalletAddress: addressFromToken } = decodeToken(accessToken)
      if (addressFromToken.toLowerCase() !== walletAddress.toLowerCase())
        return ctx.throw(400, 'You do not have access to this resource')

      const user = await strapi
        .query('account')
        .findOne({ WalletAddress: walletAddress })

      const { projects: projectsForUser } = user

      return projectsForUser
        .filter(
          ({ published_at, landingPageOnly }) =>
            published_at && !landingPageOnly
        )
        .map((project) =>
          sanitizeEntity(project, { model: strapi.models.project })
        )
    } catch (err) {
      console.error(err)
      return ctx.throw(400, 'error decoding token')
    }
  },
  byUserHomepage: async (ctx) => {
    const { request } = ctx
    const accountId = request.url.split('/').pop()

    const accessToken = ctx.request.header['x-lithium-token']

    if (!accessToken) return ctx.throw(400, 'No token provided')

    try {
      const { accountId: accountIdFromToken } = decodeToken(accessToken)
      if (Number(accountIdFromToken) !== Number(accountId))
        return ctx.throw(400, 'You do not have access to this resource')

      const user = await strapi.query('account').findOne({ id: accountId })

      const { projects: projectsForUser } = user

      const taskSubmissions = await strapi.query('task-submission').find({
        accountIdOfUser: accountId
      })

      const active = await formatProjectsForHomepage(
        projectsForUser.filter(
          ({ published_at, landingPageOnly, isArchived }) =>
            published_at && !landingPageOnly && !isArchived
        ),
        taskSubmissions
      )

      const allProjects = await strapi.query('project').find({ _limit: -1 })

      const activeIds = active.map(({ id }) => id)

      const available = await formatProjectsForHomepage(
        allProjects.filter(
          ({ id, landingPageOnly, isArchived, published_at }) =>
            !activeIds.includes(id) &&
            !landingPageOnly &&
            !isArchived &&
            !!published_at
        ),
        taskSubmissions
      )

      const complete = await formatProjectsForHomepage(
        allProjects.filter(
          ({ id, landingPageOnly, isArchived, published_at }) =>
            !landingPageOnly && isArchived && !!published_at
        ),
        taskSubmissions
      )

      return { available, active, complete }
    } catch (err) {
      console.error(err)
      return ctx.throw(400, 'error decoding token')
    }
  },
  projectsGuestHomepage: async (ctx) => {
    try {
      const allProjects = await strapi.query('project').find({ _limit: -1 })
      const available = await formatProjectsForHomepage(
        allProjects.filter(
          ({ landingPageOnly, isArchived, published_at }) =>
            !landingPageOnly && !isArchived && !!published_at
        )
      )
      const complete = await formatProjectsForHomepage(
        allProjects.filter(
          ({ landingPageOnly, isArchived, published_at }) =>
            !landingPageOnly && isArchived && !!published_at
        ),
        [],
        true
      )
      return { available, complete }
    } catch (err) {
      console.error(err)
      return ctx.throw(400, 'error retrieving projects')
    }
  },
  tasksByUserHomepage: async (ctx) => {
    const { request } = ctx
    const userId = request.url.split('/').pop()

    const accessToken = ctx.request.header['x-lithium-token']

    if (!accessToken) return ctx.throw(400, 'No token provided')

    try {
      const { accountId } = decodeToken(accessToken)
      if (Number(accountId) !== Number(userId))
        return ctx.throw(400, 'You do not have access to this resource')

      const allProjects = await strapi
        .query('project')
        .find({ _limit: -1, isArchived: false || null })

      const filteredProjects = allProjects.filter(
        ({ published_at, landingPageOnly }) =>
          !!published_at && !landingPageOnly
      )

      const allTasks = []

      for (const project of filteredProjects) {
        const { tasks } = project
        const withProject = tasks.map((task) => ({
          ...task,
          projectId: project.id,
          project
        }))
        allTasks.push(...withProject)
      }

      const allSubmissions = await strapi
        .query('task-submission')
        .find({ _limit: -1, accountIdOfUser: userId })

      const tasksSubmittedFor = allSubmissions.map(({ taskId: id }) => id)

      const addExpired = (arr) =>
        arr.map((task) => {
          if (task?.competition?.expiryDate) {
            if (
              new Date(task.competition.expiryDate).getTime() <
              new Date().getTime()
            )
              task.isExpired = true
          }
          return task
        })

      const filteredTasks = addExpired(allTasks).filter(
        ({ isExpired, expiresOn, id }) => {
          if (!expiresOn) return true
          return (
            !tasksSubmittedFor.includes(id) &&
            !isExpired &&
            expiresOn &&
            new Date(expiresOn).getTime() < new Date().getTime()
          )
        }
      )

      const sortedTasks = filteredTasks.sort(
        (a, b) =>
          new Date(a.expiresOn).getTime() - new Date(b.expiresOn).getTime()
      )

      if (sortedTasks.length === 0) {
        const formatted = addExpired(allTasks)
        const notSubmitted = formatted
          .filter(
            ({ isExpired, id }) => !tasksSubmittedFor.includes(id) && !isExpired
          )
          .filter(({ expiresOn }) => {
            if (!expiresOn) return true
            return new Date(expiresOn).getTime() > new Date().getTime()
          })

        const firstTask = notSubmitted[0]

        const secondTask = notSubmitted.find(
          (task) => task.projectId !== firstTask.projectId
        )

        return [firstTask, secondTask]
      }

      const firstTask = sortedTasks[0]

      const secondTask = sortedTasks.find(
        (task) => task.projectId !== firstTask.projectId
      )

      return [firstTask, secondTask]
    } catch (err) {
      console.error(err)
      return ctx.throw(400, 'error decoding token')
    }
  },
  tasksForGuestHomepage: async (ctx) => {
    try {
      const allProjects = await strapi.query('project').find()
      const allTasks = []

      const filteredProjects = allProjects.filter(
        ({ published_at, landingPageOnly }) =>
          !!published_at && !landingPageOnly
      )

      for (const project of filteredProjects) {
        const { tasks } = project
        const withProject = tasks.map((task) => ({
          ...task,
          projectId: project.id,
          project
        }))
        allTasks.push(...withProject)
      }

      const addExpired = (arr) =>
        arr.map((task) => {
          if (task?.competition?.expiryDate) {
            if (
              new Date(task.competition.expiryDate).getTime() <
              new Date().getTime()
            )
              task.isExpired = true
          }
          return task
        })

      const filteredTasks = addExpired(allTasks).filter(
        ({ isExpired, expiresOn, id }) => {
          if (!expiresOn) return true
          return (
            !isExpired &&
            expiresOn &&
            new Date(expiresOn).getTime() < new Date().getTime()
          )
        }
      )

      const sortedTasks = filteredTasks.sort(
        (a, b) =>
          new Date(a.expiresOn).getTime() - new Date(b.expiresOn).getTime()
      )

      if (sortedTasks.length === 0) {
        const formatted = addExpired(allTasks)
          .filter(({ isExpired }) => !isExpired)
          .filter(({ expiresOn }) => {
            if (!expiresOn) return true
            return new Date(expiresOn).getTime() > new Date().getTime()
          })

        const firstTask = formatted[0]

        const secondTask = formatted.find(
          (task) => task.projectId !== firstTask.projectId
        )

        return [firstTask, secondTask]
      }

      const firstTask = sortedTasks[0]

      const secondTask = sortedTasks.find(
        (task) => task.projectId !== firstTask.projectId
      )

      return [firstTask, secondTask]
    } catch (err) {
      console.error(err)
      return ctx.throw(400, 'error decoding token')
    }
  },
  removeUserFromProject: async (ctx) => {
    const { request } = ctx
    const { id: userId, slug } = request.body

    const accessToken = ctx.request.header['x-lithium-token']

    if (!accessToken) return ctx.throw(400, 'No token provided')

    try {
      const { accountId: accountIdFromToken } = decodeToken(accessToken)

      if (Number(accountIdFromToken) !== Number(userId))
        return ctx.throw(400, 'You do not have access to this resource')

      const project = await strapi.query('project').findOne({ slug })

      if (!project) return ctx.throw(400, 'Project not found')

      const user = await strapi.query('account').findOne({ id: userId })

      const { projects: userProjects } = user

      const userProjectIds = userProjects.map((project) => project.id)

      if (!userProjectIds.includes(project.id))
        return ctx.badRequest('User has not subscribed to this project!')

      const updatedUser = await strapi.query('account').update(
        { id: user.id },
        {
          projects: [...userProjectIds].filter((id) => id !== project.id)
        }
      )

      if (!updatedUser) return ctx.throw(400, 'Error adding user to project')

      return sanitizeEntity(project, { model: strapi.models.project })
    } catch (err) {
      console.error(err)
      return ctx.throw(400, 'error adding user to project')
    }
  },
  addUserToProject: async (ctx) => {
    const { request } = ctx
    const { id: userId, slug } = request.body

    const accessToken = ctx.request.header['x-lithium-token']

    if (!accessToken) return ctx.throw(400, 'No token provided')

    try {
      const { accountId: accountIdFromToken } = decodeToken(accessToken)

      if (Number(accountIdFromToken) !== Number(userId))
        return ctx.throw(400, 'You do not have access to this resource')

      const project = await strapi.query('project').findOne({ slug })

      if (!project) return ctx.throw(400, 'Project not found')

      const user = await strapi.query('account').findOne({ id: userId })

      const { projects: userProjects } = user

      const userProjectIds = userProjects.map((project) => project.id)

      if (userProjectIds.includes(project.id))
        return ctx.badRequest('User already added to project')

      await checkAndCreateAllocation(
        ctx,
        userId,
        project.id,
        project?.baselineAllocation ?? 0
      )

      const updatedUser = await strapi.query('account').update(
        { id: user.id },
        {
          projects: [...userProjectIds, project.id]
        }
      )

      if (!updatedUser) return ctx.throw(400, 'Error adding user to project')

      return sanitizeEntity(project, { model: strapi.models.project })
    } catch (err) {
      console.error(err)
      return ctx.throw(400, 'error adding user to project')
    }
  },
  summary: async (ctx) => {
    const accessToken = ctx.request.header['x-lithium-token']

    if (!accessToken) return ctx.throw(400, 'No token provided')

    try {
      const { WalletAddress } = decodeToken(accessToken)
      const projects = await strapi.query('project').find()
      const user = await strapi.query('account').findOne({ WalletAddress })
      const { projects: userProjects } = user
      const userProjectIds = userProjects.map((project) => project.id)
      return projects
        .filter(
          ({ published_at, landingPageOnly }) =>
            published_at && !landingPageOnly
        )
        .map((project) => ({
          slug: project.slug,
          name: project.name,
          img:
            project?.projectMedia?.projectThumbnail?.url ??
            project?.pool?.about?.logo?.url,
          description: project?.tagline,
          isEnrolled: userProjectIds.includes(project.id)
        }))
    } catch (err) {
      console.error(err)
      return ctx.badRequest('error decoding token')
    }
  },
  getProjectBySlugLanding: async (ctx) => {
    const { slug } = ctx.params
    const project = await strapi.query('project').findOne({ slug })
    if (!project) return ctx.throw(400, 'Project not found')
    return sanitizeEntity(project, { model: strapi.models.project })
  },
  getProjectBySlug: async (ctx) => {
    const { slug } = ctx.params
    const project = await strapi.query('project').findOne({ slug })
    if (!project || project?.landingPageOnly || !project?.published_at)
      return ctx.throw(400, 'Project not found')
    return sanitizeEntity(project, { model: strapi.models.project })
  },
  featuredProject: async (ctx) => {
    const projects = await strapi
      .query('project')
      .find({ isFeaturedProject: true })
    if (!projects) return ctx.throw(400, 'No featurd projects')

    const sorted = projects.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )

    const featuredProject = sorted[0]

    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) continue
      try {
        await strapi
          .query('project')
          .update({ id: sorted[i].id }, { isFeaturedProject: false })
      } catch (error) {
        console.error(error)
        ctx.throw('error updating featured project')
      }
    }

    return sanitizeEntity(featuredProject, { model: strapi.models.project })
  },
  getLeaderboard: async (ctx) => {
    const { slug } = ctx.params
    const { page = 0, per_page = PAGE_LENGTH } = ctx.query
    const startingAt = Number(page) * Number(per_page)
    const project = await strapi.query('project').findOne({
      slug
    })
    if (!project) return ctx.throw(400, 'Project not found')
    const { id: projectId } = project
    const knex = strapi.connections.default

    const allXpAwardedForProject = await knex('user_project_xps')
      .where('project', projectId)
      .orderBy('created_at', 'desc')

    const createSerialisedXpObject = (submissions) =>
      submissions.reduce((acc, xpObj) => {
        const { account, XP, created_at } = xpObj
        const isWeekTimeframe = isWithinInterval(created_at, {
          start: sub(new Date(), { weeks: 1 }),
          end: new Date()
        })

        const isMonthTimeframe = isWithinInterval(created_at, {
          start: sub(new Date(), { days: 30 }),
          end: new Date()
        })

        if (acc?.[account]?.XP) {
          acc[account] = {
            XP: acc[account].XP + XP,
            totalSubmissions: acc[account].totalSubmissions + 1,
            weeklySubmissions: isWeekTimeframe
              ? acc[account].weeklySubmissions + 1
              : acc[account].weeklySubmissions,
            monthlySubmissions: isMonthTimeframe
              ? acc[account].monthlySubmissions + 1
              : acc[account].monthlySubmissions
          }
          return acc
        }
        acc[account] = {
          XP,
          totalSubmissions: 1,
          weeklySubmissions: isWeekTimeframe ? 1 : 0,
          monthlySubmissions: isMonthTimeframe ? 1 : 0
        }
        return acc
      }, {})

    const filterDaysInterval = (arr, interval) =>
      arr.filter(({ created_at }) =>
        isWithinInterval(created_at, {
          start: sub(new Date(), { days: interval }),
          end: new Date()
        })
      )

    const convertXpObjectToRankedArray = (xpObject, type = 'all') =>
      Object.entries(xpObject)
        .map(
          ([
            account,
            { XP, totalSubmissions, weeklySubmissions, monthlySubmissions }
          ]) => {
            const baseObj = {
              account,
              XP
            }
            if (type === 'all') {
              baseObj.totalSubmissions = totalSubmissions
              return baseObj
            }
            if (type === 'weekly') {
              baseObj.weeklySubmissions = weeklySubmissions
              return baseObj
            }
            baseObj.monthlySubmissions = monthlySubmissions
            return baseObj
          }
        )
        .sort((a, b) => b.XP - a.XP)
        .slice(startingAt, startingAt + Number(per_page))

    const getDisplayNameFromUser = (user) => {
      if (!user) return 'Unknown'
      if (!!user?.username) return user.username
      if (!!user?.twitterHandle) return user.twitterHandle
      if (!!user?.discordHandle) return user.discordHandle
      if (!!user?.WalletAddress) return user.WalletAddress
      return 'Unknown'
    }

    const thisWeeksSubmissions = filterDaysInterval(allXpAwardedForProject, 7)

    const lastThirtyDaysSubmissions = filterDaysInterval(
      allXpAwardedForProject,
      30
    )

    const weekSerialisedXpObject =
      createSerialisedXpObject(thisWeeksSubmissions)

    const topRankedThisWeek = convertXpObjectToRankedArray(
      weekSerialisedXpObject,
      'weekly'
    )

    const thirtyDaysSerialisedXpObject = createSerialisedXpObject(
      lastThirtyDaysSubmissions
    )
    const topRankedLastThirtyDays = convertXpObjectToRankedArray(
      thirtyDaysSerialisedXpObject,
      'monthly'
    )

    const allTimeSerialisedXpObject = createSerialisedXpObject(
      allXpAwardedForProject
    )
    const topRankedAllTime = convertXpObjectToRankedArray(
      allTimeSerialisedXpObject
    )

    const uniqueWeeklyUserCount = Object.keys(weekSerialisedXpObject).length
    const uniqueThirtyDayUserCount = Object.keys(
      thirtyDaysSerialisedXpObject
    ).length
    const uniqueAllTimeUserCount = Object.keys(allTimeSerialisedXpObject).length

    const allUserIds = [...topRankedAllTime.map(({ account }) => account)]

    const allUsersFeaturedInRankings = await strapi.query('account').find({
      id_in: allUserIds
    })

    const serialisedUsers = allUsersFeaturedInRankings.reduce(
      (acc, user) => ({
        ...acc,
        [user.id]: {
          displayName: getDisplayNameFromUser(user),
          weeklySubmissions:
            weekSerialisedXpObject[user.id]?.weeklySubmissions || 0,
          monthlySubmissions:
            thirtyDaysSerialisedXpObject[user.id]?.monthlySubmissions || 0,
          totalSubmissions:
            allTimeSerialisedXpObject[user.id]?.totalSubmissions || 0,
          weeklyGainInXp: weekSerialisedXpObject[user.id]?.XP || 0,
          totalXp: allTimeSerialisedXpObject[user.id]?.XP || 0
        }
      }),
      {}
    )

    const topGainers = Object.entries(serialisedUsers)
      .map(([id, user]) => ({
        id,
        weeklyGain: user.weeklyGainInXp
      }))
      .sort((a, b) => b.weeklyGain - a.weeklyGain)
      .slice(0, 3)
      .map(({ id }) => id)

    return {
      topGainers,
      topRankedThisWeek,
      topRankedLastThirtyDays,
      topRankedAllTime,
      serialisedUsers,
      meta: {
        uniqueWeeklyUserCount,
        uniqueThirtyDayUserCount,
        uniqueAllTimeUserCount
      }
    }
  },
  checkAndCreateAllocation
}
