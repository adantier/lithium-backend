/* eslint-disable no-undef */
const { createPool } = require('../../src/contracts/admin')

const {
  USDC_instantclaim,
  USDC_tokenFree
} = require('./Deploy_by_contract_version/index')

const { dynamicWeb3Net } = require('../../src/web3')
const { processWhitelistCSVs, addSingleWhitelist } = require('./whitelist')

module.exports = (strapi) => {
  return {
    initialize() {
      strapi.app.use(async (ctx, next) => {
        const { request } = ctx

        console.log('DATA', JSON.stringify(request?.body, null, 2))
        if (
          request.method === 'PUT' &&
          request.url.substring(0, 59) ===
            '/content-manager/collection-types/application::pools.pools/'
        ) {
          console.log('PUT')

          const id = request.url.substr(59)
          const data = request.body
          const {
            status: statusOld,
            isDeployed: isDeployedOld,
            poolAddress: poolAddressOld
          } = await strapi.query('pools').findOne({ id })
          const { status: statusNew, isDeployed } = data
          const { chainID } = request.body
          const mainNet = chainID === 'Polygon_Mainnet_137'
          const chainIdNumber = parseInt(
            chainID.split('_')[chainID.split('_').length - 1]
          )

          const shouldUpdateWhitelist = data?.updateWhitelist

          if (isDeployed && shouldUpdateWhitelist) {
            const poolAddress = data?.poolAddress

            if (!poolAddress)
              ctx.throw(400, 'Pool has no address but is scheduled!')

            const proceed = async () => {
              ctx.request.body = {
                ...ctx.request.body,
                updateWhitelist: false
              }
              return await next()
            }

            if (!data?.whitelists?.length) {
              proceed()
            }

            for (let i = 0; i < data.whitelists.length; i++) {
              const id = data.whitelists[i]
              // fetch whitelist entity from strapi
              const whitelistEntity = await strapi.query('whitelist').findOne({
                id
              })

              if (!whitelistEntity)
                ctx.throw(400, `Whitelist with id ${id} not found`)

              const {
                hasMissionControlAddedAllocations,
                generatedJSONWithMissionControlAllocations,
                whitelistCsv
              } = whitelistEntity

              await addSingleWhitelist(
                strapi,
                ctx,
                whitelistEntity,
                poolAddress,
                chainIdNumber
              )

              // send to whitelist process method
            }

            return proceed()
          }

          const { version } = await strapi
            .query('deploy-version')
            .findOne({ id: '1' })

          const {
            address: addressCurrentContract,
            address_testnet: addressCurrentTestnetContract,
            abi: abiCurrentContract
          } = await strapi
            .query('sontracts-for-deployment') //contracts_for_deploy
            .findOne({ name: version })

          const web3Net = dynamicWeb3Net(chainIdNumber)

          ctx.request.body = {
            ...data,
            poolAddress: data?.poolAddress && data.poolAddress.toLowerCase()
          }

          if (
            statusOld !== statusNew &&
            statusNew === 'Incoming' &&
            !data.poolAddress
          ) {
            ctx.request.body = {
              ...data,
              poolAddress:
                '0x' +
                data.name.replace(/\s/g, '').toLowerCase() +
                '_will_be_deploy_soon_' +
                Math.random().toString(36).substring(2)
            }
          }

          if (
            statusOld !== statusNew &&
            statusOld === 'Scheduled' &&
            statusNew !== 'Completed' &&
            statusNew !== 'Deny' &&
            poolAddressOld &&
            !data.poolAddress
          ) {
            ctx.throw(400, 'You cannot change the status from "Scheduled"')
          }

          if (
            statusOld !== statusNew &&
            statusNew === 'Scheduled' &&
            !isDeployedOld
          ) {
            const chooseDeploy = (deploy_version) => {
              switch (deploy_version) {
                case 'USDC_instantclaim':
                  return USDC_instantclaim(ctx, data)
                case 'USDC_tokenFree':
                  return USDC_tokenFree(ctx, data)
                default:
                  ctx.throw(
                    400,
                    'There is no specified function for the selected deployment version'
                  )
              }
            }

            const params = await chooseDeploy(version)

            try {
              console.log('=============== Params ============', params)
              console.log(
                '=============== SETTINGS ============',
                'NET ' + (mainNet ? 'web3MaiNet' : 'web3TestNet'),
                'ABI ' + !!abiCurrentContract,
                'addressCurrentContract ' + !!mainNet
                  ? addressCurrentContract
                  : addressCurrentTestnetContract
              )
              const result = await createPool(
                params,
                mainNet,
                abiCurrentContract,
                mainNet
                  ? addressCurrentContract
                  : addressCurrentTestnetContract,
                chainIdNumber
              )
              console.log(
                JSON.stringify(result, null, 2),
                'Save data in strapi'
              )

              const poolAddress = result.logs[0].address.toLowerCase()
              // add to whitelist

              const hasWhiltelists = data?.whitelists?.[0]?.whitelistCSV

              if (hasWhiltelists) {
                for (let i = 0; i < data?.whitelists; i++) {
                  const whitelist = data[i]
                  console.log(
                    { whitelist },
                    'whitelist pre deploy end post publish pool to chain'
                  )
                  // await processWhitelistCSVs(
                  //   strapi,
                  //   ctx,
                  //   whitelist,
                  //   poolAddress,
                  //   chainIdNumber
                  // );
                }
              }
              ctx.request.body = {
                ...data,
                isDeployed: true,
                poolAddress
              }
              console.log(
                '======================================================== TOPICS',
                web3Net?.utils.asciiToHex(
                  web3Net?.utils
                    .hexToAscii(result.logs[result.logs.length - 1].data)
                    .substr(12)
                )
              )
              console.log(
                'Pool created!',
                result,
                result.logs[result.logs.length - 1]
              )

              await next()
            } catch (e) {
              console.log('Pool creation error!')
              console.log('ERR ', e)
              ctx.throw(400, 'POOL CREATION ERROR! ', e)
            }
          } else {
            ctx.request.body = {
              ...ctx.request.body
            }
            await next()
          }
        } else {
          await next()
        }
      })
    }
  }
}
