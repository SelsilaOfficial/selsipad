const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  
  console.log("\n📊 Deployer Balance Check");
  console.log("========================");
  console.log("Address:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "tBNB");
  console.log("========================\n");
  
  const minRequired = hre.ethers.parseEther("0.3");
  if (balance < minRequired) {
    console.log("⚠️  WARNING: Balance may be insufficient for deployment");
    console.log("   Required: ~0.3 tBNB");
    console.log("   Current:", hre.ethers.formatEther(balance), "tBNB");
    console.log("   Get testnet BNB: https://testnet.bnbchain.org/faucet-smart\n");
  } else {
    console.log("✅ Balance sufficient for deployment\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
