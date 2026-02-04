// Deploy FairlaunchFactory to local network
// Usage: npx hardhat run scripts/deploy-fairlaunch-factory-local.js --network localhost

const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying FairlaunchFactory to local network...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Deployment parameters
  const DEPLOYMENT_FEE = hre.ethers.parseEther("0.01"); // 0.01 ETH for local testing
  
  // Deploy mock contracts first
  console.log("📝 Deploying mock contracts...");
  
  const MockFeeSplitter = await hre.ethers.getContractFactory("contracts/mocks/MockFeeSplitter.sol:MockFeeSplitter");
  const feeSplitter = await MockFeeSplitter.deploy();
  await feeSplitter.waitForDeployment();
  console.log("✅ MockFeeSplitter deployed to:", await feeSplitter.getAddress());

  // For local testing, deployer acts as treasury and admin
  const treasuryWallet = deployer.address;
  const adminExecutor = deployer.address;

  console.log("\n📝 Deploying FairlaunchFactory...");
  
  const FairlaunchFactory = await hre.ethers.getContractFactory("FairlaunchFactory");
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
  console.log("Deployment Fee:", hre.ethers.formatEther(DEPLOYMENT_FEE), "ETH");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Save deployment info to file
  const fs = require('fs');
  const deploymentInfo = {
    network: 'localhost',
    chainId: 31337,
    factoryAddress: factoryAddress,
    feeSplitterAddress: await feeSplitter.getAddress(),
    treasuryWallet: treasuryWallet,
    adminExecutor: adminExecutor,
    deploymentFee: DEPLOYMENT_FEE.toString(),
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    'deployments-local.json',
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("💾 Deployment info saved to deployments-local.json\n");

  console.log("💾 Frontend configuration:");
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
  console.log("3. Test wizard at: http://localhost:3000/create/fairlaunch");
  console.log("4. Connect to Hardhat network (Chain ID: 31337, RPC: http://127.0.0.1:8545)\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
