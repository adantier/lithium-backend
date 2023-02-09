const {
  createContract,
  getUsersWhoInvested,
  hasOversold,
  getStakes,
  getRates,
} = require("./tokenSale");

const { abi: tokenSaleABI } = require("../../src/contracts/tokenSale/abi");
const { abi: vestingABI } = require("../../src/contracts/vesting/abi");
const { abi: erc20ABI } = require("../../src/contracts/erc20/abi");

const deployVestingContract = require("./vestingContract/deployVestingContract");
const { populateDeposits } = require("./vestingContract");
const { BigNumber } = require("ethers");
const { send } = require("../../src/web3");

const amountFromWei = (amount = "0", decimal = 18) => {
  return new BigNumber.from(amount).div(new BigNumber.from(10).pow(decimal));
};

const amountToWei = (amount = "0", decimal = 18) => {
  return new BigNumber.from(
    new BigNumber.from(amount).mul(new BigNumber.from(10).pow(decimal))
  );
};

const mainnetChainIds = [56, 137, 1];

const formatChainString = (chainString) =>
  parseInt(chainString.split("_")[chainString.split("_").length - 1]);

const getContract = async (strapi, formattedId) => {
  const details = await strapi.query("vesting-contracts").find();

  const desiredContract = details.find(({ chainId: { mainnet, testnet } }) => {
    return formattedId === mainnet || formattedId === testnet;
  });

  const {
    Address_Testnet: address_testnet,
    Address: address,
    ABI: abi,
    chainId: chainIdSelected,
  } = desiredContract;

  return { address, address_testnet, abi, chainIdSelected };
};

const getMultisig = async (strapi, formattedId) => {
  const details = await strapi.query("multisig").find();
  const selectedMultisig = details.find(
    ({ chainId }) => chainId === formattedId
  );
  if (selectedMultisig?.Address) {
    return selectedMultisig.Address;
  }
  return;
};

module.exports = (strapi) => {
  return {
    initialize() {
      strapi.app.use(async (ctx, next) => {
        const { request } = ctx;
        const url = request?.url;
        const data = request?.body;
        const isVesting =
          url &&
          url?.split("::")?.[1]?.split(".")[0] === "vesting" &&
          url.split("content-type-builder").length === 1;

        const externalVesting = data?.externalVesting?.[0]?.isExternal;

        const hasAddress =
          data?.vestingContractAddress && data.vestingContractAddress !== "";

        const { hasApprovedGnosis, hasDeployed } = data;

        const isCorrectRequest = request.method === "PUT";
        const chainId = data.chainId;
        if (isCorrectRequest && isVesting && !externalVesting && !hasDeployed) {
          const pool = await strapi.query("pools").findOne({ id: data.pool });

          const { poolAddress, chainID: poolChain } = pool;

          const tokenPrice = parseFloat(pool.privateSale.price);

          const formattedId = formatChainString(chainId);
          const formattedPoolChainId = formatChainString(poolChain);

          const mainNet = mainnetChainIds.includes(formattedId);

          const isPolygon =
            formattedId === 137 || formattedPoolChainId === 80001;

          const { address, address_testnet, abi, chainIdSelected } =
            await getContract(strapi, formattedId);

          const multisigWallet = await getMultisig(strapi, formattedId);

          if (!multisigWallet) {
            ctx.throw(400, "No multisig address found for this chain");
          }

          if (!hasApprovedGnosis) {
            const params = {
              tokenSaleAddress: poolAddress,
              multisigWallet,
              tokenAddress: data.tokenAddress,
              vestingPoints: data.points.map(({ dateTime, percentage }) => [
                new Date(dateTime).getTime() / 1000,
                percentage * 100,
              ]),
            };

            const confirmedTx = await deployVestingContract(
              params,
              mainNet ? address : address_testnet,
              abi,
              formattedId
            );

            const vestingContractAddress = confirmedTx.logs[0].address;

            ctx.request.body = {
              ...data,
              vestingContractAddress,
            };
          } else {
            const tokenSaleContract = await createContract(
              tokenSaleABI,
              poolAddress,
              formattedPoolChainId
            );

            const usersInvested = await getUsersWhoInvested(tokenSaleContract);

            const vestingContract = await createContract(
              vestingABI,
              data?.vestingContractAddress,
              formattedId
            );

            const { totalSold, supplyValue } = await getRates(
              tokenSaleContract
            );

            const isOversold = hasOversold(totalSold, supplyValue);

            const stakes = [];
            let rate = 1;

            if (isOversold) {
              rate =
                amountFromWei(supplyValue, 6).toNumber() /
                amountFromWei(totalSold).toNumber();
            }

            for (let i = 0; i < usersInvested.length; i++) {
              const userStake = await getStakes(
                tokenSaleContract,
                usersInvested[i]
              );

              const stakeEth = amountFromWei(userStake, 6);
              const stakeInWei = amountToWei(
                Math.floor(stakeEth * (1 / tokenPrice) * rate),
                18
              );

              stakes.push(stakeInWei);
            }

            // main deploy
            // const tokenContract = await createContract(
            //   erc20ABI,
            //   data.tokenAddress,
            //   formattedId
            // );

            // await send(
            //   tokenContract.methods.approve(
            //     vestingContractAddress,
            //     new BigNumber.from(10).pow(new BigNumber.from(50)).toString()
            //   ),
            //   false,
            //   false,
            //   formattedId
            // );

            await populateDeposits(
              vestingContract,
              usersInvested,
              stakes,
              formattedId
            );
            ctx.request.body = {
              ...data,
              hasDeployed: true,
            };
          }

          await next();
        } else {
          await next();
        }
      });
    },
  };
};

// module.exports = { amountToWei, amountFromWei };
