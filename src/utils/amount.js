const { web3MaiNet } = require("../web3");

const amountToWei = (amount) => web3MaiNet.utils.toWei(amount);
const weiToAmount = (amount) => web3MaiNet.utils.fromWei(amount);

module.exports = { amountToWei, weiToAmount };
