const hre = require('hardhat');

async function main() {
  console.log('\n🔍 CHECKING PRESALE STATUS & FINALIZING\n');

  const roundAddr = '0x4ACE2f1826aA7c70De67E2855eDd98151A2E9Eb1';
  const round = await hre.ethers.getContractAt('PresaleRound', roundAddr);

  // Get all info
  const totalRaised = await round.totalRaised();
  const softCap = await round.softCap();
  const hardCap = await round.hardCap();
  const endTime = await round.endTime();
  const timelockAddr = await round.timelockExecutor();
  const ownerAddr = await round.projectOwner();

  const now = Math.floor(Date.now() / 1000);

  console.log('📊 Presale Details:');
  console.log(`   Address: ${roundAddr}`);
  console.log(`   Total Raised: ${hre.ethers.formatEther(totalRaised)} BNB`);
  console.log(`   Softcap: ${hre.ethers.formatEther(softCap)} BNB`);
  console.log(`   Hardcap: ${hre.ethers.formatEther(hardCap)} BNB`);
  console.log(`   End Time: ${new Date(Number(endTime) * 1000).toLocaleString()}`);
  console.log(`   Current Time: ${new Date(now * 1000).toLocaleString()}`);
  console.log(`   Timelock: ${timelockAddr}`);
  console.log(`   Owner: ${ownerAddr}\n`);

  // Check if ended
  const hasEnded = now > endTime;
  const reachedSoftcap = totalRaised >= softCap;

  console.log('✅ Conditions:');
  console.log(`   Has Ended: ${hasEnded ? '✅' : '❌'}`);
  console.log(`   Reached Softcap: ${reachedSoftcap ? '✅' : '❌'}\n`);

  if (!hasEnded) {
    console.log("⏳ Presale hasn't ended yet. Wait until end time.\n");
    return;
  }

  // Check who has ADMIN_ROLE
  const ADMIN_ROLE = await round.ADMIN_ROLE();
  console.log('🔐 Checking ADMIN_ROLE:');

  const signers = await hre.ethers.getSigners();
  let adminSigner = null;

  for (let i = 0; i < Math.min(signers.length, 5); i++) {
    const hasRole = await round.hasRole(ADMIN_ROLE, signers[i].address);
    console.log(
      `   ${i}. ${signers[i].address.slice(0, 10)}...: ${hasRole ? '✅ HAS ADMIN' : '❌'}`
    );
    if (hasRole && !adminSigner) {
      adminSigner = signers[i];
    }
  }

  // Check timelock
  const timelockHasRole = await round.hasRole(ADMIN_ROLE, timelockAddr);
  console.log(
    `   Timelock ${timelockAddr.slice(0, 10)}...: ${timelockHasRole ? '✅ HAS ADMIN' : '❌'}\n`
  );

  if (!adminSigner) {
    console.log('❌ No available signer has ADMIN_ROLE!');
    console.log('💡 Need to use timelock wallet or grant role first.\n');

    // Try to grant role from DEFAULT_ADMIN
    console.log('🔧 Attempting to grant ADMIN_ROLE to signer[1]...');
    try {
      const DEFAULT_ADMIN_ROLE = await round.DEFAULT_ADMIN_ROLE();
      const defaultAdmins = [];

      for (let i = 0; i < Math.min(signers.length, 5); i++) {
        const hasDefault = await round.hasRole(DEFAULT_ADMIN_ROLE, signers[i].address);
        if (hasDefault) {
          console.log(`   Found DEFAULT_ADMIN: ${signers[i].address}`);
          const tx = await round.connect(signers[i]).grantRole(ADMIN_ROLE, signers[1].address);
          await tx.wait();
          console.log(`   ✅ Granted ADMIN_ROLE to ${signers[1].address}\n`);
          adminSigner = signers[1];
          break;
        }
      }
    } catch (e) {
      console.log(`   Failed: ${e.message}\n`);
    }
  }

  if (!adminSigner) {
    console.log('❌ Cannot finalize without ADMIN_ROLE\n');
    console.log('📝 Manual steps:');
    console.log(
      '1. Go to BSCScan: https://testnet.bscscan.com/address/' + roundAddr + '#writeContract'
    );
    console.log('2. Connect wallet with ADMIN_ROLE');
    console.log('3. Call finalizeSuccess() with:');
    console.log(
      '   - merkleRoot: 0x0000000000000000000000000000000000000000000000000000000000000000'
    );
    console.log('   - totalVestingAllocation: 0\n');
    return;
  }

  console.log(`✅ Found admin signer: ${adminSigner.address}\n`);

  // Finalize SUCCESS (without vesting for quick test)
  console.log('🏁 Finalizing presale (SUCCESS - no vesting)...');

  const merkleRoot = '0x' + '0'.repeat(64); // Empty root
  const totalAlloc = 0; // No vesting allocation

  try {
    const tx = await round.connect(adminSigner).finalizeSuccess(merkleRoot, totalAlloc);
    console.log(`   TX submitted: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`   ✅ Finalized! Block: ${receipt.blockNumber}\n`);

    // Check fee distribution
    const feeSplitterAddr = await round.feeSplitter();
    const feeSplitter = await hre.ethers.getContractAt('FeeSplitter', feeSplitterAddr);

    const treasuryVault = await feeSplitter.treasuryVault();
    const referralVault = await feeSplitter.referralPoolVault();
    const sbtVault = await feeSplitter.sbtStakingVault();

    console.log('💰 Fee Distribution:');
    const treasuryBal = await hre.ethers.provider.getBalance(treasuryVault);
    const referralBal = await hre.ethers.provider.getBalance(referralVault);
    const sbtBal = await hre.ethers.provider.getBalance(sbtVault);

    console.log(`   Treasury: ${hre.ethers.formatEther(treasuryBal)} BNB`);
    console.log(`   Referral: ${hre.ethers.formatEther(referralBal)} BNB`);
    console.log(`   SBT: ${hre.ethers.formatEther(sbtBal)} BNB`);

    const totalFee = treasuryBal + referralBal + sbtBal;
    console.log(`   TOTAL FEE: ${hre.ethers.formatEther(totalFee)} BNB\n`);

    // Expected: 5% of 3 BNB = 0.15 BNB
    const expectedFee = (totalRaised * 500n) / 10000n;
    console.log('✅ Verification:');
    console.log(`   Expected Fee: ${hre.ethers.formatEther(expectedFee)} BNB`);
    console.log(`   Actual Fee: ${hre.ethers.formatEther(totalFee)} BNB`);
    console.log(`   Match: ${totalFee === expectedFee ? '✅' : '⚠️'}\n`);

    console.log('🎉 FINALIZATION COMPLETE!\n');
  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
    if (error.message.includes('already finalized')) {
      console.log('ℹ️  Presale already finalized. Checking fee distribution...\n');

      const feeSplitterAddr = await round.feeSplitter();
      const feeSplitter = await hre.ethers.getContractAt('FeeSplitter', feeSplitterAddr);

      const treasuryVault = await feeSplitter.treasuryVault();
      const treasuryBal = await hre.ethers.provider.getBalance(treasuryVault);
      console.log(`Treasury Balance: ${hre.ethers.formatEther(treasuryBal)} BNB\n`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
