const hre = require("hardhat");

async function main() {
  console.log("Déploiement de BlockEvent...");

  // Obtenir les comptes
  const [deployer, daoTreasury] = await hre.ethers.getSigners();

  console.log("Déploiement avec le compte:", deployer.address);
  console.log("Balance:", (await deployer.getBalance()).toString());

  // Déployer BlockEvent
  const BlockEvent = await hre.ethers.getContractFactory("BlockEvent");
  
  const blockEvent = await BlockEvent.deploy(daoTreasury.address);
  await blockEvent.deployed();

  console.log("BlockEvent déployé à:", blockEvent.address);

  // Récupérer l'adresse du token
  const tokenAddress = await blockEvent.governanceToken();
  console.log("BlockToken déployé à:", tokenAddress);

  // Sauvegarder les adresses
  const fs = require("fs");
  const addresses = {
    blockEvent: blockEvent.address,
    blockToken: tokenAddress,
    daoTreasury: daoTreasury.address,
    network: hre.network.name,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    "./deployed-addresses.json",
    JSON.stringify(addresses, null, 2)
  );

  console.log("\n Adresses sauvegardées dans deployed-addresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});