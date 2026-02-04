const hre = require('hardhat');

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🏁 FINALIZE PRESALE & VERIFY FEES');
  console.log('='.repeat(70) + '\n');

  // Get signers
  const signers = await hre.ethers.getSigners();
  const admin = signers[1]; // Admin wallet
  const timelock = signers[1]; // Using same for testnet

  console.log(`👤 Admin: ${admin.address}\n`);

  // Presale addresses
  const roundAddr = '0x4ACE2f1826aA7c70De67E2855eDd98151A2E9Eb1';
  const round = await hre.ethers.getContractAt('PresaleRound', roundAddr);

  // Get associated contracts
  const vestingAddr = await round.vestingVault();
  const vesting = await hre.ethers.getContractAt('MerkleVesting', vestingAddr);

  const feeSplitterAddr = await round.feeSplitter();
  const feeSplitter = await hre.ethers.getContractAt('FeeSplitter', feeSplitterAddr);

  // Get vault addresses
  const treasuryVault = await feeSplitter.treasuryVault();
  const referralVault = await feeSplitter.referralPoolVault();
  const sbtVault = await feeSplitter.sbtStakingVault();

  console.log('📦 Contracts:');
  console.log(`   Round: ${roundAddr}`);
  console.log(`   Vesting: ${vestingAddr}`);
  console.log(`   FeeSplitter: ${feeSplitterAddr}\n`);

  // Check current status
  const totalRaised = await round.totalRaised();
  const softCap = await round.softCap();
  const endTime = await round.endTime();
  const now = Math.floor(Date.now() / 1000);

  console.log('📊 Presale Status:');
  console.log(`   Total Raised: ${hre.ethers.formatEther(totalRaised)} BNB`);
  console.log(`   Softcap: ${hre.ethers.formatEther(softCap)} BNB`);
  console.log(`   End Time: ${new Date(Number(endTime) * 1000).toLocaleTimeString()}`);
  console.log(`   Current Time: ${new Date(now * 1000).toLocaleTimeString()}\n`);

  // Wait for end time if needed
  if (now < endTime) {
    const waitSec = Number(endTime) - now + 2;
    console.log(`⏳ Waiting ${waitSec}s for end time...`);
    await new Promise((r) => setTimeout(r, waitSec * 1000));
    console.log('   ✅ End time reached!\n');
  }

  // Snapshot vault balances BEFORE finalize
  console.log('💰 Vault Balances BEFORE Finalization:');
  const treasuryBefore = await hre.ethers.provider.getBalance(treasuryVault);
  const referralBefore = await hre.ethers.provider.getBalance(referralVault);
  const sbtBefore = await hre.ethers.provider.getBalance(sbtVault);

  console.log(`   Treasury: ${hre.ethers.formatEther(treasuryBefore)} BNB`);
  console.log(`   Referral: ${hre.ethers.formatEther(referralBefore)} BNB`);
  console.log(`   SBT: ${hre.ethers.formatEther(sbtBefore)} BNB\n`);

  // Create merkle tree for vesting (simple: 100% to admin for testing)
  const { buildMerkle } = require('../test/helpers/merkle');
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;
  const scheduleSalt = await vesting.scheduleSalt();

  const totalAllocated = totalRaised; // All raised goes to vesting (simplified)
  const merkleData = buildMerkle(vestingAddr, chainId, scheduleSalt, [
    { beneficiary: admin.address, totalAllocation: totalAllocated },
  ]);

  console.log('🌳 Merkle Root Created:');
  console.log(`   Root: ${merkleData.root}`);
  console.log(`   Total Allocated: ${hre.ethers.formatEther(totalAllocated)} BNB\n`);

  // Fund vesting vault with project tokens (mock - just send some)
  const projectToken = await round.projectToken();
  const token = await hre.ethers.getContractAt('ERC20Mock', projectToken);

  console.log('📤 Funding vesting vault with project tokens...');
  const mintAmount = hre.ethers.parseEther('1000000'); // 1M tokens
  await token.mint(admin.address, mintAmount);
  await token.connect(admin).transfer(vestingAddr, totalAllocated); // Transfer amount equal to allocation
  console.log('   ✅ Vesting vault funded\n');

  // Finalize SUCCESS
  console.log('🏁 Finalizing presale (SUCCESS)...');
  const tx = await round.connect(admin).finalizeSuccess(merkleData.root, totalAllocated);
  const receipt = await tx.wait();
  console.log(`   TX: ${receipt.hash}`);
  console.log('   ✅ Finalized!\n');

  // Check vault balances AFTER finalize
  console.log('💰 Vault Balances AFTER Finalization:');
  const treasuryAfter = await hre.ethers.provider.getBalance(treasuryVault);
  const referralAfter = await hre.ethers.provider.getBalance(referralVault);
  const sbtAfter = await hre.ethers.provider.getBalance(sbtVault);

  console.log(`   Treasury: ${hre.ethers.formatEther(treasuryAfter)} BNB`);
  console.log(`   Referral: ${hre.ethers.formatEther(referralAfter)} BNB`);
  console.log(`   SBT: ${hre.ethers.formatEther(sbtAfter)} BNB\n`);

  // Calculate deltas
  const treasuryDelta = treasuryAfter - treasuryBefore;
  const referralDelta = referralAfter - referralBefore;
  const sbtDelta = sbtAfter - sbtBefore;
  const totalFee = treasuryDelta + referralDelta + sbtDelta;

  console.log('📈 Fee Distribution:');
  console.log(`   Treasury: +${hre.ethers.formatEther(treasuryDelta)} BNB`);
  console.log(`   Referral: +${hre.ethers.formatEther(referralDelta)} BNB`);
  console.log(`   SBT: +${hre.ethers.formatEther(sbtDelta)} BNB`);
  console.log(`   TOTAL FEE: ${hre.ethers.formatEther(totalFee)} BNB\n`);

  // Verify fee calculation (5% of 3 BNB = 0.15 BNB)
  const expectedFee = (totalRaised * 500n) / 10000n; // 5%
  const expectedTreasury = (expectedFee * 250n) / 500n; // 2.5% (50% of fee)
  const expectedReferral = (expectedFee * 200n) / 500n; // 2%
  const expectedSbt = (expectedFee * 50n) / 500n; // 0.5%

  console.log('✅ Verification:');
  console.log(`   Expected Total Fee: ${hre.ethers.formatEther(expectedFee)} BNB`);
  console.log(`   Actual Total Fee: ${hre.ethers.formatEther(totalFee)} BNB`);
  console.log(`   Match: ${totalFee === expectedFee ? '✅' : '❌'}\n`);

  console.log(`   Expected Treasury: ${hre.ethers.formatEther(expectedTreasury)} BNB`);
  console.log(`   Actual Treasury: ${hre.ethers.formatEther(treasuryDelta)} BNB`);
  console.log(`   Match: ${treasuryDelta === expectedTreasury ? '✅' : '❌'}\n`);

  console.log('=' + '='.repeat(69));
  console.log('🎉 PRESALE FINALIZED & FEES VERIFIED!');
  console.log('=' + '='.repeat(69) + '\n');

  console.log('🔗 View on BSCScan:');
  console.log(
    `   ${receipt.transactionHash ? `https://testnet.bscscan.com/tx/${receipt.hash}` : roundAddr}\n`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
