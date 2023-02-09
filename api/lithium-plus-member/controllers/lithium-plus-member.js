"use strict";

const { isValidAddress } = require("ethereumjs-util");
const {
  createContract,
} = require("../../../middlewares/createVestingContract/tokenSale");
const {
  decodeToken,
} = require("../../../middlewares/missionControl/taskSubmission/auth");
const { abi } = require("../../../src/contracts/staking/abi");

const stakingContractAddresses = {
  mainnet: "0x6Ac0B0b412040b51801ceb428399c1813B481677",
  testnet: "0xA223a20B5EC97519eEeA5dcE4E537007CD440e48",
};

const { IS_TESTNET } = process.env;

const lockLevels = {
  0: 0,
  1: 0,
  2: 30,
  3: 60,
  4: 90,
};

const tierRefArr = [
  "None",
  "Backer",
  "Starter",
  "Investor",
  "Strategist",
  "Venturist",
  "Evangelist",
  "Evangelist_Pro",
];

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  updateByWalletAddress: async (ctx) => {
    const { request } = ctx;

    const walletAddress = request.url.split(
      "/lithium-plus-members/by-wallet-address/"
    )[1];

    const isValid = isValidAddress(walletAddress);

    if (!isValid) return ctx.throw(400, "Invalid address");

    const accessToken = ctx.request.header["x-lithium-token"];

    if (!accessToken) return ctx.throw(400, "No token provided");

    try {
      const { WalletAddress: addressFromToken } = decodeToken(accessToken);

      if (addressFromToken.toLowerCase() !== walletAddress.toLowerCase())
        return ctx.throw(400, "You do not have access to this resource");

      let user = await strapi
        .query("lithium-plus-member")
        .findOne({ walletAddress });

      if (!user) {
        user = await strapi.query("lithium-plus-member").create({
          walletAddress,
        });
      }

      const stakingContract = await createContract(
        abi,
        stakingContractAddresses[IS_TESTNET ? "testnet" : "mainnet"],
        IS_TESTNET ? 80001 : 137
      );

      const userState = await stakingContract.methods
        .getUserState(walletAddress)
        .call();

      const tierIndex = userState[0];
      const lockLevel = userState[1];
      const timeUnlock = userState[3];

      const tier = tierRefArr[Number(tierIndex)];
      const lockDays = lockLevels[lockLevel];
      const datetimeOfUnlock = timeUnlock
        ? new Date(Number(timeUnlock) * 1000).toISOString()
        : null;

      const associatedAccount = await strapi
        .query("account")
        .findOne({ WalletAddress: walletAddress });

      await strapi.query("lithium-plus-member").update(
        { walletAddress },
        {
          lockDays,
          tier,
          datetimeOfUnlock,
          account: associatedAccount?.id ?? null,
        }
      );

      return ctx.send({ message: "success" });
    } catch (err) {
      console.error(err);
      return ctx.throw(400, "error decoding token");
    }
  },
};
