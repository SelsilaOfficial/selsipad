const hre = require('hardhat');

async function main() {
  console.log('\n🏁 FINALIZING PRESALE\n');

  const roundAddr = '0x4ACE2f1826aA7c70De67E2855eDd98151A2E9Eb1';
  const round = await hre.ethers.getContractAt('PresaleRound', roundAddr);

  // Get info
  const totalRaised = await round.totalRaised();
  const softCap = await round.softCap();
  const endTime = await round.endTime();
  const ownerAddr = await round.projectOwner();

  console.log(`Presale: ${roundAddr}`);
  console.log(`Total Raised: ${hre.ethers.formatEther(totalRaised)} BNB`);
  console.log(`Softcap: ${hre.ethers.formatEther(softCap)} BNB`);
  console.log(`Owner: ${ownerAddr}\n`);

  // Check DEFAULT_ADMIN_ROLE (timelock should have it)
  const DEFAULT_ADMIN_ROLE = await round.DEFAULT_ADMIN_ROLE();
  const signers = await hre.ethers.getSigners();

  console.log('Checking DEFAULT_ADMIN_ROLE:');
  let adminSigner = null;
  for (let i = 0; i < Math.min(signers.length, 5); i++) {
    const hasRole = await round.hasRole(DEFAULT_ADMIN_ROLE, signers[i].address);
    console.log(`  ${i}. ${signers[i].address.slice(0, 10)}...: ${hasRole ? '✅' : '❌'}`);
    if (hasRole && !adminSigner) adminSigner = signers[i];
  }

  if (!adminSigner) {
    console.log('\n❌ No signer has DEFAULT_ADMIN_ROLE - cannot finalize\n');
    return;
  }

  console.log(`\n✅ Using: ${adminSigner.address}\n`);

  //Finalize
  console.log('Calling finalizeSuccess...');
  const merkleRoot = '0x' + '0'.repeat(64);
  const tx = await round.connect(adminSigner).finalizeSuccess(merkleRoot, 0);
  console.log(`TX: ${tx.hash}`);
  await tx.wait();
  console.log('✅ Finalized!\n');

  // Check fees
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

  console.log('🎉 DONE!\n');
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
