const hre = require('hardhat');

// Grant admin role and finalize
async function main() {
  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  const admin = signers[1];

  const roundAddr = '0x4ACE2f1826aA7c70De67E2855eDd98151A2E9Eb1';
  const round = await hre.ethers.getContractAt('PresaleRound', roundAddr);

  console.log('\n🔐 Granting ADMIN_ROLE to admin...');
  const ADMIN_ROLE = await round.ADMIN_ROLE();
  const hasRole = await round.hasRole(ADMIN_ROLE, admin.address);

  if (!hasRole) {
    console.log(`   Admin doesn't have role, granting from deployer/timelock...`);
    const tx = await round.connect(deployer).grantRole(ADMIN_ROLE, admin.address);
    await tx.wait();
    console.log('   ✅ Role granted!\n');
  } else {
    console.log('   ✅ Admin already has role\n');
  }

  // Now run finalize
  console.log('Running finalize script...\n');
  await require('./finalize-presale');
}

main().catch(console.error);
