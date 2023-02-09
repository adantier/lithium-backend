/* eslint-disable no-undef */
const { BigNumber: BN } = require("ethers");
const axios = require("axios");
const solc = require("solc");
const path = require("path");
const fs = require("fs");

const is_optimized = 1;
var input = {};

// var solc_version = "v0.4.16+commit.d7661dd9"
// var contracts_directory = "./contracts"
// var contract_name = "LinkToken"
// var contract_filename = "LinkToken.sol"

function verifyContract(
  web3,
  contract_address,
  contract_name,
  contract_filename,
  solc_version
) {
  solc.loadRemoteVersion(solc_version, async function (err, solc_specific) {
    if (!err) {
      var output = JSON.parse(
        solc_specific.lowlevel.compileMulti(
          JSON.stringify({ sources: input }),
          is_optimized
        )
      );
      var compiled_bytecode =
        "0x" +
        output["contracts"][contract_filename + ":" + contract_name][
          "runtimeBytecode"
        ];

      var blockchain_bytecode = await web3.eth.getCode(contract_address);

      processed_compiled_bytecode = processBytecode(compiled_bytecode);
      processed_blockchain_bytecode = processBytecode(blockchain_bytecode);

      if (processed_blockchain_bytecode == processed_compiled_bytecode) {
        console.log("Verified!");
      } else {
        console.log("Not Verified");
      }
    }
  });

  function processBytecode(bytecode) {
    // Semantic versioning
    let solc_minor = parseInt(
      solc_version
        .match(/v\d+?\.\d+?\.\d+?[+-]/gi)[0]
        .match(/\.\d+/g)[0]
        .slice(1)
    );
    let solc_patch = parseInt(
      solc_version
        .match(/v\d+?\.\d+?\.\d+?[+-]/gi)[0]
        .match(/\.\d+/g)[1]
        .slice(1)
    );

    if (solc_minor >= 4 && solc_patch >= 22) {
      var starting_point = bytecode.lastIndexOf("6080604052");
      var ending_point = bytecode.search("a165627a7a72305820");
      return bytecode.slice(starting_point, ending_point);
    } else if (solc_minor >= 4 && solc_patch >= 7) {
      var starting_point = bytecode.lastIndexOf("6060604052");
      var ending_point = bytecode.search("a165627a7a72305820");
      return bytecode.slice(starting_point, ending_point);
    } else {
      return bytecode;
    }
  }
}

module.exports = { verifyContract };
