const { dynamicProvider } = require("../../../src/web3");

const { BigNumber: BN } = require("ethers");

const createContract = async (abi, address, chainId) =>
  await new (
    await dynamicProvider(chainId)
  ).eth.Contract(abi, address, {
    from: process.env.ADDRESS_FROM,
  });

const getUsersWhoInvested = async (contract) => {
  const allUserAddresses = [];

  let hasError = false;
  for (let i = 0; i < 100000; i++) {
    const user = await contract.methods
      .usersOnDeposit(i)
      .call()
      .catch((e) => {
        hasError = true;
      });

    if (user === "0") break;
    if (hasError) break;
    allUserAddresses.push(user);
  }
  return allUserAddresses;
};

const getRates = async (contract) => {
  const poolState = await contract.methods.getState().call();

  const totalSold = poolState["0"];
  const supplyValue = poolState["1"];

  return { totalSold, supplyValue };
};

const hasOversold = (totalSold, supplyValue) => {
  return new BN.from(totalSold).gt(new BN.from(supplyValue));
};

const getStakes = async (contract, userAddress) => {
  const stakes = await contract.methods.stakes(userAddress).call();
  return stakes["amount"];
};

const distribute = async (contract, usersWithStakes) => {};

module.exports = {
  createContract,
  getUsersWhoInvested,
  hasOversold,
  getStakes,
  getRates,
};
