const {
  web3MaiNet,
  web3TestNet,
  dynamicProvider,
  send,
} = require("../../../src/web3");

/* eslint-disable no-undef */
const { BigNumber: BN } = require("ethers");

const deployVestingContract = async (params, address, abi, chainId) => {
  const { multisigWallet, tokenSaleAddress, tokenAddress, vestingPoints } =
    params;

  return await send(
    new (
      await dynamicProvider(chainId)
    ).eth.Contract(abi, address, {
      from: process.env.ADDRESS_FROM,
    }).methods.createVestingSchedule(
      tokenSaleAddress,
      tokenAddress,
      multisigWallet,
      vestingPoints
    ),
    false,
    false,
    chainId
  ).catch(function (err) {
    console.error(err, "in catch");
  });
};

module.exports = deployVestingContract;
