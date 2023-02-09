/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const { sanitizeEntity } = require('strapi-utils')

const supportChain = [
  { stringID: 'Binance_Smart_Chain_Mainnet_56', chainID: '56', mainnet: true },
  { stringID: 'Binance_Smart_Chain_Testnet_97', chainID: '97', mainnet: false },
  { stringID: 'Polygon_Mainnet_137', chainID: '137', mainnet: true },
  { stringID: 'Polygon_Testnet_80001', chainID: '80001', mainnet: false }
]

function swapChainIDtoString(сhainIDNum) {
  switch (сhainIDNum) {
    case supportChain.find((chainIDSup) => chainIDSup.chainID === сhainIDNum)
      ?.chainID:
      return supportChain.find(
        (chainIDSup) => chainIDSup.chainID === сhainIDNum
      )?.stringID
    default:
      return сhainIDNum
  }
}

function swapStringtoChainID(stringChainId) {
  switch (stringChainId) {
    case supportChain.find(
      (chainIDSup) => chainIDSup.stringID === stringChainId
    )?.stringID:
      return supportChain.find(
        (chainIDSup) => chainIDSup.stringID === stringChainId
      )?.chainID
    default:
      return stringChainId
  }
}

module.exports = {
  async find(ctx) {
    let entities
    if (ctx.query._q) {
      entities = await strapi.services.pools.search(ctx.query)
    } else {
      if ('mainnet' in ctx.query) {
        let queryWithoutNet = { ...ctx.query }
        delete queryWithoutNet.mainnet
        entities = await strapi.services.pools.find({
          ...queryWithoutNet,
          chainID_in: supportChain
            .map((el) => {
              if (el.mainnet === (ctx.query.mainnet === 'true')) {
                return el.stringID
              }
            })
            .filter((el) => el)
        })
      } else if (ctx.query?.chainID) {
        entities = await strapi.services.pools.find({
          ...ctx.query,
          chainID: swapStringtoChainID(ctx.query?.chainID)
        })
      } else {
        entities = await strapi.services.pools.find(ctx.query)
      }
    }

    if ('mainnet' in ctx.query && 'isOldPool' in ctx.query) {
      entities = await Promise.all(
        entities.map(async (poolItem) => {
          try {
            const masterI = await strapi.services['contract-interface'].findOne(
              {
                id: poolItem?.poolContract?.[0]?.master
                  .contractInterfaceFields[0].id
              }
            )
            return { ...poolItem, masterContractInterface: masterI?.interface }
          } catch (error) {
            console.error("ERROR PARSE 'contract-interface' IN CONTROLLER")
          }
        })
      )
    }

    const allProjects = await strapi.services.project.find()

    const landingPageOnlyPools = allProjects
      .filter((project) => project?.landingPageOnly && project?.pool?.id)
      .map((project) => project?.pool?.id)
      .filter((v) => v)

    return entities
      .filter(({ id }) => !landingPageOnlyPools.includes(id))
      .map((entity) =>
        sanitizeEntity(
          { ...entity, chainID: swapStringtoChainID(entity.chainID) },
          { model: strapi.models.pools }
        )
      )
  }
}
