const fs = require("fs");
const path = require("path");
const solc = require("solc");
const axios = require("axios").default;

const {
  web3MaiNet,
  web3TestNet,
  web3MaiNetPolygone,
  web3TestNetPolygone,
  send,
} = require("../../web3");
// const LPToken = require("./abi");
// const Admin = require("../admin/abi");

// const lptContract = new web3.eth.Contract(LPToken.abi, LPToken.address, {
//   from: process.env.ADDRESS_FROM,
// });

// async function mint(amount) {
//   return await send(
//     lptContract.methods
//       .mint(process.env.ADDRESS_FROM, bsToString(amount))
//       .encodeABI()
//   );
// }

// async function approve(amount) {
//   return await send(
//     lptContract.methods.approve(Admin.address, bsToString(amount)).encodeABI()
//   );
// }

async function deployToken(
  mainNet,
  name,
  symbol,
  contractUrl,
  contractName,
  addressForMint,
  amountOfMint,
  polygon = false
) {
  // const currentUrl = path.resolve(__dirname, "../../../public" + contractUrl);
  const source = await axios
    .get(contractUrl)
    .then(({ data }) => data)
    .catch((err) =>
      console.log(err?.message ?? "Error fetching contract source")
    );

  // const source = fs.readFileSync(currentUrl, "utf8");
  console.log("================= SOURCE", source);
  const input = {
    language: "Solidity",
    sources: {
      [contractName]: {
        content: source,
      },
    },
    settings: {
      outputSelection: {
        "*": {
          "*": ["*"],
        },
      },
    },
  };

  function findImports(pathImport) {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../../../node_modules/" + pathImport),
      "utf8"
    );
    return {
      contents: source,
    };
  }

  console.log("================= input", input);
  const tempFile = JSON.parse(
    solc.compile(JSON.stringify(input), { import: findImports })
  );

  console.log("================= tempFile", tempFile);
  const contractFile =
    tempFile.contracts[contractName][contractName.split(".sol")[0]];

  console.log("================= contractFile");
  const bytecode = contractFile.evm.bytecode.object;

  console.log("================= bytecode");
  const abi = contractFile.abi;

  console.log("================= abi", abi);

  const web3Net = await (polygon
    ? mainNet
      ? web3MaiNetPolygone
      : web3TestNetPolygone
    : mainNet
    ? web3MaiNet
    : web3TestNet());

  console.log(
    polygon
      ? mainNet
        ? "web3MaiNetPolygone"
        : "web3TestNetPolygone"
      : mainNet
      ? "web3MaiNet"
      : "web3TestNet"
  );

  const instanceTokenContract = new web3Net.eth.Contract(abi);

  console.log(
    "================= tokenContractData send start",
    mainNet ? "web3MaiNet" : "web3TestNet",
    "polygon ? " + polygon
  );
  const tokenContractData = await send(
    instanceTokenContract.deploy({
      data: bytecode,
      arguments: [name, symbol, addressForMint, amountOfMint],
    }),
    mainNet,
    polygon
  );
  console.log("================= tokenContractData send end");

  return {
    tokenContractData,
    abi,
  };
}

// module.exports = { mint, approve, deployToken, lptContract };
module.exports = { deployToken };
