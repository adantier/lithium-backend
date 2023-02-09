const Web3 = require('web3')
const axios = require('axios')

/* eslint-disable no-undef */
const { BigNumber: BN } = require('ethers')
const { chainDetails } = require('./chainDetails')

const amountToWei = (amount = '0', decimal = 18) => {
  return new BN.from(new BN.from(amount).mul(new BN.from(10).pow(decimal)))
}

const getGasFeesPolygon = async (chainId) => {
  let maxFeePerGas = new BN.from(400000000000) // fallback to 40 gwei
  let maxPriorityFeePerGas = new BN.from(400000000000) // fallback to 40 gwei
  // let maxFeePerGas = new BN.from(40000000000); // fallback to 40 gwei
  // let maxPriorityFeePerGas = new BN.from(40000000000); // fallback to 40 gwei
  try {
    const { data } = await axios({
      method: 'get',
      url:
        chainId === 137
          ? 'https://gasstation-mainnet.matic.network/v2'
          : 'https://gasstation-mumbai.matic.today/v2'
    })

    maxFeePerGas = amountToWei(new BN.from(Math.ceil(data.fast.maxFee)), 10)
    maxPriorityFeePerGas = amountToWei(Math.ceil(data.fast.maxPriorityFee), 10)

    return { maxFeePerGas, maxPriorityFeePerGas }
  } catch (error) {
    console.error('failed to get gas estimation, using defaults ', error)
    return { maxFeePerGas, maxPriorityFeePerGas }
  }
}

const web3MaiNet = new Web3(
  new Web3.providers.HttpProvider('https://bsc-dataseed.binance.org/')
)

const web3MaiNetPolygone = new Web3(
  new Web3.providers.HttpProvider('https://polygon-rpc.com')
)

const web3TestNetPolygone = new Web3(
  new Web3.providers.HttpProvider(
    'https://polygon-mumbai.g.alchemy.com/v2/cntlzb4kJT-9BFLrGaSrei-_ZdB6HpkH'
  )
)

const dynamicProvider = (chainId) =>
  new Web3(new Web3.providers.HttpProvider(chainDetails[chainId].rpc[0]))

const web3TestNet = async () =>
  new Web3(
    new Web3.providers.HttpProvider(
      'https://polygon-mumbai.g.alchemy.com/v2/cntlzb4kJT-9BFLrGaSrei-_ZdB6HpkH'
    )
  )

const dynamicWeb3Net = (chainId) => dynamicProvider(chainId)

async function send(
  transaction,
  mainNet = true,
  polygon = false,
  chainId = null
) {
  console.log(chainId, 'chainId')
  console.log(mainNet, 'mainNet')
  console.log(polygon, 'polygon')
  const web3Net = chainId
    ? await dynamicProvider(chainId)
    : polygon
    ? mainNet
      ? web3MaiNetPolygone
      : web3TestNetPolygone
    : mainNet
    ? web3MaiNet
    : await web3TestNet()

  console.log(
    chainId
      ? chainDetails[chainId].name
      : polygon
      ? mainNet
        ? 'web3MaiNetPolygone'
        : 'web3TestNetPolygone'
      : mainNet
      ? 'web3MaiNet'
      : 'web3TestNet'
  )

  console.log('Send', 'estimateGas')
  console.log('transaction', transaction.arguments)
  let gas = null
  try {
    const gasCache = await transaction
      .estimateGas({ from: process.env.ADDRESS_FROM })
      .catch((err) => {
        throw err?.message ?? 'Failed to estimate gas'
      })
    console.log({ gasCache: typeof gasCache })
    if (gasCache) gas = Number(gasCache) * 1.25
  } catch (e) {
    console.log(e)
  }
  const gasVar = chainId === 137 ? 10000000 : 5000000
  const gasPrice = await web3Net.eth.getGasPrice()

  let maxFeePerGas = new BN.from(1100000000000) // fallback to 40 gwei
  let maxPriorityFeePerGas = new BN.from(1100000000000) // fallback to 40 gwei

  const options = {
    to: transaction._parent._address,
    data: transaction.encodeABI(),
    gas: gasVar
  }

  if (chainId === 137 || chainId === 80001) {
    const { maxFeePerGas: gasFromApi, maxPriorityFeePerGas: feeFromApi } =
      await getGasFeesPolygon(chainId)
    maxFeePerGas = gasFromApi
    maxPriorityFeePerGas = feeFromApi

    options.maxFeePerGas = maxFeePerGas
    options.maxPriorityFeePerGas = maxPriorityFeePerGas
  } else {
    options.gas = 20000000
    options.gasPrice = new BN.from(gasPrice).mul(11).div(10).toString()
  }

  console.log('Send', 'set options && decodeABI', 'gas ' + gas)

  console.log(Object.keys(transaction), 'tx object keys')
  console.log('parsed options', JSON.stringify(options, null, 2))

  // const sync = await web3Net.eth.isSyncing();
  const balance = await web3Net.eth.getBalance(process.env.ADDRESS_FROM)
  console.log('reached balance', balance)
  console.log('reached gasPrice', gasPrice)
  const fundsNeeded = gas * gasVar
  console.log('reached gasPrice', gasPrice)
  console.log('fundsNeeded', fundsNeeded)
  console.log(
    'balance ' + process.env.ADDRESS_FROM + ' Account',
    // "sync ? ",
    // sync, // it`s call type err
    'balance',
    balance
  )
  console.log(options.to, 'options.to')
  console.log(options.data.split('').length, 'abi length')

  console.log('Send', 'signTransaction')
  const signedTransaction = await web3Net.eth.accounts.signTransaction(
    options,
    process.env.PRIVATE_KEY
  )
  console.log(
    'Send',
    'sendSignedTransaction',
    signedTransaction?.transactionHash
  )

  try {
    const sendSignedTransaction = await web3Net.eth
      .sendSignedTransaction(signedTransaction.rawTransaction)
      .catch((err) => console.log(err, 'in sendSignedTransaction'))
    console.log('Sended', sendSignedTransaction)
    return sendSignedTransaction
  } catch (error) {
    console.log(error, 'in sendSignedTransaction')
    return error
  }
}

module.exports = {
  web3TestNet,
  web3MaiNet,
  web3MaiNetPolygone,
  web3TestNetPolygone,
  dynamicProvider,
  dynamicWeb3Net,
  amountToWei,
  send
}
