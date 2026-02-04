const hre = require('hardhat');

// Grant timelock DEFAULT_ADMIN_ROLE on Factory
async function main() {
  console.log('\n🔧 Granting DEFAULT_ADMIN_ROLE to Timelock on Factory...\n');

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}\n`);

  const factoryAddr = '0x237cc0f76e64DA3172bb7705287617f03DC0B016';
  const timelockAddr = '0xdce552fa663879e2453f2259ced9f06a0c4a6a2d';

  const factory = await hre.ethers.getContractAt('PresaleFactory', factoryAddr);

  const DEFAULT_ADMIN_ROLE = await factory.DEFAULT_ADMIN_ROLE();

  console.log(`📦 Factory: ${factoryAddr}`);
  console.log(`🔐 Timelock: ${timelockAddr}\n`);

  console.log('🔄 Granting role...');
  const tx = await factory.connect(deployer).grantRole(DEFAULT_ADMIN_ROLE, timelockAddr);
  console.log(`   TX: ${tx.hash}`);
  await tx.wait();
  console.log('   ✅ Confirmed!\n');

  // Verify
  const hasRole = await factory.hasRole(DEFAULT_ADMIN_ROLE, timelockAddr);
  if (hasRole) {
    console.log('✅ SUCCESS: Timelock now has DEFAULT_ADMIN_ROLE on Factory!\n');
  } else {
    console.log('❌ ERROR: Role grant verification failed!\n');
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
