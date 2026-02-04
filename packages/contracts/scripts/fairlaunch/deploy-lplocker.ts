/**
 * Script to deploy LP Locker vault
 * 
 * Usage:
 * npx hardhat run scripts/fairlaunch/deploy-lplocker.ts --network bscTestnet
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("\n🚀 LP Locker Deployment Script");
  console.log("=====================================");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} BNB`);
  console.log(`Network: ${(await ethers.provider.getNetwork()).name}`);
  
  // Deploy LPLocker
  console.log("\n📦 Deploying LPLocker...");
  const LPLocker = await ethers.getContractFactory("LPLocker");
  const lpLocker = await LPLocker.deploy();
  
  await lpLocker.waitForDeployment();
  const lpLockerAddress = await lpLocker.getAddress();
  
  console.log("✅ LPLocker deployed!");
  console.log(`Address: ${lpLockerAddress}`);
  
  // Save deployment info
  const deploymentInfo = {
    lpLocker: lpLockerAddress,
    deployer: deployer.address,
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployedAt: new Date().toISOString(),
  };
  
  const deploymentDir = path.join(__dirname, "../../deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }
  
  const deploymentFile = path.join(deploymentDir, "lplocker.json");
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("\n💾 Deployment info saved to:", deploymentFile);
  
  console.log("\n🎉 Deployment Complete!");
  console.log("=====================================");
  console.log("Next steps:");
  console.log("1. Verify contract on BSCScan");
  console.log("2. Call setLPLocker() on existing Fairlaunch contracts");
  console.log("3. Update Fairlaunch factory to use new locker");
  
  console.log(`\n🔗 Verify command:`);
  console.log(`npx hardhat verify --network bscTestnet ${lpLockerAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
