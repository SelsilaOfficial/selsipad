// Deploy test ERC20 token for local testing
// Usage: npx hardhat run scripts/deploy-test-token.js --network localhost

const hre = require("hardhat");

async function main() {
  console.log("🪙 Deploying test ERC20 token...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const MockERC20 = await hre.ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
  const token = await MockERC20.deploy(
    "Fairlaunch Test Token",
    "FLTEST",
    hre.ethers.parseEther("1000000") // 1M tokens
  );
  
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  console.log("✅ Test token deployed to:", tokenAddress);
  console.log("   Name: Fairlaunch Test Token");
  console.log("   Symbol: FLTEST");
  console.log("   Supply: 1,000,000 FLTEST");
  console.log("   Owner:", deployer.address);
  
  // Check balance
  const balance = await token.balanceOf(deployer.address);
  console.log("   Balance:", hre.ethers.formatEther(balance), "FLTEST\n");

  console.log("📋 Use this address in wizard Step 2:");
  console.log("   ", tokenAddress, "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
