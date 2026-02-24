const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const FACTORY_ADDRESS = "0x9cE2f9284EF7C711ec541f1bC07c844097722618";
  const CREATE_FEE = ethers.parseEther("0.05");

  const [deployer, referrer] = await ethers.getSigners();
  console.log("Triggering events with wallet:", deployer.address);
  console.log("Referrer:", referrer.address);

  const factory = await ethers.getContractAt("SelsipadBondingCurveFactory", FACTORY_ADDRESS);

  // 1. Launch a new Token (triggers TokenCreated and TokensPurchased)
  const name = "Indexer Test Token " + Math.floor(Math.random() * 1000);
  const symbol = "IDXT";
  
  console.log(`Launching token ${name}...`);
  const tx = await factory.launchToken(name, symbol, referrer.address, { value: CREATE_FEE });
  const rx = await tx.wait();
  
  const event = rx.logs.find(l => {
    try {
      const parsed = factory.interface.parseLog(l);
      return parsed && parsed.name === 'TokenLaunched';
    } catch(e) { return false; }
  });
  
  const tokenAddr = factory.interface.parseLog(event).args[0];
  console.log("Token Launched at:", tokenAddr);

  // 2. Buy some more tokens
  console.log("Buying 0.01 BNB worth of tokens...");
  const buyTx = await factory.buyToken(tokenAddr, referrer.address, { value: ethers.parseEther("0.01") });
  await buyTx.wait();
  console.log("Buy successful!");
}

main().catch(console.error);
