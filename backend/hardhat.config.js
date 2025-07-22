require("solidity-coverage");
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
//require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  /*networks: {
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: true,
      blockGasLimit: 30000000,
      gas: 12000000
    }
  }*/
 networks: {
    holesky: {
      url: `https://eth-holesky.g.alchemy.com/v2/${process.env.HOLESKY_KEY}`,
      accounts: [
        process.env.PRIVATE_KEY_DEPLOYER,
        process.env.PRIVATE_KEY_DAO_TREASURY
      ],
      allowUnlimitedContractSize: true,
      blockGasLimit: 30000000,
      gas: 12000000
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY
  }
};