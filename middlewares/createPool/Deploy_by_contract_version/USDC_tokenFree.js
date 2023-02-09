const { BigNumber: BN } = require("ethers");

const deploy = async (ctx, data) => {
  if (!data?.PoolSettings?.hardCap)
    ctx.throw(400, "Hard cap (total sale supply) is required");
  if (!data?.PoolSettings?.globalMaxAllocation)
    ctx.throw(400, "Global Max alloocation rate is required");
  if (!data?.PoolSettings?.poolTaxRate)
    ctx.throw(400, "Pool tax rate is required");
  if (!data?.PoolSettings?.whitelistTaxRate)
    ctx.throw(400, "Whitelist tax rate is required");

  const totalSaleSupply = BN.from(data.PoolSettings.hardCap).mul(
    BN.from("10").pow(6)
  );

  const isKYCPool = Boolean(data.PoolSettings.requiresKYC);

  const maxAllocation = BN.from(data.PoolSettings.globalMaxAllocation);
  const globalTaxRate = BN.from(data.PoolSettings.poolTaxRate).mul(10);
  const whitelistTxRate = BN.from(
    data?.PoolSettings?.whitelistTaxRate ?? 20
  ).mul(10);

  const privateStart = Math.round(
    new Date(data.privateSale.start).getTime() / 1000
  ).toString();

  const privateEnd = Math.round(
    new Date(data.privateSale.end).getTime() / 1000
  ).toString();

  // adds 6 decimal wei to priceValue
  const priceInUSDCWei = parseFloat(data.privateSale.price) * 1000000;

  const privateTokenPrice = BN.from(priceInUSDCWei);

  return {
    params: {
      totalSupply: totalSaleSupply.toString(),
      privateStart,
      privateTokenPrice,
      privateEnd,
    },
    maxAllocation,
    globalTaxRate,
    isKYCPool,
    whitelistTxRate,
  };
};

module.exports = deploy;
