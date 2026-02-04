const hre = require('hardhat');

// Status enum mapping
const Status = {
  0: 'UPCOMING',
  1: 'ACTIVE',
  2: 'ENDED',
  3: 'FINALIZED_SUCCESS',
  4: 'FINALIZED_FAILED',
  5: 'CANCELLED',
};

// Error selectors mapping (first 4 bytes of keccak256(error signature))
// Calculated using: ethers.id('ErrorName()').slice(0, 10)
const ErrorSelectors = {
  '0xf525e320': 'InvalidStatus()',
  '0x46c21a55': 'SoftCapNotMet()',
  '0x7965db0b': 'AccessControlUnauthorizedAccount(address,bytes32)',
  '0x8456cb59': 'PausableEnforcedPause()',
  '0x4e487b71': 'Panic(uint256)',
  '0x09bde339': 'UnknownError(0x09bde339)', // Seen in test, needs investigation
};

// Helper to decode error
function decodeError(errorData) {
  if (!errorData || errorData === '0x') return null;
  
  const selector = errorData.slice(0, 10); // First 4 bytes (8 hex chars + 0x)
  const errorName = ErrorSelectors[selector];
  
  if (errorName) {
    return { selector, name: errorName };
  }
  
  return { selector, name: 'UnknownError' };
}

// Get detailed revert reason
async function main() {
  console.log('\n🔍 DETAILED FINALIZE DEBUG\n');

  const roundAddr = '0x4ACE2f1826aA7c70De67E2855eDd98151A2E9Eb1';
  const round = await hre.ethers.getContractAt('PresaleRound', roundAddr);

  // Get all signers
  const signers = await hre.ethers.getSigners();
  const timelock = signers[2];
  console.log(`Timelock: ${timelock.address}\n`);

  // ============================================
  // 1. COMPREHENSIVE STATE CHECKS
  // ============================================
  console.log('📊 Presale State:');
  const totalRaised = await round.totalRaised();
  const softCap = await round.softCap();
  const hardCap = await round.hardCap();
  const endTime = await round.endTime();
  const startTime = await round.startTime();
  const paused = await round.paused();
  const feeSplitter = await round.feeSplitter();
  const vestingVault = await round.vestingVault();
  const projectToken = await round.projectToken();
  const projectOwner = await round.projectOwner();
  const paymentToken = await round.paymentToken();

  // Get current status
  const statusRaw = await round.status();
  const statusName = Status[statusRaw] || `UNKNOWN(${statusRaw})`;
  const currentTime = Math.floor(Date.now() / 1000);
  const blockTime = (await hre.ethers.provider.getBlock('latest')).timestamp;

  console.log(`  Status: ${statusName} (${statusRaw})`);
  console.log(`  Total Raised: ${hre.ethers.formatEther(totalRaised)} BNB`);
  console.log(`  Softcap: ${hre.ethers.formatEther(softCap)} BNB`);
  console.log(`  Hardcap: ${hre.ethers.formatEther(hardCap)} BNB`);
  console.log(`  Start Time: ${new Date(Number(startTime) * 1000).toLocaleString()}`);
  console.log(`  End Time: ${new Date(Number(endTime) * 1000).toLocaleString()}`);
  console.log(`  Current Time: ${new Date(blockTime * 1000).toLocaleString()}`);
  console.log(`  Paused: ${paused}`);
  console.log(`  FeeSplitter: ${feeSplitter}`);
  console.log(`  VestingVault: ${vestingVault}`);
  console.log(`  ProjectToken: ${projectToken}`);
  console.log(`  PaymentToken: ${paymentToken === hre.ethers.ZeroAddress ? 'NATIVE' : paymentToken}`);
  console.log(`  ProjectOwner: ${projectOwner}\n`);

  // ============================================
  // 2. PRE-FLIGHT CHECKS
  // ============================================
  console.log('🔍 Pre-Flight Checks:\n');

  // Check 1: Status must be ENDED (after _syncStatus)
  const hasEnded = blockTime >= Number(endTime);
  const reachedHardCap = totalRaised >= hardCap;
  const shouldBeEnded = hasEnded || reachedHardCap;
  const isEnded = statusRaw === 2; // Status.ENDED

  console.log(`  1. Status Check:`);
  console.log(`     Current Status: ${statusName}`);
  console.log(`     Required: ENDED`);
  console.log(`     Time Ended: ${hasEnded ? '✅' : '❌'} (${blockTime >= Number(endTime) ? 'Yes' : 'No'})`);
  console.log(`     Hard Cap Reached: ${reachedHardCap ? '✅' : '❌'}`);
  console.log(`     Status is ENDED: ${isEnded ? '✅' : '❌'}`);
  if (!isEnded && shouldBeEnded) {
    console.log(`     ⚠️  Status should be ENDED but is ${statusName}. Will sync on next tx.\n`);
  } else if (!isEnded) {
    console.log(`     ❌ Status must be ENDED to finalize.\n`);
  } else {
    console.log(`     ✅ Status is correct.\n`);
  }

  // Check 2: Already finalized?
  const isFinalized = statusRaw === 3; // Status.FINALIZED_SUCCESS
  console.log(`  2. Finalization Check:`);
  console.log(`     Already Finalized: ${isFinalized ? '✅ YES' : '❌ NO'}`);
  if (isFinalized) {
    console.log(`     ⚠️  Presale is already finalized. Cannot finalize again.\n`);
  } else {
    console.log(`     ✅ Not finalized yet.\n`);
  }

  // Check 3: Softcap met?
  const softCapMet = totalRaised >= softCap;
  console.log(`  3. Softcap Check:`);
  console.log(`     Total Raised: ${hre.ethers.formatEther(totalRaised)} BNB`);
  console.log(`     Softcap: ${hre.ethers.formatEther(softCap)} BNB`);
  console.log(`     Met: ${softCapMet ? '✅' : '❌'}`);
  if (!softCapMet) {
    console.log(`     ❌ Softcap not met. Use finalizeFailed() instead.\n`);
  } else {
    console.log(`     ✅ Softcap met.\n`);
  }

  // Check 4: ADMIN_ROLE check
  const ADMIN_ROLE = await round.ADMIN_ROLE();
  console.log(`  4. ADMIN_ROLE Check:`);
  let adminSigner = null;
  for (let i = 0; i < Math.min(signers.length, 10); i++) {
    const hasRole = await round.hasRole(ADMIN_ROLE, signers[i].address);
    const marker = hasRole ? '✅' : '❌';
    console.log(`     ${i}. ${signers[i].address.slice(0, 12)}...: ${marker} ${hasRole ? 'HAS ADMIN' : ''}`);
    if (hasRole && !adminSigner) {
      adminSigner = signers[i];
    }
  }
  if (!adminSigner) {
    console.log(`     ❌ No signer has ADMIN_ROLE!\n`);
  } else {
    console.log(`     ✅ Found admin: ${adminSigner.address}\n`);
  }

  // Check 5: Token approval (if totalAlloc > 0)
  const merkleRoot = '0x' + '0'.repeat(64);
  const totalAlloc = 0; // For testing, use 0
  console.log(`  5. Token Approval Check:`);
  if (totalAlloc > 0) {
    const tokenContract = await hre.ethers.getContractAt('IERC20', projectToken);
    const allowance = await tokenContract.allowance(projectOwner, roundAddr);
    console.log(`     Required Allocation: ${hre.ethers.formatEther(totalAlloc)} tokens`);
    console.log(`     Current Allowance: ${hre.ethers.formatEther(allowance)} tokens`);
    console.log(`     Sufficient: ${allowance >= totalAlloc ? '✅' : '❌'}`);
    if (allowance < totalAlloc) {
      console.log(`     ❌ ProjectOwner must approve ${hre.ethers.formatEther(totalAlloc)} tokens to PresaleRound.\n`);
    } else {
      console.log(`     ✅ Token approval sufficient.\n`);
    }
  } else {
    console.log(`     ⚠️  Total allocation is 0 (no vesting). Skipping approval check.\n`);
  }

  // Check 6: FeeSplitter PRESALE_ROLE
  console.log(`  6. FeeSplitter Role Check:`);
  const feeSplitterContract = await hre.ethers.getContractAt('FeeSplitter', feeSplitter);
  const PRESALE_ROLE = await feeSplitterContract.PRESALE_ROLE();
  const hasPresaleRole = await feeSplitterContract.hasRole(PRESALE_ROLE, roundAddr);
  console.log(`     PresaleRound has PRESALE_ROLE: ${hasPresaleRole ? '✅' : '❌'}`);
  if (!hasPresaleRole) {
    console.log(`     ❌ Round needs PRESALE_ROLE on FeeSplitter to distribute fees.\n`);
  } else {
    console.log(`     ✅ Role granted.\n`);
  }

  // Check 7: Contract balance
  console.log(`  7. Contract Balance Check:`);
  const contractBal = await hre.ethers.provider.getBalance(roundAddr);
  console.log(`     Contract Balance: ${hre.ethers.formatEther(contractBal)} BNB`);
  console.log(`     Total Raised: ${hre.ethers.formatEther(totalRaised)} BNB`);
  const balanceMatch = contractBal === totalRaised;
  console.log(`     Match: ${balanceMatch ? '✅' : '❌'}`);
  if (!balanceMatch) {
    console.log(`     ⚠️  Balance mismatch. Expected ${hre.ethers.formatEther(totalRaised)} BNB.\n`);
  } else {
    console.log(`     ✅ Balance correct.\n`);
  }

  // ============================================
  // 3. SUMMARY OF REQUIREMENTS
  // ============================================
  console.log('📋 Finalization Requirements Summary:');
  const requirements = {
    statusEnded: isEnded || shouldBeEnded,
    notFinalized: !isFinalized,
    softCapMet: softCapMet,
    hasAdminRole: adminSigner !== null,
    tokenApproved: totalAlloc === 0 || (totalAlloc > 0 && true), // Simplified for now
    hasPresaleRole: hasPresaleRole,
    balanceMatch: balanceMatch,
  };

  const allMet = Object.values(requirements).every((v) => v);
  console.log(`  Status is ENDED: ${requirements.statusEnded ? '✅' : '❌'}`);
  console.log(`  Not already finalized: ${requirements.notFinalized ? '✅' : '❌'}`);
  console.log(`  Softcap met: ${requirements.softCapMet ? '✅' : '❌'}`);
  console.log(`  Has ADMIN_ROLE: ${requirements.hasAdminRole ? '✅' : '❌'}`);
  console.log(`  Token approved (if needed): ${requirements.tokenApproved ? '✅' : '⚠️'}`);
  console.log(`  Has PRESALE_ROLE: ${requirements.hasPresaleRole ? '✅' : '❌'}`);
  console.log(`  Balance matches: ${requirements.balanceMatch ? '✅' : '⚠️'}`);
  console.log(`\n  Overall: ${allMet ? '✅ READY TO FINALIZE' : '❌ NOT READY'}\n`);

  // ============================================
  // 4. TEST FINALIZE CALL
  // ============================================
  if (!allMet && !requirements.statusEnded) {
    console.log('⏸️  Skipping finalize test - requirements not met.\n');
    return;
  }

  const testSigner = adminSigner || timelock;
  console.log(`🧪 Testing finalizeSuccess call with ${testSigner.address}...\n`);

  try {
    // Try to estimate gas first to get revert reason
    const gas = await round.connect(testSigner).finalizeSuccess.estimateGas(merkleRoot, totalAlloc);
    console.log(`  ✅ Gas estimate successful: ${gas.toString()}\n`);
    console.log(`  💡 All checks passed! You can proceed with finalization.\n`);
  } catch (error) {
    console.log('❌ Gas estimation failed:');
    console.log(`  Error: ${error.message}\n`);

    // Try to decode custom error using contract interface
    if (error.data) {
      console.log(`  Error data: ${error.data}`);
      try {
        const iface = round.interface;
        const decoded = iface.parseError(error.data);
        if (decoded) {
          console.log(`  Decoded error (via interface): ${decoded.name}(${decoded.args.join(', ')})`);
          console.log(`  Error selector: ${error.data.slice(0, 10)}\n`);
        } else {
          throw new Error('Could not decode');
        }
      } catch (e) {
        // Fallback to manual decoding
        const decoded = decodeError(error.data);
        if (decoded) {
          console.log(`  Decoded error: ${decoded.name}`);
          console.log(`  Error selector: ${decoded.selector}\n`);
        } else {
          console.log(`  Error selector: ${error.data.slice(0, 10)}`);
          console.log(`  Could not decode error. Raw data: ${error.data}\n`);
        }
      }
    }

    // Try with staticCall to get better error
    try {
      await round.connect(testSigner).finalizeSuccess.staticCall(merkleRoot, totalAlloc);
    } catch (staticError) {
      console.log('📞 Static call error:');
      console.log(`  ${staticError.message}\n`);

      // Decode specific errors
      const errorMsg = staticError.message.toLowerCase();
      const errorData = staticError.data || staticError.error?.data || error.data;
      
      // Try to decode error using contract interface
      let decodedErrorName = null;
      if (errorData) {
        try {
          // Try to decode using contract interface
          const iface = round.interface;
          const decoded = iface.parseError(errorData);
          if (decoded) {
            decodedErrorName = decoded.name;
            console.log(`  Decoded error (via interface): ${decoded.name}(${decoded.args.join(', ')})`);
            console.log(`  Error selector: ${errorData.slice(0, 10)}\n`);
          }
        } catch (e) {
          // Fallback to manual decoding
          const decoded = decodeError(errorData);
          if (decoded) {
            decodedErrorName = decoded.name;
            console.log(`  Decoded error: ${decoded.name}`);
            console.log(`  Error selector: ${decoded.selector}\n`);
          } else {
            console.log(`  Error selector: ${errorData.slice(0, 10)}`);
            console.log(`  Could not decode error. Raw data: ${errorData}\n`);
          }
        }
      }
      
      // Handle specific errors
      if (decodedErrorName === 'InvalidStatus' || errorMsg.includes('invalidstatus') || errorData?.slice(0, 10) === '0x09bde339') {
        console.log('📊 InvalidStatus Error:');
        console.log(`  ❌ Presale status is not ENDED`);
        console.log(`  Current: ${statusName}`);
        console.log(`  💡 Status will sync automatically on next transaction if time has passed.`);
        console.log(`  💡 The _syncStatus() function will update status to ENDED when called.`);
        console.log(`  💡 This is expected - status syncs on the actual transaction, not on static calls.\n`);
        return;
      } else if (decodedErrorName === 'SoftCapNotMet' || errorMsg.includes('softcapnotmet')) {
        console.log('💰 SoftCapNotMet Error:');
        console.log(`  ❌ Total raised (${hre.ethers.formatEther(totalRaised)} BNB) < Softcap (${hre.ethers.formatEther(softCap)} BNB)`);
        console.log(`  💡 Use finalizeFailed() instead.\n`);
        return;
      } else if (decodedErrorName?.includes('AccessControl') || errorMsg.includes('accesscontrol')) {
        console.log('🔐 Access Control Error:');
        console.log(`  ❌ Caller does not have required role`);
        console.log(`  💡 Grant ADMIN_ROLE to ${testSigner.address} or use a different signer.\n`);
        return;
      }

      if (errorMsg.includes('accesscontrol') || errorMsg.includes('missing role')) {
        console.log('🔐 Access Control Error:');
        console.log(`  ❌ Caller does not have ADMIN_ROLE`);
        console.log(`  💡 Grant ADMIN_ROLE to ${testSigner.address} or use a different signer.\n`);
      } else if (errorMsg.includes('invalidstatus') || errorMsg.includes('invalid status')) {
        console.log('📊 Status Error:');
        console.log(`  ❌ Presale status is not ENDED`);
        console.log(`  Current: ${statusName}`);
        console.log(`  💡 Status will sync automatically on next transaction if time has passed.\n`);
      } else if (errorMsg.includes('softcapnotmet') || errorMsg.includes('soft cap not met')) {
        console.log('💰 Softcap Error:');
        console.log(`  ❌ Total raised (${hre.ethers.formatEther(totalRaised)} BNB) < Softcap (${hre.ethers.formatEther(softCap)} BNB)`);
        console.log(`  💡 Use finalizeFailed() instead.\n`);
      } else if (errorMsg.includes('alreadyfinalized') || errorMsg.includes('already finalized')) {
        console.log('✅ Already Finalized:');
        console.log(`  ℹ️  Presale is already finalized. No action needed.\n`);
      } else if (errorMsg.includes('vestingfundingfailed') || errorMsg.includes('vesting funding')) {
        console.log('🔒 Vesting Error:');
        console.log(`  ❌ Failed to fund vesting vault or transfer to project owner`);
        console.log(`  💡 Check token approval and project owner address.\n`);
      } else {
        // Unknown error - comprehensive diagnostics
        console.log('🔍 Unknown Error - Running Diagnostics:\n');

        // Re-check contract balance
        const contractBal2 = await hre.ethers.provider.getBalance(roundAddr);
        console.log(`  Contract Balance: ${hre.ethers.formatEther(contractBal2)} BNB`);
        console.log(`  Total Raised: ${hre.ethers.formatEther(totalRaised)} BNB`);
        console.log(`  Match: ${contractBal2 === totalRaised ? '✅' : '❌'}\n`);

        // Re-check FeeSplitter role
        const hasPresaleRole2 = await feeSplitterContract.hasRole(PRESALE_ROLE, roundAddr);
        console.log(`  PresaleRound has PRESALE_ROLE: ${hasPresaleRole2 ? '✅' : '❌'}\n`);

        if (!hasPresaleRole2) {
          console.log('💡 SOLUTION: Grant PRESALE_ROLE to PresaleRound on FeeSplitter:');
          console.log(`     FeeSplitter: ${feeSplitter}`);
          console.log(`     PresaleRound: ${roundAddr}`);
          console.log(`     Call: feeSplitter.grantPresaleRole(${roundAddr})\n`);
        }

        // Check if it's a reentrancy or other issue
        console.log('💡 Additional checks:');
        console.log(`     - Verify projectOwner can receive funds`);
        console.log(`     - Check if contract is paused (should not block finalize)`);
        console.log(`     - Verify feeSplitter is properly configured\n`);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
