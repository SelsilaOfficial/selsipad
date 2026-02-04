// Deploy FairlaunchFactory with ZERO deployment fee
// This allows admin to only pay gas costs, not the 0.2 BNB fee

const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying FairlaunchFactory with ZERO deployment fee...\n");

  // Get deployer
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "BNB\n");

  // Config
  const DEPLOYMENT_FEE = hre.ethers.parseEther("0"); // ✅ ZERO FEE
  const FEE_SPLITTER = process.env.FEE_SPLITTER_ADDRESS;
  const TREASURY = process.env.TREASURY_VAULT_ADDRESS;
  const TIMELOCK = process.env.TIMELOCK_ADDRESS;

  console.log("Configuration:");
  console.log("- Deployment Fee:", hre.ethers.formatEther(DEPLOYMENT_FEE), "BNB (ZERO)");
  console.log("- Fee Splitter:", FEE_SPLITTER);
  console.log("- Treasury:", TREASURY);
  console.log("- Timelock:", TIMELOCK);
  console.log();

  // Validate addresses
  if (!FEE_SPLITTER || !TREASURY || !TIMELOCK) {
    throw new Error("Missing required environment variables!");
  }

  // Deploy
  console.log("Deploying FairlaunchFactory...");
  const FairlaunchFactory = await hre.ethers.getContractFactory("FairlaunchFactory");
  const factory = await FairlaunchFactory.deploy(
    DEPLOYMENT_FEE,
    FEE_SPLITTER,
    TREASURY,
    TIMELOCK
  );

  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  console.log("✅ FairlaunchFactory deployed:", factoryAddress);
  console.log();

  // Verify deployment fee is zero
  const deploymentFee = await factory.DEPLOYMENT_FEE();
  console.log("Verification:");
  console.log("- Deployment Fee:", hre.ethers.formatEther(deploymentFee), "BNB");
  console.log("- Fee Splitter:", await factory.feeSplitter());
  console.log("- Treasury:", await factory.treasuryWallet());
  console.log("- Admin Executor:", await factory.adminExecutor());
  console.log();

  // Verify on BSCScan
  if (process.env.VERIFY_CONTRACTS === "true") {
    console.log("Waiting for block confirmations...");
    await factory.deploymentTransaction().wait(5);

    console.log("Verifying contract on BSCScan...");
    try {
      await hre.run("verify:verify", {
        address: factoryAddress,
        constructorArguments: [DEPLOYMENT_FEE, FEE_SPLITTER, TREASURY, TIMELOCK],
      });
      console.log("✅ Contract verified on BSCScan");
    } catch (error) {
      console.log("⚠️  Verification failed:", error.message);
    }
  }

  console.log("\n📋 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("FairlaunchFactory:", factoryAddress);
  console.log("Deployment Fee: 0 BNB ✅");
  console.log("Network:", hre.network.name);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n🔧 Next Steps:");
  console.log("1. Update apps/web/.env.local:");
  console.log(`   NEXT_PUBLIC_FAIRLAUNCH_FACTORY_BSC_TESTNET=${factoryAddress}`);
  console.log("2. Restart dev server");
  console.log("3. Test deployment through admin panel");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
