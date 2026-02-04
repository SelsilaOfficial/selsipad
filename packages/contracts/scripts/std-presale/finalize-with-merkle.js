const hre = require('hardhat');
const fs = require('fs');

/**
 * Finalize Presale with Proper Merkle Tree
 * Uses merkle-tree.json generated from previous step
 */

async function main() {
  console.log('\n🎯 FINALIZING PRESALE WITH VESTING\n');

  // Load data
  const deployment = JSON.parse(fs.readFileSync('deployment-vesting-test.json', 'utf8'));
  const merkleData = JSON.parse(fs.readFileSync('merkle-tree.json', 'utf8'));

  const roundAddr = deployment.presaleRound;
  const vestingVaultAddr = deployment.vestingVault;
  const merkleRoot = merkleData.merkleRoot;
  const totalAllocation = BigInt(merkleData.totalAllocation);

  console.log(`PresaleRound: ${roundAddr}`);
  console.log(`VestingVault: ${vestingVaultAddr}`);
  console.log(`Merkle Root: ${merkleRoot}`);
  console.log(`Total Allocation: ${hre.ethers.formatEther(totalAllocation)} tokens\n`);

  const round = await hre.ethers.getContractAt('PresaleRound', roundAddr);
  const signers = await hre.ethers.getSigners();
  const timelock = signers[2]; // Admin
  const projectOwner = signers[1]; // Token owner

  // Check if presale ended
  const status = await round.status();
  const endTime = await round.endTime();
  const now = Math.floor(Date.now() / 1000);

  console.log(`Status: ${status}`);
  console.log(`End Time: ${new Date(Number(endTime) * 1000).toLocaleString()}`);
  console.log(`Current: ${new Date(now * 1000).toLocaleString()}\n`);

  if (now < Number(endTime)) {
    const waitTime = Number(endTime) - now;
    console.log(`⏳ Waiting ${waitTime} seconds for presale to end...\n`);
    await new Promise((resolve) => setTimeout(resolve, (waitTime + 2) * 1000));
  }

  // Approve tokens
  console.log('💰 Approving tokens...\n');

  const projectToken = await round.projectToken();
  const tokenContract = await hre.ethers.getContractAt('IERC20', projectToken);

  console.log(`  Project Token: ${projectToken}`);
  console.log(`  Approving ${hre.ethers.formatEther(totalAllocation)} tokens to round...\n`);

  const approveTx = await tokenContract.connect(projectOwner).approve(roundAddr, totalAllocation);
  await approveTx.wait();
  console.log(`  ✅ Approved\n`);

  // Finalize
  console.log('🎯 Finalizing presale...\n');

  try {
    const tx = await round.connect(timelock).finalizeSuccess(merkleRoot, totalAllocation);

    console.log(`  Transaction: ${tx.hash}`);
    console.log('  ⏳ Waiting for confirmation...\n');

    const receipt = await tx.wait();
    console.log(`  ✅ Confirmed in block ${receipt.blockNumber}\n`);

    // Parse events
    const finalizedEvent = receipt.logs
      .map((log) => {
        try {
          return round.interface.parseLog({
            topics: log.topics,
            data: log.data,
          });
        } catch {
          return null;
        }
      })
      .find((e) => e && e.name === 'FinalizedSuccess');

    if (finalizedEvent) {
      console.log('📊 Finalization Summary:\n');
      console.log(`  Total Raised: ${hre.ethers.formatEther(finalizedEvent.args.totalRaised)} BNB`);
      console.log(`  Fee: ${hre.ethers.formatEther(finalizedEvent.args.feeAmount)} BNB`);
      console.log(
        `  TGE: ${new Date(Number(finalizedEvent.args.tgeTimestamp) * 1000).toLocaleString()}\n`
      );
    }

    // Verify status
    const finalStatus = await round.status();
    const tgeTimestamp = await round.tgeTimestamp();

    console.log('✅ FINALIZATION SUCCESSFUL!\n');
    console.log(`  Status: ${finalStatus} (should be 3 = FINALIZED_SUCCESS)`);
    console.log(`  TGE Time: ${new Date(Number(tgeTimestamp) * 1000).toLocaleString()}\n`);

    console.log('📋 Next: Test claims for buyers\n');
  } catch (error) {
    console.log('\n❌ FINALIZATION FAILED\n');
    console.log(`Error: ${error.message}\n`);

    if (error.data) {
      try {
        const decoded = round.interface.parseError(error.data);
        if (decoded) {
          console.log(`Decoded: ${decoded.name}\n`);
        }
      } catch {}
    }

    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
