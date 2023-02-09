const {
  web3MaiNet,
  web3TestNet,
  dynamicProvider,
  send,
} = require("../../../src/web3");

/* eslint-disable no-undef */
const { BigNumber: BN } = require("ethers");

const deploy = async (params, address, abi, chainId) => {
  const { tokenSaleAddress, tokenAddress, vestingPoints } = params;

  return await send(
    new (
      await dynamicProvider(chainId)
    ).eth.Contract(abi, address, {
      from: process.env.ADDRESS_FROM,
    }).methods.createVestingSchedule(
      tokenSaleAddress,
      tokenAddress,
      vestingPoints
    ),
    false,
    false,
    chainId
  );
};

module.exports = deploy;
