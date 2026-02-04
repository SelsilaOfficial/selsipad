const hre = require('hardhat');

/**
 * Post-Finalization Verification
 * Verifies that the presale was finalized correctly
 */

const Status = {
  0: 'UPCOMING',
  1: 'ACTIVE',
  2: 'ENDED',
  3: 'FINALIZED_SUCCESS',
  4: 'FINALIZED_FAILED',
  5: 'CANCELLED',
};

async function main() {
  console.log('\n✅ POST-FINALIZATION VERIFICATION\n');

  const roundAddr = '0x4ACE2f1826aA7c70De67E2855eDd98151A2E9Eb1';
  const round = await hre.ethers.getContractAt('PresaleRound', roundAddr);

  // Get contract references
  const feeSplitter = await round.feeSplitter();
  const vestingVault = await round.vestingVault();
  const projectOwner = await round.projectOwner();
  const projectToken = await round.projectToken();

  console.log('🔍 Checking Presale Status...\n');

  // 1. Status Check
  const status = await round.status();
  const totalRaised = await round.totalRaised();
  const softCap = await round.softCap();
  const tgeTimestamp = await round.tgeTimestamp();

  console.log(`  Status: ${Status[status]} ${status === 3 ? '✅' : '❌'}`);
  console.log(`  Total Raised: ${hre.ethers.formatEther(totalRaised)} BNB`);
  console.log(`  TGE Timestamp: ${new Date(Number(tgeTimestamp) * 1000).toLocaleString()}`);

  // 2. Balance Checks
  console.log('\n💰 Balance Verification...\n');

  const roundBalance = await hre.ethers.provider.getBalance(roundAddr);
  console.log(
    `  PresaleRound Balance: ${hre.ethers.formatEther(roundBalance)} BNB ${
      roundBalance === 0n ? '✅' : '⚠️'
    }`
  );

  const feeSplitterContract = await hre.ethers.getContractAt('FeeSplitter', feeSplitter);
  const treasuryVault = await feeSplitterContract.treasuryVault();
  const referralPoolVault = await feeSplitterContract.referralPoolVault();
  const sbtStakingVault = await feeSplitterContract.sbtStakingVault();

  const treasuryBal = await hre.ethers.provider.getBalance(treasuryVault);
  const referralBal = await hre.ethers.provider.getBalance(referralPoolVault);
  const sbtBal = await hre.ethers.provider.getBalance(sbtStakingVault);
  const projectOwnerBal = await hre.ethers.provider.getBalance(projectOwner);

  console.log(`  Treasury Vault: ${hre.ethers.formatEther(treasuryBal)} BNB`);
  console.log(`  Referral Pool: ${hre.ethers.formatEther(referralBal)} BNB`);
  console.log(`  SBT Staking: ${hre.ethers.formatEther(sbtBal)} BNB`);

  // Calculate expected fee distribution
  const feeConfig = await round.feeConfig();
  const totalFee = (totalRaised * feeConfig.totalBps) / 10000n;
  const netAmount = totalRaised - totalFee;

  const expectedTreasury = (totalFee * feeConfig.treasuryBps) / feeConfig.totalBps;
  const expectedReferral = (totalFee * feeConfig.referralPoolBps) / feeConfig.totalBps;
  const expectedSbt = (totalFee * feeConfig.sbtStakingBps) / feeConfig.totalBps;
  const treasuryRemainder = totalFee - (expectedTreasury + expectedReferral + expectedSbt);

  console.log(`\n  Expected Distribution:`);
  console.log(`  - Total Fee: ${hre.ethers.formatEther(totalFee)} BNB`);
  console.log(`  - Net to Project: ${hre.ethers.formatEther(netAmount)} BNB`);
  console.log(
    `  - Treasury (incl. remainder): ${hre.ethers.formatEther(
      expectedTreasury + treasuryRemainder
    )} BNB`
  );
  console.log(`  - Referral Pool: ${hre.ethers.formatEther(expectedReferral)} BNB`);
  console.log(`  - SBT Staking: ${hre.ethers.formatEther(expectedSbt)} BNB`);

  // 3. Vesting Vault Check
  console.log('\n🔒 Vesting Vault Status...\n');

  const vestingContract = await hre.ethers.getContractAt('MerkleVesting', vestingVault);
  const merkleRoot = await vestingContract.merkleRoot();
  const totalAllocated = await vestingContract.totalAllocated();
  const vaultTgeTime = await vestingContract.tgeTimestamp();

  console.log(`  Merkle Root: ${merkleRoot.slice(0, 18)}...`);
  console.log(`  Total Allocated: ${totalAllocated} wei (minimal)`);
  console.log(`  TGE Time: ${new Date(Number(vaultTgeTime) * 1000).toLocaleString()}`);
  console.log(`  Root Set: ${merkleRoot !== '0x' + '0'.repeat(64) ? '✅' : '❌'}`);

  // 4. Final Summary
  console.log('\n📊 VERIFICATION SUMMARY\n');

  const checks = {
    statusFinalized: status === 3,
    roundBalanceEmpty: roundBalance === 0n,
    merkleRootSet: merkleRoot !== '0x' + '0'.repeat(64),
    tgeTimestampSet: tgeTimestamp > 0n,
  };

  Object.entries(checks).forEach(([key, value]) => {
    console.log(`  ${key}: ${value ? '✅' : '❌'}`);
  });

  const allPassed = Object.values(checks).every((v) => v);
  console.log(`\n  Overall: ${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}\n`);

  // 5. Transaction Link
  console.log('🔗 View on Explorer:\n');
  console.log(`  https://testnet.bscscan.com/address/${roundAddr}\n`);
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
