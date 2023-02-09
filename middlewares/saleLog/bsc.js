const axios = require("axios");
const BigNumber = require("bignumber.js");

// const saleAddress = "0x56f2eC99854b38FFa8C8638865C299355c0384f9";
// const saleAddress = "0x2bfA297ea0d3e4559D306e1Ad4b014e8aC4eE411";

async function bscParse(masterContract, mainnet, saleAddress, ctx) {
  /**
   * Set input data and events
   */

  const tokensForSale = await masterContract.methods
    .saleTokensAmountWithoutAirdrop()
    .call();

  const startBlock = 1;
  const endBlock = "latest";

  console.log(
    "eventsTransfer GET",
    `https://${
      mainnet ? "api" : "api-testnet"
    }.bscscan.com/api?module=account&action=txlist&address=${saleAddress}&startblock=${startBlock}&endblock=${endBlock}&sort=asc&apikey=NRFAT7KVN7TBUFENPP2YXUP1C3QCIBC7E9`
  );

  const eventsTransfer = await axios.get(
    `https://${
      mainnet ? "api" : "api-testnet"
    }.bscscan.com/api?module=account&action=txlist&address=${saleAddress}&startblock=${startBlock}&endblock=${endBlock}&sort=asc&apikey=NRFAT7KVN7TBUFENPP2YXUP1C3QCIBC7E9`
  );

  if (eventsTransfer.data.status === "0") {
    ctx.throw(400, eventsTransfer.data.message);
  }
  console.log(
    "eventsTransfer GET RESULT",
    eventsTransfer.data.status,
    eventsTransfer.data.result.length
  );

  console.log(
    "internalTransfer GET",
    `https://${
      mainnet ? "api" : "api-testnet"
    }.bscscan.com/api?module=account&action=txlistinternal&address=${saleAddress}&startblock=${startBlock}&endblock=${endBlock}&sort=asc&apikey=NRFAT7KVN7TBUFENPP2YXUP1C3QCIBC7E9`
  );

  const internalTransfer = await axios.get(
    `https://${
      mainnet ? "api" : "api-testnet"
    }.bscscan.com/api?module=account&action=txlistinternal&address=${saleAddress}&startblock=${startBlock}&endblock=${endBlock}&sort=asc&apikey=NRFAT7KVN7TBUFENPP2YXUP1C3QCIBC7E9`
  );

  console.log(
    "internalTransfer GET RESULT",
    internalTransfer.data.status,
    eventsTransfer.data.result.length
  );

  if (internalTransfer.data.status === "0") {
    ctx.throw(400, internalTransfer.data.message);
  }

  let users = {};
  let txHash = [];
  let sum = 0;
  /**
   * Set unique users
   */
  eventsTransfer.data.result.forEach((el) => {
    if (el.isError === "0") {
      if (!users[el.from]) {
        users[el.from] = {
          paid: 0,
        };
      }
      if (el.input === "0xd0e30db0") {
        users[el.from]["paid"] += Number(el.value);
        txHash.push(el.hash);
        sum += Number(el.value);
      }
    }
  });

  internalTransfer.data.result.forEach((el) => {
    if (
      txHash.indexOf(el.hash) > -1 &&
      el.from === saleAddress.toLowerCase() &&
      Number(el.value) > 0
    ) {
      users[el.to]["paid"] -= Number(el.value);
      sum -= Number(el.value);
    }
  });

  for (let i = 0; i < Object.keys(users).length; i++) {
    users[Object.keys(users)[i]] = new BigNumber(
      users[Object.keys(users)[i]]["paid"]
    )
      .times(new BigNumber(tokensForSale))
      .div(new BigNumber(sum));
  }

  console.log("Data for distribution has been collected!");

  console.log(users);

  let merkleData = [];

  for (const [address, amount] of Object.entries(users)) {
    merkleData.push({
      address: address,
      amount: amount.toFixed(0),
    });
  }
  console.log("Data for distribution has been written!");
  return merkleData;
}

module.exports = {
  bscParse,
};
