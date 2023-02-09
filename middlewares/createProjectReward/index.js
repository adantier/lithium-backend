const csv = require("csvtojson");
const requestNode = require("request");
const { BigNumber } = require("ethers");
const Web3 = require("web3");
const { createContract } = require("../createVestingContract/tokenSale");
const { abi: erc20ABI } = require("../../src/contracts/erc20/abi");
const { send } = require("../../src/web3");

const isValidAddress = (address) => Web3.utils.isAddress(address);

const amountToWei = (amount = "0", decimal = 18) => {
  return new BigNumber.from(
    new BigNumber.from(amount).mul(new BigNumber.from(10).pow(decimal))
  );
};

const formatChainString = (chainString) =>
  parseInt(chainString.split("_")[chainString.split("_").length - 1]);

const mainnetChainIds = [56, 137, 1];

const getContract = async (strapi, formattedId) => {
  const details = await strapi.query("reward-contracts-chain-settings").find();
  const desiredContract = details.find(({ chainId }) => {
    const { mainnet, testnet } = chainId[0];
    return formattedId === mainnet || formattedId === testnet;
  });

  const {
    Address_testnet: address_testnet,
    Address: address,
    ABI: abi,
  } = desiredContract;

  return { address, address_testnet, abi };
};

module.exports = (strapi) => {
  return {
    initialize() {
      strapi.app.use(async (ctx, next) => {
        const { request } = ctx;
        const url = request?.url;
        const data = request?.body;
        const isProjectReward =
          url &&
          url?.split("::")?.[1]?.split(".")[0] === "project-reward" &&
          url.split("content-type-builder").length === 1;

        const isCorrectRequest = request.method === "PUT";
        const hasDeployed = data?.hasDeployed;
        const hasApprovedGnosis = data?.hasApprovedGnosis;

        const shouldRunLogic =
          isProjectReward && isCorrectRequest && !hasDeployed;

        if (!shouldRunLogic) return await next();

        if (!hasApprovedGnosis) ctx.throw(400, "Please approve Gnosis");

        const tokenImage = data?.icon?.[0]?.url;
        const fromDetail = data?.fromDetail;
        const tokenAddress = data?.tokenAddress;
        if (!tokenImage) ctx.throw(400, "Please provide an icon");
        if (!fromDetail)
          ctx.throw(400, "Please provide a fromDetail (caption)");

        const chainId = data?.chainId;

        if (!chainId) ctx.throw(400, "Please provide a chainId");

        const formattedId = formatChainString(chainId);

        const tokenDecimals = data?.tokenDecimals ?? 18;
        const csvId = data.recipientCSV;

        if (!csvId) ctx.throw(400, "Please provide a CSV file");

        const csvFile = await strapi.plugins["upload"].services.upload.fetch({
          id: csvId,
        });

        if (!csvFile) ctx.throw(400, "Please provide a CSV file");

        if (!csvFile?.url)
          ctx.throw(400, "Couldn't find CSV file upload, please try again");

        const addresses = [];
        const amounts = [];
        const { address, address_testnet, abi } = await getContract(
          strapi,
          formattedId
        );

        const jsonArray = await csv().fromStream(requestNode.get(csvFile.url));

        const [accountKey, amountKey] = Object.keys(jsonArray[0]);

        jsonArray.forEach((row) => {
          const address = row[accountKey];
          const amount = row[amountKey];
          if (isValidAddress(address) && amount) {
            addresses.push(address);
            amounts.push(amountToWei(amount, tokenDecimals).toString());
          }
        });
        const isMainnet = mainnetChainIds.includes(formattedId);

        const rewardsContractAddress = isMainnet ? address : address_testnet;

        const rewardsContract = await createContract(
          abi,
          rewardsContractAddress,
          formattedId
        );

        const tokenContract = await createContract(
          erc20ABI,
          data.tokenAddress,
          formattedId
        );

        // const approval = await send(
        //   tokenContract.methods.approve(
        //     rewardsContractAddress,
        //     new BigNumber.from(10).pow(new BigNumber.from(50)).toString()
        //   ),
        //   false,
        //   false,
        //   formattedId
        // );

        // if (!approval?.transactionHash || !approval?.status)
        //   ctx.throw(400, "Approval failed, please try again!");

        try {
          const airdrop = await send(
            rewardsContract.methods.addAirdrop(
              tokenAddress,
              tokenImage,
              fromDetail,
              addresses,
              amounts
            ),
            false,
            false,
            formattedId
          );

          if (!airdrop?.transactionHash || !airdrop?.status) {
            ctx.throw(400, "Airdrop failed, please try again or Ask Badger!");
          }

          ctx.request.body = {
            ...data,
            hasDeployed: true,
          };

          await next();
        } catch (error) {
          console.error(error, "error in catch");
          ctx.throw(400, error?.message ?? "Something went wrong, Ask Badger");
        }
      });
    },
  };
};
