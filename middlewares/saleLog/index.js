const axios = require("axios");
const { BigNumber: BN, utils } = require("ethers");

const { web3MaiNet, web3TestNet } = require("../../src/web3");
const { abi: contractABI } = require("./master");
const { bscParse } = require("./bsc");

module.exports = (strapi) => {
  return {
    initialize() {
      strapi.app.use(async (ctx, next) => {
        try {
          const { request } = ctx;
          if (
            request.method === "PUT" &&
            request.url.substring(0, 71) ===
              "/content-manager/single-types/application::get-sale-logs.get-sale-logs"
          ) {
            console.log("WORK SALE LOG", request.url);
            console.log("WORK SALE LOG BODY", request.body);
            const {
              AddressSale: addressSale,
              AddressMasterContract: addressMasterContract,
              DecimalsToken: decimalsToken,
              Mainnet: mainnet,
            } = request.body;

            const { version } = await strapi
              .query("deploy-version")
              .findOne({ id: "1" });

            console.log("=====================");
            console.log("VERSION", version);
            console.log("=====================");

            const web3 = await (mainnet ? web3MaiNet : web3TestNet());
            console.log(web3);

            console.log(addressMasterContract);
            console.log(
              mainnet ? "api" : "api-testnet",
              `https://${
                mainnet ? "api" : "api-testnet"
              }.bscscan.com/api?module=contract&action=getabi&address=${addressMasterContract}&apikey=NRFAT7KVN7TBUFENPP2YXUP1C3QCIBC7E9`
            );

            const masterContractFetchData = await axios
              .get(
                `https://${
                  mainnet ? "api" : "api-testnet"
                }.bscscan.com/api?module=contract&action=getabi&address=${addressMasterContract}&apikey=NRFAT7KVN7TBUFENPP2YXUP1C3QCIBC7E9`
              )
              .then((res) => res?.data);

            console.log("masterContractFetchData", masterContractFetchData);

            if (masterContractFetchData?.status === "0") {
              ctx.throw(
                400,
                masterContractFetchData?.result +
                  " Please check the master contract address, the sale address and the selected network!"
              );
            }

            const { result: masterContractAbi } = masterContractFetchData;

            const masterContract = await new web3.eth.Contract(
              JSON.parse(masterContractAbi),
              addressSale
            );
            console.log("MASTERCONTRACT", !!masterContractAbi);

            console.log(
              "WEB3",
              "CONTRACT ABI ADDRESSSALE ",
              !!contractABI,
              addressSale
            );

            const arrBscUsers = await bscParse(
              masterContract,
              mainnet,
              addressSale,
              ctx
            );

            console.log(arrBscUsers);

            console.log("MASTER CONTRACT", masterContract?.methods);
            const params = await masterContract.methods?.getParams().call();
            const publicPrice = await masterContract.methods
              ?.publicPrice()
              .call();
            const privatePrice = await masterContract.methods
              ?.privatePrice()
              .call();
            console.log("PARAMS", params);

            const saleLogPromise = arrBscUsers.map(async (user) => {
              const stakesUser = await masterContract.methods
                ?.stakes(user?.address)
                .call();

              const userBNB = BN.from(stakesUser.amount)
                .mul(BN.from(privatePrice))
                .div(BN.from(10).pow(decimalsToken));

              // const canClaimUser = await Sale.methods
              //   ?.canClaim(user?.address)
              //   .call();

              return {
                address: user.address,
                amount: BN.from(stakesUser.amount)
                  .div(BN.from(10).pow(18))
                  .toString(),
                BNB: utils.formatEther(userBNB.toString(), { pad: true }),
              };
            });

            const saleLog = await Promise.all(saleLogPromise);

            console.log("saleLog", saleLog.length);
            ctx.request.body = {
              ...ctx.request.body,
              GetResult: JSON.stringify(saleLog),
            };

            await next();
          } else {
            await next();
          }
        } catch (error) {
          console.log("ERR", error?.message);
          ctx.throw(400, error?.message);
        }
      });
    },
  };
};
