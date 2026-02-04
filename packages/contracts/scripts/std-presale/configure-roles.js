const hre = require('hardhat');

// Configure roles after deployment (run this after funding admin wallet)
async function main() {
  console.log('\n🔧 MANUAL ROLE CONFIGURATION\n');

  const [deployer, admin] = await hre.ethers.getSigners();

  // Check admin balance
  const adminBalance = await hre.ethers.provider.getBalance(admin.address);
  console.log(`👑 Admin: ${admin.address}`);
  console.log(`💰 Balance: ${hre.ethers.formatEther(adminBalance)} BNB\n`);

  if (adminBalance === 0n) {
    console.log('❌ Admin wallet has no balance!');
    console.log('📝 Fund this address with at least 0.01 tBNB:');
    console.log(`   ${admin.address}\n`);
    console.log('🔗 BSC Testnet Faucet: https://testnet.binance.org/faucet-smart');
    process.exit(1);
  }

  // Deployed contract addresses
  const feeSplitterAddress = '0xce329E6d7415999160bB6f47133b552a91C915a0';
  const factoryAddress = '0x237cc0f76e64DA3172bb7705287617f03DC0B016';

  console.log('📦 Configuring contracts:\n');
  console.log(`   FeeSplitter: ${feeSplitterAddress}`);
  console.log(`   Factory: ${factoryAddress}\n`);

  // Get contract instances
  const feeSplitter = await hre.ethers.getContractAt('FeeSplitter', feeSplitterAddress);
  const factory = await hre.ethers.getContractAt('PresaleFactory', factoryAddress);

  // 1. Grant Factory admin role on FeeSplitter
  console.log('🔐 Step 1: Granting DEFAULT_ADMIN_ROLE to Factory on FeeSplitter...');
  const DEFAULT_ADMIN_ROLE = await feeSplitter.DEFAULT_ADMIN_ROLE();
  const tx1 = await feeSplitter.connect(admin).grantRole(DEFAULT_ADMIN_ROLE, factoryAddress);
  console.log(`   TX: ${tx1.hash}`);
  await tx1.wait();
  console.log('   ✅ Done!\n');

  // 2. Grant admin FACTORY_ADMIN_ROLE
  console.log('🔐 Step 2: Granting FACTORY_ADMIN_ROLE to admin on Factory...');
  const FACTORY_ADMIN_ROLE = await factory.FACTORY_ADMIN_ROLE();
  const tx2 = await factory.connect(deployer).grantRole(FACTORY_ADMIN_ROLE, admin.address);
  console.log(`   TX: ${tx2.hash}`);
  await tx2.wait();
  console.log('   ✅ Done!\n');

  console.log('✅ All roles configured successfully!\n');
  console.log('🎉 Deployment is now complete and ready to use!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
