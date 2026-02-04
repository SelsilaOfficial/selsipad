// Deploy FairlaunchFactory to local network
// Usage: npx hardhat run scripts/deploy-fairlaunch-factory-local.ts --network localhost

import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying FairlaunchFactory to local network...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Deployment parameters
  const DEPLOYMENT_FEE = ethers.parseEther("0.01"); // 0.01 ETH for local testing
  
  // Deploy mock contracts first
  console.log("📝 Deploying mock contracts...");
  
  const MockFeeSplitter = await ethers.getContractFactory("contracts/mocks/MockFeeSplitter.sol:MockFeeSplitter");
  const feeSplitter = await MockFeeSplitter.deploy();
  await feeSplitter.waitForDeployment();
  console.log("✅ MockFeeSplitter deployed to:", await feeSplitter.getAddress());

  // For local testing, deployer acts as treasury and admin
  const treasuryWallet = deployer.address;
  const adminExecutor = deployer.address;

  console.log("\n📝 Deploying FairlaunchFactory...");
  
  const FairlaunchFactory = await ethers.getContractFactory("FairlaunchFactory");
  const factory = await FairlaunchFactory.deploy(
    DEPLOYMENT_FEE,
    await feeSplitter.getAddress(),
    treasuryWallet,
    adminExecutor
  );
  
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  console.log("✅ FairlaunchFactory deployed to:", factoryAddress);
  console.log("\n📊 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("FairlaunchFactory:", factoryAddress);
  console.log("FeeSplitter:", await feeSplitter.getAddress());
  console.log("Treasury Wallet:", treasuryWallet);
  console.log("Admin Executor:", adminExecutor);
  console.log("Deployment Fee:", ethers.formatEther(DEPLOYMENT_FEE), "ETH");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Verify factory settings
  console.log("🔍 Verifying factory configuration...");
  const deploymentFee = await factory.DEPLOYMENT_FEE();
  const feeSplitterAddr = await factory.feeSplitter();
  const treasuryAddr = await factory.treasuryWallet();
  const adminAddr = await factory.adminExecutor();
  
  console.log("Deployment Fee (contract):", ethers.formatEther(deploymentFee), "ETH");
  console.log("FeeSplitter (contract):", feeSplitterAddr);
  console.log("Treasury (contract):", treasuryAddr);
  console.log("Admin (contract):", adminAddr);

  if (deploymentFee === DEPLOYMENT_FEE && 
      feeSplitterAddr === await feeSplitter.getAddress() &&
      treasuryAddr === treasuryWallet &&
      adminAddr === adminExecutor) {
    console.log("✅ All configurations verified!\n");
  } else {
    console.log("❌ Configuration mismatch!\n");
  }

  // Save deployment info
  console.log("💾 Deployment addresses for frontend:");
  console.log(`\nUpdate apps/web/src/lib/web3/fairlaunch-contracts.ts:`);
  console.log(`
export const FACTORY_ADDRESSES: Record<string, Address> = {
  // ... other networks
  localhost: '${factoryAddress}', // Local Hardhat
};
  `);

  console.log("\n🧪 Ready for local testing!");
  console.log("Next steps:");
  console.log("1. Update frontend FACTORY_ADDRESSES with the address above");
  console.log("2. Start frontend: cd apps/web && npm run dev");
  console.log("3. Test wizard flow at http://localhost:3000/create/fairlaunch");
  console.log("4. Check console logs and database after deployment\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
