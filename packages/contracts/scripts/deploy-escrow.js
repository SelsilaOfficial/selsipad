const hre = require("hardhat");

async function main() {
  console.log("Deploying EscrowVault to BSC Testnet...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "BNB");

  // Deploy EscrowVault
  const EscrowVault = await hre.ethers.getContractFactory("EscrowVault");
  const escrowVault = await EscrowVault.deploy();

  await escrowVault.waitForDeployment();

  const address = await escrowVault.getAddress();
  console.log("✅ EscrowVault deployed to:", address);

  // Save deployment address
  const fs = require("fs");
  const deploymentsPath = "./deployments-escrow.json";
  
  let deployments = {};
  if (fs.existsSync(deploymentsPath)) {
    deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  }

  deployments["97"] = {
    EscrowVault: address,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log("💾 Deployment saved to", deploymentsPath);

  // Wait for confirmations before verification
  console.log("⏳ Waiting for 5 confirmations...");
  await escrowVault.deploymentTransaction().wait(5);

  // Verify on BSCScan
  console.log("🔍 Verifying on BSCScan...");
  try {
    await hre.run("verify:verify", {
      address: address,
      constructorArguments: [],
    });
    console.log("✅ Contract verified on BSCScan");
  } catch (error) {
    console.error("❌ Verification failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
