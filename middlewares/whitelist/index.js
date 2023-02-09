const csv = require("csvtojson");
const requestNode = require("request");
const { dynamicWeb3Net } = require("../../src/web3");

const getJsonfromCsv = async (csvId) => {
  if (!csvId) ctx.throw(400, "Please provide a CSV file");

  const csvFile = await strapi.plugins["upload"].services.upload.fetch({
    id: csvId,
  });

  if (!csvFile) ctx.throw(400, "Please provide a CSV file");
  if (!csvFile?.url)
    ctx.throw(400, "Couldn't find CSV file upload, please try again");

  return await csv().fromStream(requestNode.get(csvFile.url));
};

const formatCSV = async (strapi, ctx, data, next) => {
  const { whitelistCsv, isAutoEnroll } = data;
  const baseAllocation = data?.baseAllocation ?? 50;

  if (!whitelistCsv) ctx.throw(400, "Please provide a CSV file");

  const allocsByAddress = {};

  const json = await getJsonfromCsv(whitelistCsv);

  const isMainnet = data?.isMainnet;
  const chainId = isMainnet ? 137 : 80001;

  if (!json || !json?.length) ctx.throw(400, "Please provide a CSV file");

  const [addressKey, amountKey] = Object.keys(json[0]);
  const onlyValidAddresses = json.filter((json) =>
    dynamicWeb3Net(chainId).utils.isAddress(json[addressKey])
  );

  for (let i = 0; i < onlyValidAddresses.length; i++) {
    const row = onlyValidAddresses[i];
    const address = row[addressKey].toLowerCase();
    let amount = row[amountKey];

    if (Number(amount) < baseAllocation) amount = baseAllocation;
    allocsByAddress[address] = String(amount);
  }

  if (isAutoEnroll) {
    const users = await strapi.query("account").find();

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const {
        WalletAddress: address,
        Email,
        twitterHandle,
        discordHandle,
        telegramHandle,
      } = user;

      const isEligible =
        Boolean(Email) &&
        Boolean(twitterHandle) &&
        Boolean(discordHandle) &&
        Boolean(telegramHandle);

      if (!isEligible) continue;

      const formattedAddress = address.toLowerCase();

      if (!Object.keys(allocsByAddress).includes(formattedAddress))
        allocsByAddress[formattedAddress] = String(baseAllocation);
    }
  }

  data.allocationsByAddressJSON = JSON.stringify({ ...allocsByAddress });

  ctx.request.body = {
    ...data,
  };
  await next();
};

module.exports = (strapi) => {
  return {
    initialize() {
      strapi.app.use(async (ctx, next) => {
        const { request } = ctx;
        const { method, url } = request;

        const isWhitelistAdmin =
          url &&
          url?.split("::")?.[1]?.split(".")[0] === "whitelist" &&
          url.split("content-type-builder").length === 1;

        const isWhitelistUser =
          url.split("?")[0]?.split("/")?.[1] !== "whitelist";

        if (!isWhitelistAdmin && !isWhitelistUser) return next();

        const isStrapiInternal =
          url.split("/").includes("publish") ||
          url.split("/").includes("configuration") ||
          url.split("/").includes("relations");

        if (isStrapiInternal) return next();

        const { body } = request;

        if (isWhitelistAdmin && (method === "POST" || method === "PUT"))
          return await formatCSV(strapi, ctx, body, next);

        await next();
      });
    },
  };
};
