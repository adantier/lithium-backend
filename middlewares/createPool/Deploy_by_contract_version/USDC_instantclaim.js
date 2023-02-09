const { send } = require("../../../src/web3");
const { deployToken } = require("../../../src/contracts/lptoken");
const { BigNumber: BN } = require("ethers");

const deploy = async (ctx, data) => {
  let totalSaleSupplyInCMSValue = BN.from(data.totalSaleSupply);

  if (!totalSaleSupplyInCMSValue) {
    ctx.throw(400, "These are required fields: TotalSaleSupply");
  }

  const totalSaleSupply = BN.from(data.totalSaleSupply).mul(
    BN.from("10").pow(data.decimals)
  );

  console.log(
    "===================== SET PARAMS ================= DATA: ==",
    data
  );

  const privateStart = Math.round(
    new Date(data.privateSale.start).getTime() / 1000
  ).toString();

  const privateEnd = Math.round(
    new Date(data.privateSale.end).getTime() / 1000
  ).toString();

  const priceFloat = parseFloat(data.privateSale.price) * 100000000;

  const privateTokenPrice = BN.from("1")
    .mul(BN.from("10").pow("10"))
    .mul(priceFloat);

  return {
    token: "dummy",
    params: {
      totalSupply: totalSaleSupply.toString(),
      privateStart,
      privateTokenPrice,
      privateEnd,
    },
  };
};

module.exports = deploy;
