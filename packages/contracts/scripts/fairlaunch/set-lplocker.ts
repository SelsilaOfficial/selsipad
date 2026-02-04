/**
 * Script to configure existing Fairlaunch with LP Locker
 * 
 * Usage:
 * FAIRLAUNCH_ADDRESS=0x... LPLOCKER_ADDRESS=0x... npx hardhat run scripts/fairlaunch/set-lplocker.ts --network bscTestnet
 */

import { ethers } from "hardhat";

async function main() {
  const FAIRLAUNCH_ADDRESS = process.env.FAIRLAUNCH_ADDRESS || "0x612f1d8D7184EdcD7a017E5990B477498BCfbB0f";
  const LPLOCKER_ADDRESS = process.env.LPLOCKER_ADDRESS;
  
  if (!LPLOCKER_ADDRESS) {
    console.error("❌ LPLOCKER_ADDRESS environment variable required!");
    process.exit(1);
  }
  
  console.log("\n🔧 Configure Fairlaunch LP Locker");
  console.log("=====================================");
  console.log(`Fairlaunch: ${FAIRLAUNCH_ADDRESS}`);
  console.log(`LP Locker: ${LPLOCKER_ADDRESS}`);
  
  const [admin] = await ethers.getSigners();
  console.log(`Admin: ${admin.address}`);
  
  // Load Fairlaunch contract
  const Fairlaunch = await ethers.getContractFactory("Fairlaunch");
  const fairlaunch = Fairlaunch.attach(FAIRLAUNCH_ADDRESS);
  
  console.log("\n📝 Setting LP Locker address...");
  const tx = await fairlaunch.setLPLocker(LPLOCKER_ADDRESS);
  console.log(`Transaction: ${tx.hash}`);
  
  await tx.wait();
  
  console.log("\n✅ LP Locker configured!");
  console.log("=====================================");
  console.log("Fairlaunch contract is now ready to lock LP tokens securely.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
