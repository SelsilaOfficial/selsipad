const hre = require('hardhat');

/**
 * @title PresaleRound - Finalize with Status Sync
 * @dev Handles the full finalization flow including status sync
 *
 * PROBLEM:
 * - The presale status is ACTIVE but time has passed
 * - Status syncs only happen when a transaction is made
 * - Static calls (like estimateGas) don't trigger _syncStatus()
 *
 * SOLUTION:
 * - Step 1: Call getPresaleInfo() to trigger a status sync (if needed)
 * - Step 2: Verify status is now ENDED
 * - Step 3: Call finalizeSuccess() with proper parameters
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
  console.log('\n🚀 FINALIZE WITH STATUS SYNC\n');

  const roundAddr = '0x4ACE2f1826aA7c70De67E2855eDd98151A2E9Eb1';
  const round = await hre.ethers.getContractAt('PresaleRound', roundAddr);

  // Get signers
  const signers = await hre.ethers.getSigners();
  const timelock = signers[2]; // The admin signer

  console.log(`Using admin: ${timelock.address}`);
  console.log(`PresaleRound: ${roundAddr}\n`);

  // ============================================
  // STEP 1: Check current status
  // ============================================
  console.log('📊 Step 1: Checking current status...');
  const statusBefore = await round.status();
  const totalRaised = await round.totalRaised();
  const softCap = await round.softCap();
  const endTime = await round.endTime();
  const blockTime = (await hre.ethers.provider.getBlock('latest')).timestamp;

  console.log(`  Status: ${Status[statusBefore]} (${statusBefore})`);
  console.log(`  Total Raised: ${hre.ethers.formatEther(totalRaised)} BNB`);
  console.log(`  Softcap: ${hre.ethers.formatEther(softCap)} BNB`);
  console.log(`  End Time: ${new Date(Number(endTime) * 1000).toLocaleString()}`);
  console.log(`  Current Time: ${new Date(blockTime * 1000).toLocaleString()}`);
  console.log(`  Time Passed: ${blockTime >= Number(endTime) ? '✅ Yes' : '❌ No'}\n`);

  // ============================================
  // STEP 2: Trigger status sync if needed
  // ============================================
  if (statusBefore !== 2 && blockTime >= Number(endTime)) {
    console.log('⚡ Step 2: Triggering status sync...');
    console.log('  Strategy: Call a view function to check status');
    console.log('  Note: View functions do NOT trigger _syncStatus()');
    console.log('  We need to make an actual transaction that calls _syncStatus()\n');

    console.log('  ⚠️  The status will sync during the finalizeSuccess() call itself.');
    console.log(
      '  This is by design - _syncStatus() is called at the start of finalizeSuccess().\n'
    );
  } else if (statusBefore === 2) {
    console.log('✅ Step 2: Status is already ENDED, no sync needed\n');
  } else {
    console.log('❌ Step 2: Time has not passed yet, cannot finalize\n');
    console.log(`  Current: ${blockTime}`);
    console.log(`  End Time: ${endTime}`);
    console.log(`  Remaining: ${Number(endTime) - blockTime} seconds\n`);
    return;
  }

  // ============================================
  // STEP 3: Verify requirements
  // ============================================
  console.log('📋 Step 3: Verifying requirements...');

  // Check admin role
  const ADMIN_ROLE = await round.ADMIN_ROLE();
  const hasAdminRole = await round.hasRole(ADMIN_ROLE, timelock.address);
  console.log(`  Admin Role: ${hasAdminRole ? '✅' : '❌'}`);

  // Check softcap
  const softCapMet = totalRaised >= softCap;
  console.log(`  Softcap Met: ${softCapMet ? '✅' : '❌'}`);

  // Check if already finalized
  const isFinalized = statusBefore === 3;
  console.log(`  Not Finalized: ${!isFinalized ? '✅' : '❌'}`);

  // Check FeeSplitter role
  const feeSplitter = await round.feeSplitter();
  const feeSplitterContract = await hre.ethers.getContractAt('FeeSplitter', feeSplitter);
  const PRESALE_ROLE = await feeSplitterContract.PRESALE_ROLE();
  const hasPresaleRole = await feeSplitterContract.hasRole(PRESALE_ROLE, roundAddr);
  console.log(`  FeeSplitter Role: ${hasPresaleRole ? '✅' : '❌'}`);

  // Check contract balance
  const contractBal = await hre.ethers.provider.getBalance(roundAddr);
  const balanceMatch = contractBal === totalRaised;
  console.log(
    `  Balance Correct: ${balanceMatch ? '✅' : '❌'} (${hre.ethers.formatEther(contractBal)} BNB)`
  );

  const canProceed = hasAdminRole && softCapMet && !isFinalized && hasPresaleRole && balanceMatch;
  console.log(`\n  Overall: ${canProceed ? '✅ READY' : '❌ NOT READY'}\n`);

  if (!canProceed) {
    console.log('❌ Cannot proceed - requirements not met\n');
    return;
  }

  // ============================================
  // STEP 4: Prepare finalization parameters
  // ============================================
  console.log('🔧 Step 4: Preparing finalization parameters...');

  // For testing: no vesting (merkle root = 0x0, totalAlloc = 0)
  const merkleRoot = '0x' + '0'.repeat(64);
  const totalAlloc = 0;

  console.log(`  Merkle Root: ${merkleRoot}`);
  console.log(`  Total Vesting Allocation: ${totalAlloc} tokens`);
  console.log(`  Note: Using zero allocation for testing (no vesting)\n`);

  // ============================================
  // STEP 5: Execute finalizeSuccess
  // ============================================
  console.log('🎯 Step 5: Executing finalizeSuccess...');
  console.log('  This will:');
  console.log('  1. Call _syncStatus() to update status to ENDED');
  console.log('  2. Verify softcap is met');
  console.log('  3. Calculate and distribute fees');
  console.log('  4. Transfer net amount to project owner');
  console.log('  5. Set status to FINALIZED_SUCCESS\n');

  try {
    // Estimate gas first
    console.log('  📊 Estimating gas...');
    const gasEstimate = await round
      .connect(timelock)
      .finalizeSuccess.estimateGas(merkleRoot, totalAlloc);
    console.log(`  Gas Estimate: ${gasEstimate.toString()}\n`);

    // Execute transaction
    console.log('  📤 Sending transaction...');
    const tx = await round.connect(timelock).finalizeSuccess(merkleRoot, totalAlloc, {
      gasLimit: (gasEstimate * 120n) / 100n, // 20% buffer
    });

    console.log(`  Transaction Hash: ${tx.hash}`);
    console.log('  ⏳ Waiting for confirmation...\n');

    const receipt = await tx.wait();
    console.log(`  ✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`  Gas Used: ${receipt.gasUsed.toString()}\n`);

    // ============================================
    // STEP 6: Verify final state
    // ============================================
    console.log('✅ Step 6: Verifying final state...');
    const statusAfter = await round.status();
    const tgeTimestamp = await round.tgeTimestamp();

    console.log(`  Status: ${Status[statusAfter]} (${statusAfter})`);
    console.log(`  TGE Timestamp: ${new Date(Number(tgeTimestamp) * 1000).toLocaleString()}`);
    console.log(
      `  Contract Balance: ${hre.ethers.formatEther(
        await hre.ethers.provider.getBalance(roundAddr)
      )} BNB`
    );

    // Parse events
    console.log('\n📜 Events emitted:');
    for (const log of receipt.logs) {
      try {
        const parsed = round.interface.parseLog({
          topics: log.topics,
          data: log.data,
        });
        if (parsed) {
          console.log(`  - ${parsed.name}:`);
          if (parsed.name === 'FinalizedSuccess') {
            console.log(`    Total Raised: ${hre.ethers.formatEther(parsed.args.totalRaised)} BNB`);
            console.log(`    Fee Amount: ${hre.ethers.formatEther(parsed.args.feeAmount)} BNB`);
            console.log(
              `    TGE: ${new Date(Number(parsed.args.tgeTimestamp) * 1000).toLocaleString()}`
            );
          } else if (parsed.name === 'StatusSynced') {
            console.log(`    Old Status: ${Status[parsed.args.oldStatus]}`);
            console.log(`    New Status: ${Status[parsed.args.newStatus]}`);
          }
        }
      } catch (e) {
        // Skip logs from other contracts
      }
    }

    console.log('\n✅ FINALIZATION SUCCESSFUL!\n');
  } catch (error) {
    console.log('\n❌ FINALIZATION FAILED\n');
    console.log(`Error: ${error.message}\n`);

    if (error.data) {
      console.log(`Error Data: ${error.data}`);

      // Try to decode error
      try {
        const iface = round.interface;
        const decoded = iface.parseError(error.data);
        if (decoded) {
          console.log(`Decoded Error: ${decoded.name}(${decoded.args.join(', ')})\n`);
        }
      } catch (e) {
        console.log(`Could not decode error\n`);
      }
    }

    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
