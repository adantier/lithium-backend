const { send } = require("../../../src/web3");

const populateDeposits = async (contract, users, stakes, chainId) => {
  return await send(
    contract.methods.updateUserDeposit(users, stakes),
    false,
    false,
    chainId
  );
};
module.exports = { populateDeposits };
