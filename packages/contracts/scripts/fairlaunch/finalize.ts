/**
 * Script to finalize a Fairlaunch
 * 
 * Usage:
 * npx hardhat run scripts/fairlaunch/finalize.ts --network bscTestnet
 * 
 * Environment variables required:
 * - PRIVATE_KEY: Admin wallet private key
 * - FAIRLAUNCH_ADDRESS: Deployed fairlaunch contract address
 */

import { ethers } from "hardhat";

async function main() {
  // Configuration
  const FAIRLAUNCH_ADDRESS = process.env.FAIRLAUNCH_ADDRESS || "0x612f1d8D7184EdcD7a017E5990B477498BCfbB0f";
  
  console.log("\n🚀 Fairlaunch Finalization Script");
  console.log("=====================================");
  console.log(`Contract: ${FAIRLAUNCH_ADDRESS}`);
  console.log(`Network: ${(await ethers.provider.getNetwork()).name}`);
  
  // Get signer
  const [admin] = await ethers.getSigners();
  console.log(`\nAdmin wallet: ${admin.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(admin.address))} BNB`);
  
  // Load contract
  const Fairlaunch = await ethers.getContractFactory("Fairlaunch");
  const fairlaunch = Fairlaunch.attach(FAIRLAUNCH_ADDRESS);
  
  console.log("\n📊 Pre-Finalization Check");
  console.log("=====================================");
  
  try {
    // Check if already finalized
    const isFinalized = await fairlaunch.isFinalized();
    console.log(`Already Finalized: ${isFinalized}`);
    
    if (isFinalized) {
      console.log("\n❌ Fairlaunch already finalized!");
      return;
    }
    
    console.log("\n✅ Ready to finalize. Proceeding...");
    
    // Call finalize()
    console.log("\n🔄 Calling finalize()...");
    const tx = await fairlaunch.finalize();
    console.log(`Transaction sent: ${tx.hash}`);
    
    console.log("⏳ Waiting for confirmation...");
    const receipt = await tx.wait();
    
    console.log("\n✅ Finalization Successful!");
    console.log("=====================================");
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`Block: ${receipt.blockNumber}`);
    console.log(`Tx: ${receipt.hash}`);
    
    console.log("\n🎉 Finalization Complete!");
    console.log("=====================================");
    console.log("Next steps:");
    console.log("1. Verify LP on PancakeSwap");
    console.log("2. Check LP lock status");
    console.log("3. Investors can now claim tokens!");
    console.log(`\n🔗 View on BSCScan:`);
    console.log(`https://testnet.bscscan.com/tx/${receipt.hash}`);
    
  } catch (error: any) {
    console.error("\n❌ Finalization Failed!");
    console.error("=====================================");
    console.error(`Error: ${error.message}`);
    
    if (error.reason) {
      console.error(`Reason: ${error.reason}`);
    }
    
    if (error.data) {
      console.error(`Data: ${error.data}`);
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
