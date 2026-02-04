const hre = require('hardhat');
const fs = require('fs');

/**
 * Test Token Claims for All Buyers
 * Tests immediate TGE unlock and vesting progress
 */

async function main() {
  console.log('\n🎁 TESTING TOKEN CLAIMS\n');

  // Load data
  const deployment = JSON.parse(fs.readFileSync('deployment-vesting-test.json', 'utf8'));
  const merkleData = JSON.parse(fs.readFileSync('merkle-tree.json', 'utf8'));

  const vestingVaultAddr = deployment.vestingVault;
  const vesting = await hre.ethers.getContractAt('MerkleVesting', vestingVaultAddr);

  console.log(`VestingVault: ${vestingVaultAddr}\n`);

  // Get signers
  const signers = await hre.ethers.getSigners();
  const buyers = [
    { signer: signers[4], label: 'BUYER1' },
    { signer: signers[5], label: 'BUYER2' },
  ];

  // Get vesting info
  const tgeTimestamp = await vesting.tgeTimestamp();
  const tgeUnlockBps = await vesting.tgeUnlockBps();
  const cliffDuration = await vesting.cliffDuration();
  const vestingDuration = await vesting.vestingDuration();

  console.log('📋 Vesting Schedule:\n');
  console.log(`  TGE: ${new Date(Number(tgeTimestamp) * 1000).toLocaleString()}`);
  console.log(`  TGE Unlock: ${Number(tgeUnlockBps) / 100}%`);
  console.log(`  Cliff: ${Number(cliffDuration) / 3600} hour`);
  console.log(`  Vesting: ${Number(vestingDuration) / 3600} hours\n`);

  // Calculate time status
  const now = Math.floor(Date.now() / 1000);
  const cliffEnd = Number(tgeTimestamp) + Number(cliffDuration);
  const vestingEnd = cliffEnd + Number(vestingDuration);

  console.log('⏰ Current Status (WIB):\n');
  console.log(
    `  Current: ${new Date(now * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`
  );
  console.log(
    `  TGE: ${new Date(Number(tgeTimestamp) * 1000).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
    })}`
  );
  console.log(
    `  Cliff End: ${new Date(cliffEnd * 1000).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
    })}`
  );
  console.log(
    `  Vesting End: ${new Date(vestingEnd * 1000).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
    })}\n`
  );

  // Test claims
  console.log('🎁 Testing Claims:\n');

  for (const buyer of buyers) {
    const alloc = merkleData.allocations.find((a) => a.address === buyer.signer.address);

    if (!alloc) {
      console.log(`  ${buyer.label}: ❌ No allocation found\n`);
      continue;
    }

    const totalAllocation = BigInt(alloc.allocation);
    const proof = alloc.proof;

    console.log(`  ${buyer.label}: ${buyer.signer.address}`);
    console.log(`    Total Allocation: ${hre.ethers.formatEther(totalAllocation)} tokens`);

    // Check claimable amount
    try {
      const claimable = await vesting.getClaimable(buyer.signer.address, totalAllocation);
      const percentage =
        totalAllocation > 0n ? Number((claimable * 10000n) / totalAllocation) / 100 : 0;

      console.log(
        `    Claimable Now: ${hre.ethers.formatEther(claimable)} tokens (${percentage}%)`
      );

      if (claimable === 0n) {
        console.log(`    ⚠️  Nothing to claim yet\n`);
        continue;
      }

      // Execute claim
      console.log(`    📤 Claiming...`);

      const tx = await vesting.connect(buyer.signer).claim(totalAllocation, proof);
      const receipt = await tx.wait();

      console.log(`    ✅ Claimed! (tx: ${tx.hash.slice(0, 18)}...)`);

      // Verify claimed amount
      const claimed = await vesting.claimed(buyer.signer.address);
      console.log(`    Total Claimed: ${hre.ethers.formatEther(claimed)} tokens\n`);
    } catch (error) {
      console.log(`    ❌ Claim failed: ${error.message}\n`);
    }
  }

  console.log('✅ Claim testing complete!\n');
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
