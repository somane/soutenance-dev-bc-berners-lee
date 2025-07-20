// test/minimal-with-gas.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Test Minimal avec Gas", function () {
  it("Devrait déployer avec limite de gas", async function () {
    const [owner, daoTreasury] = await ethers.getSigners();
    
    const BlockEvent = await ethers.getContractFactory("BlockEvent");
    
    // Déployer avec une limite de gas explicite
    const blockEvent = await BlockEvent.deploy(daoTreasury.address, {
      gasLimit: 30000000 // 30M gas
    });
    
    await blockEvent.deployed();
    console.log("Contrat déployé à:", blockEvent.address);
    
    expect(blockEvent.address).to.properAddress;
  });
});