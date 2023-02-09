const { address, abi } = require("./abi");
const { web3MaiNetPolygone, web3TestNetPolygone } = require("../../web3");

const polygoneContract = (mainnet) =>
  mainnet
    ? new web3MaiNetPolygone.eth.Contract(abi, address)
    : new web3TestNetPolygone.eth.Contract(abi, address);

module.exports = { abi, address, polygoneContract };
