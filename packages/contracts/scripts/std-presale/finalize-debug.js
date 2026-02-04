const hre = require('hardhat');

async function main() {
  console.log('\n🔍 DEBUGGING FINALIZE REQUIREMENTS\n');

  const roundAddr = '0x4ACE2f1826aA7c70De67E2855eDd98151A2E9Eb1';
  const round = await hre.ethers.getContractAt('PresaleRound', roundAddr);

  const timelockSigner = (await hre.ethers.getSigners())[2]; // Index 2 = timelock
  console.log(`Using timelock: ${timelockSigner.address}\n`);

  // Check all relevant roles
  const DEFAULT_ADMIN_ROLE = await round.DEFAULT_ADMIN_ROLE();
  const ADMIN_ROLE = await round.ADMIN_ROLE();

  const hasDefaultAdmin = await round.hasRole(DEFAULT_ADMIN_ROLE, timelockSigner.address);
  const hasAdmin = await round.hasRole(ADMIN_ROLE, timelockSigner.address);

  console.log('Roles for timelock:');
  console.log(`  DEFAULT_ADMIN_ROLE: ${hasDefaultAdmin ? '✅' : '❌'}`);
  console.log(`  ADMIN_ROLE: ${hasAdmin ? '✅' : '❌'}\n`);

  // If has DEFAULT_ADMIN but not ADMIN, grant ADMIN to self
  if (hasDefaultAdmin && !hasAdmin) {
    console.log('🔧 Granting ADMIN_ROLE to timelock...');
    const tx = await round.connect(timelockSigner).grantRole(ADMIN_ROLE, timelockSigner.address);
    await tx.wait();
    console.log('   ✅ ADMIN_ROLE granted!\n');
  }

  // Now try finalize
  console.log('🏁 Finalizing presale...');
  const merkleRoot = '0x' + '0'.repeat(64);
  const tx = await round.connect(timelockSigner).finalizeSuccess(merkleRoot, 0);
  console.log(`   TX: ${tx.hash}`);
  await tx.wait();
  console.log('   ✅ SUCCESS!\n');

  // Check fee distribution
  const feeSplitter = await hre.ethers.getContractAt('FeeSplitter', await round.feeSplitter());
  const treasury = await feeSplitter.treasuryVault();
  const referral = await feeSplitter.referralPoolVault();
  const sbt = await feeSplitter.sbtStakingVault();

  const treasuryBal = await hre.ethers.provider.getBalance(treasury);
  const referralBal = await hre.ethers.provider.getBalance(referral);
  const sbtBal = await hre.ethers.provider.getBalance(sbt);

  console.log('💰 Fee Distribution:');
  console.log(`  Treasury: ${hre.ethers.formatEther(treasuryBal)} BNB`);
  console.log(`  Referral: ${hre.ethers.formatEther(referralBal)} BNB`);
  console.log(`  SBT: ${hre.ethers.formatEther(sbtBal)} BNB`);
  console.log(`  TOTAL: ${hre.ethers.formatEther(treasuryBal + referralBal + sbtBal)} BNB\n`);

  console.log('🎉 E2E TEST COMPLETE!\n');
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
