// const Admins = require("./abi");
const { web3MaiNet, web3TestNet, send } = require("../../web3");

// const adminContract = new web3.eth.Contract(Admins.abi, Admins.address, {
//   from: process.env.ADDRESS_FROM,
// });

async function createPool(paramsObj, mainNet, abi, address, chainId) {
  console.log("Creating pool START");
  console.log(paramsObj, "Creating pool with these params");

  const { params, maxAllocation, globalTaxRate, isKYCPool, whitelistTxRate } =
    paramsObj;
  return await send(
    new (
      await (mainNet ? web3MaiNet : web3TestNet())
    ).eth.Contract(abi, address, {
      from: process.env.ADDRESS_FROM,
    }).methods.createPoolNew(
      Object.keys(params).map((key) => params[key]),
      maxAllocation,
      globalTaxRate,
      isKYCPool,
      whitelistTxRate
    ),
    mainNet,
    false,
    chainId
  );
}
module.exports = { createPool };
