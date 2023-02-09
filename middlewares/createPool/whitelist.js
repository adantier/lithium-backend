const csv = require("csvtojson");
const requestNode = require("request");
const { BigNumber } = require("ethers");
const Web3 = require("web3");
const { abi } = require("../../src/contracts/tokenSale/abi");

const { createContract } = require("../createVestingContract/tokenSale");
const { send, amountToWei } = require("../../src/web3");

const isValidAddress = (address) => Web3.utils.isAddress(address);

const processWhitelistCSVs = async (
  strapi,
  ctx,
  whitelist,
  poolAddress,
  chainId
) => {
  const { whitelistCSV: whitelistArray, whitelistIndex } = whitelist;

  let whitelistIndexToUpdate = whitelistIndex ?? 0;

  if (
    whitelistArray.length > 0 &&
    whitelistArray.length > whitelistIndexToUpdate
  ) {
    const tokenSaleContract = await createContract(abi, poolAddress, chainId);

    const whitelistSpread = [...whitelistArray];
    const splicedWhitelistArr = whitelistSpread.splice(whitelistIndexToUpdate);
    for (let i = 0; i < splicedWhitelistArr.length; i++) {
      const whitelistObj = splicedWhitelistArr[i];
      const { id } = whitelistObj;
      const csvFile = await strapi.plugins["upload"].services.upload.fetch({
        id,
      });
      if (!csvFile) ctx.throw(400, "Please provide a CSV file");

      if (!csvFile?.url)
        ctx.throw(400, "Couldn't find CSV file upload, please try again");
      const addresses = [];
      const amounts = [];

      const jsonArray = await csv().fromStream(requestNode.get(csvFile.url));
      const [accountKey, amountKey] = Object.keys(jsonArray[0]);

      const checkForDuplicates = (arr) => new Set(arr).size !== arr.length;

      jsonArray.forEach((row) => {
        const address = row[accountKey];
        const amount = row[amountKey];
        if (isValidAddress(address) && amount) {
          addresses.push(address);
          amounts.push(amount.toString());
        }
      });

      if (checkForDuplicates(addresses))
        ctx.throw(400, "Malformed CSV - has duplicate addresses");

      await send(
        tokenSaleContract.methods.userWhitelistAllocation(addresses, amounts),
        false,
        false,
        chainId
      );

      await send(
        tokenSaleContract.methods.whitelistUser(addresses),
        false,
        false,
        chainId
      );

      whitelistIndexToUpdate++;
    }
  }

  return whitelistIndexToUpdate;
};

const addSingleWhitelist = async (
  strapi,
  ctx,
  whitelist,
  poolAddress,
  chainId
) => {
  const tokenSaleContract = await createContract(abi, poolAddress, chainId);

  if (!tokenSaleContract?.methods)
    ctx.throw(400, "Could not find instance of tokensale contract");

  const {
    whitelistCsv,
    hasMissionControlAddedAllocations,
    generatedJSONWithMissionControlAllocations,
  } = whitelist;

  const checkForDuplicates = (arr) => new Set(arr).size !== arr.length;
  const addresses = [];
  const amounts = [];

  if (
    hasMissionControlAddedAllocations &&
    generatedJSONWithMissionControlAllocations
  ) {
    const allAddresses = Object.keys(
      generatedJSONWithMissionControlAllocations
    );
    allAddresses.forEach((address) => {
      addresses.push(address);
      amounts.push(generatedJSONWithMissionControlAllocations[address]);
    });

    if (checkForDuplicates(addresses))
      ctx.throw(400, "Malformed CSV - has duplicate addresses");

    if (addresses.length > 200) {
      do {
        // code block to be executed
        const splicedAddresses = addresses.splice(0, 200);
        const splicedAmounts = amounts.splice(0, 200);

        const sumbittedWhitlistRates = await send(
          tokenSaleContract.methods.userWhitelistAllocation(
            splicedAddresses,
            splicedAmounts
          ),
          false,
          false,
          chainId
        );
        // v x
        const sumbittedWhitlist = await send(
          tokenSaleContract.methods.whitelistUser(splicedAddresses),
          false,
          false,
          chainId
        );

        if (!sumbittedWhitlistRates || !sumbittedWhitlist)
          ctx.throw(400, "Could not add whitelist");
      } while (addresses.length > 200);
    } else {
      const sumbittedWhitlistRates = await send(
        tokenSaleContract.methods.userWhitelistAllocation(addresses, amounts),
        false,
        false,
        chainId
      );

      const sumbittedWhitlist = await send(
        tokenSaleContract.methods.whitelistUser(addresses),
        false,
        false,
        chainId
      );

      if (!sumbittedWhitlistRates || !sumbittedWhitlist)
        ctx.throw(400, "Could not add whitelist");
    }

    return;
  }

  const id = whitelistCsv?.id;
  if (!id) ctx.throw("Please provide a CSV file");
  const csvFile = await strapi.plugins["upload"].services.upload.fetch({
    id,
  });
  if (!csvFile?.url)
    ctx.throw(400, "Couldn't find CSV file upload, please try again");

  const jsonArray = await csv().fromStream(requestNode.get(csvFile.url));
  const [accountKey, amountKey] = Object.keys(jsonArray[0]);

  for (let i = 0; i < jsonArray.length; i++) {
    const row = jsonArray[i];
    const address = row[accountKey];
    const amount = row[amountKey];
    if (isValidAddress(address) && amount) {
      addresses.push(address);
      amounts.push(amount.toString());
    }
  }

  if (checkForDuplicates(addresses))
    ctx.throw(400, "Malformed CSV - has duplicate addresses");

  const sumbittedWhitlistRates = await send(
    tokenSaleContract.methods.userWhitelistAllocation(addresses, amounts),
    false,
    false,
    chainId
  );

  const sumbittedWhitlist = await send(
    tokenSaleContract.methods.whitelistUser(addresses),
    false,
    false,
    chainId
  );

  if (!sumbittedWhitlistRates || !sumbittedWhitlist)
    ctx.throw(400, "Could not add whitelist");

  return;
};

module.exports = {
  processWhitelistCSVs,
  amountToWei,
  addSingleWhitelist,
  isValidAddress,
};
