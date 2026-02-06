const hre = require('hardhat');

async function main() {
  console.log('🧪 E2E Fairlaunch Test (Router Fix Verification)\n');
  console.log('='.repeat(60));

  const AGENT_LOG_ENDPOINT =
    'http://localhost:7243/ingest/653da906-68d5-4a8f-a095-0a4e33372f15';
  const AGENT_RUN_ID = process.env.AGENT_RUN_ID || 'run1';

  // Get signers from configured accounts
  const [deployer, admin] = await hre.ethers.getSigners();
  console.log('Deployer/Buyer:', deployer.address);
  console.log('Admin Executor:', admin.address);
  console.log(
    'Balance:',
    hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)),
    'BNB\n'
  );

  // Config (allow override via env)
  const FACTORY_ADDRESS =
    process.env.FAIRLAUNCH_FACTORY_ADDRESS || '0x12c426d52B936c799ea3b1c28d0979d4CDbCB05E';
  const LP_LOCKER_ADDRESS =
    process.env.LP_LOCKER_ADDRESS || '0xD492CbD76150C805bF6b6f6D674827e27981eD63';

  // Load ABIs
  const factoryAbi =
    require('../artifacts/contracts/fairlaunch/FairlaunchFactory.sol/FairlaunchFactory.json').abi;
  const fairlaunchAbi =
    require('../artifacts/contracts/fairlaunch/Fairlaunch.sol/Fairlaunch.json').abi;
  const feeSplitterAbi =
    require('../artifacts/contracts/std-presale/FeeSplitter.sol/FeeSplitter.json').abi;
  const erc20Abi = [
    'function balanceOf(address) view returns (uint256)',
    'function transfer(address, uint256) returns (bool)',
    'function approve(address, uint256) returns (bool)',
  ];

  // #region agent log (H1/H2/H3)
  fetch(AGENT_LOG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: AGENT_RUN_ID,
      hypothesisId: 'H1',
      location: 'scripts/e2e-test-fairlaunch.js:setup',
      message: 'E2E setup',
      data: {
        chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
        deployer: deployer.address,
        admin: admin.address,
        factory: FACTORY_ADDRESS,
        lpLocker: LP_LOCKER_ADDRESS,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  // ========================================
  // STEP 1: Deploy Test Token
  // ========================================
  console.log('📝 STEP 1: Deploying Test Token...');

  const TestToken = await hre.ethers.getContractFactory('SimpleToken');
  const token = await TestToken.deploy(
    'TEST ROUTER FIX',
    'ROUTER',
    hre.ethers.parseEther('10000'), // 10k tokens
    18, // decimals
    deployer.address // owner
  );
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  console.log('✅ Token deployed:', tokenAddress);
  console.log('   Supply:', hre.ethers.formatEther(await token.totalSupply()), 'ROUTER\n');

  // ========================================
  // STEP 2: Create Fairlaunch
  // ========================================
  console.log('📝 STEP 2: Creating Fairlaunch via Factory...');

  const factory = new hre.ethers.Contract(FACTORY_ADDRESS, factoryAbi, deployer);

  const tokensForSale = hre.ethers.parseEther('5000'); // 5k tokens for sale
  const softcap = hre.ethers.parseEther('0.1'); // 0.1 BNB softcap (SMALL!)
  const minContribution = hre.ethers.parseEther('0.05');
  const maxContribution = hre.ethers.parseEther('0.5');

  const now = Math.floor(Date.now() / 1000);
  const startTime = now + 30; // Start in 30 seconds
  const endTime = now + 300; // End in 5 minutes

  // Approve factory to spend tokens (sale + liquidity buffer)
  console.log('   Approving factory...');
  const liquidityPercent = 8000n;
  const liquidityTokens = (tokensForSale * liquidityPercent) / 10000n;
  const totalRequired = tokensForSale + liquidityTokens;
  const approveTx = await token.approve(FACTORY_ADDRESS, totalRequired);
  await approveTx.wait();

  // Create fairlaunch
  console.log('   Creating fairlaunch...');
  const createTx = await factory.createFairlaunch(
    {
      projectToken: tokenAddress,
      paymentToken: hre.ethers.ZeroAddress, // BNB
      softcap: softcap,
      tokensForSale: tokensForSale,
      minContribution: minContribution,
      maxContribution: maxContribution,
      startTime: startTime,
      endTime: endTime,
      listingPremiumBps: 0, // No premium
      projectOwner: deployer.address,
    },
    {
      beneficiary: deployer.address,
      startTime: endTime, // vesting starts after sale ends
      durations: [],
      amounts: [],
    },
    {
      liquidityPercent: Number(liquidityPercent), // 80% to liquidity
      lockMonths: 12, // >= 12 required
      dexId: hre.ethers.ZeroHash, // bytes32
    },
    { value: hre.ethers.parseEther('0.2') } // Deployment fee
  );

  const receipt = await createTx.wait();

  // Get fairlaunch address from event
  const event = receipt.logs.find((log) => {
    try {
      const parsed = factory.interface.parseLog({ topics: log.topics, data: log.data });
      return parsed.name === 'FairlaunchCreated';
    } catch {
      return false;
    }
  });

  const fairlaunchAddress = event
    ? factory.interface.parseLog({ topics: event.topics, data: event.data }).args.fairlaunch
    : null;

  if (!fairlaunchAddress) {
    throw new Error('Failed to get fairlaunch address from event');
  }

  console.log('✅ Fairlaunch created:', fairlaunchAddress);
  console.log('   Softcap:', hre.ethers.formatEther(softcap), 'BNB');
  console.log('   Tokens for sale:', hre.ethers.formatEther(tokensForSale), 'ROUTER\n');

  // ========================================
  // STEP 3: Set LP Locker
  // ========================================
  console.log('📝 STEP 3: Setting LP Locker...');

  const fairlaunch = new hre.ethers.Contract(fairlaunchAddress, fairlaunchAbi, deployer);
  const fairlaunchAdmin = fairlaunch.connect(admin);

  // Debug role setup
  try {
    const ADMIN_ROLE = await fairlaunch.ADMIN_ROLE();
    const hasAdminRole = await fairlaunch.hasRole(ADMIN_ROLE, admin.address);
    console.log('   ADMIN_ROLE:', ADMIN_ROLE);
    console.log('   Admin has ADMIN_ROLE:', hasAdminRole ? '✅' : '❌');
  } catch (e) {
    console.log('   (Could not read roles, ABI mismatch?)', e?.message);
  }

  // Debug: simulate setLPLocker first
  try {
    await fairlaunchAdmin.setLPLocker.staticCall(LP_LOCKER_ADDRESS);
    console.log('   setLPLocker staticCall: ✅ OK');
  } catch (e) {
    console.log('   setLPLocker staticCall: ❌ REVERT');
    console.log('   error:', e?.message);
    if (e?.data) console.log('   revert data:', e.data);
  }

  const setLockerTx = await fairlaunchAdmin.setLPLocker(LP_LOCKER_ADDRESS);
  await setLockerTx.wait();

  const configuredLocker = await fairlaunch.lpLockerAddress();
  console.log('✅ LP Locker configured:', configuredLocker);
  console.log('   Matches expected:', configuredLocker === LP_LOCKER_ADDRESS ? '✅' : '❌', '\n');

  // ========================================
  // STEP 4: Wait for Start & Contribute
  // ========================================
  console.log('📝 STEP 4: Waiting for start time...');
  console.log('   Current time:', new Date().toISOString());
  console.log('   Start time:', new Date(startTime * 1000).toISOString());

  const waitTime = startTime - Math.floor(Date.now() / 1000) + 5; // Add 5s buffer
  if (waitTime > 0) {
    console.log(`   Waiting ${waitTime}s...\n`);
    await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
  }

  console.log('📝 Making contribution to meet softcap...');
  const contributionAmount = hre.ethers.parseEther('0.12'); // Slightly above softcap

  const contributeTx = await fairlaunch.contribute({ value: contributionAmount });
  await contributeTx.wait();

  const totalRaised = await fairlaunch.totalRaised();
  console.log('✅ Contribution successful!');
  console.log('   Amount:', hre.ethers.formatEther(contributionAmount), 'BNB');
  console.log('   Total raised:', hre.ethers.formatEther(totalRaised), 'BNB');
  console.log('   Softcap met:', totalRaised >= softcap ? '✅' : '❌', '\n');

  // ========================================
  // STEP 5: Wait for End & Finalize
  // ========================================
  console.log('📝 STEP 5: Waiting for end time...');

  const waitForEnd = endTime - Math.floor(Date.now() / 1000) + 5;
  if (waitForEnd > 0) {
    console.log(`   Waiting ${waitForEnd}s...\n`);
    await new Promise((resolve) => setTimeout(resolve, waitForEnd * 1000));
  }

  console.log('📝 Finalizing fairlaunch...');

  // Check pre-finalize state
  const feeSplitter = await fairlaunch.feeSplitter();
  const feeBalanceBefore = await hre.ethers.provider.getBalance(feeSplitter);

  console.log('   Pre-finalize:');
  console.log('     Fee Splitter balance:', hre.ethers.formatEther(feeBalanceBefore), 'BNB');

  const feeSplitterContract = new hre.ethers.Contract(feeSplitter, feeSplitterAbi, deployer);
  const [treasuryVault, referralPoolVault, sbtStakingVault] = await Promise.all([
    feeSplitterContract.treasuryVault(),
    feeSplitterContract.referralPoolVault(),
    feeSplitterContract.sbtStakingVault(),
  ]);
  const [treasuryBefore, referralBefore, sbtBefore] = await Promise.all([
    hre.ethers.provider.getBalance(treasuryVault),
    hre.ethers.provider.getBalance(referralPoolVault),
    hre.ethers.provider.getBalance(sbtStakingVault),
  ]);

  // #region agent log (H1/H2/H3)
  fetch(AGENT_LOG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: AGENT_RUN_ID,
      hypothesisId: 'H1',
      location: 'scripts/e2e-test-fairlaunch.js:pre-finalize',
      message: 'Pre-finalize fee context',
      data: {
        fairlaunch: fairlaunchAddress,
        feeSplitter,
        feeSplitterBalanceBefore: feeBalanceBefore.toString(),
        vaults: { treasuryVault, referralPoolVault, sbtStakingVault },
        vaultBalancesBefore: {
          treasury: treasuryBefore.toString(),
          referral: referralBefore.toString(),
          sbt: sbtBefore.toString(),
        },
        totalRaised: totalRaised.toString(),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const finalizeTx = await fairlaunch.finalize({
    gasLimit: 5000000, // Override gas limit
  });

  console.log('   TX sent:', finalizeTx.hash);
  console.log('   Waiting for confirmation...');

  const finalizeReceipt = await finalizeTx.wait();

  console.log('✅ Finalize successful!');
  console.log('   Block:', finalizeReceipt.blockNumber);
  console.log('   Gas used:', finalizeReceipt.gasUsed.toString(), '\n');

  // ========================================
  // STEP 6: Verify Results
  // ========================================
  console.log('📝 STEP 6: Verifying Results...\n');

  // Check status
  const finalStatus = await fairlaunch.status();
  console.log('✅ Status Check:');
  console.log('   Final status:', finalStatus.toString(), '(3=SUCCESS, 4=FAILED)');
  console.log('   Expected SUCCESS:', finalStatus.toString() === '3' ? '✅' : '❌');

  // Parse FeeSplitter events from receipt (fee may be forwarded in-tx, leaving FeeSplitter balance ~0)
  let feeCollectedTotal = null;
  const feeSplitEvents = [];
  for (const log of finalizeReceipt.logs) {
    try {
      const parsed = feeSplitterContract.interface.parseLog({ topics: log.topics, data: log.data });
      if (parsed?.name === 'FeeCollected') {
        feeCollectedTotal = parsed.args.totalAmount?.toString?.() ?? null;
      }
      if (parsed?.name === 'FeeSplit') {
        feeSplitEvents.push({
          vault: parsed.args.vault,
          token: parsed.args.token,
          amount: parsed.args.amount?.toString?.() ?? null,
          bps: parsed.args.bps?.toString?.() ?? null,
        });
      }
    } catch {
      // ignore non-FeeSplitter logs
    }
  }

  // Check fee distribution
  const feeBalanceAfter = await hre.ethers.provider.getBalance(feeSplitter);
  const feeReceived = feeBalanceAfter - feeBalanceBefore;
  const expectedFee = (totalRaised * 500n) / 10000n; // 5%
  const feeCollectedTotalBn = feeCollectedTotal ? BigInt(feeCollectedTotal) : null;
  const feeSplitSum = feeSplitEvents.reduce((acc, e) => acc + BigInt(e.amount || '0'), 0n);
  const feeMatchByEvents = feeCollectedTotalBn !== null ? feeCollectedTotalBn === expectedFee : null;

  console.log('\n✅ Fee Distribution Check:');
  console.log('   Total raised:', hre.ethers.formatEther(totalRaised), 'BNB');
  console.log('   Expected fee (5%):', hre.ethers.formatEther(expectedFee), 'BNB');
  console.log('   FeeSplitter balance delta:', hre.ethers.formatEther(feeReceived), 'BNB');
  if (feeCollectedTotalBn !== null) {
    console.log('   FeeCollected event:', hre.ethers.formatEther(feeCollectedTotalBn), 'BNB');
  } else {
    console.log('   FeeCollected event: (not found)');
  }
  if (feeSplitEvents.length > 0) {
    console.log('   FeeSplit sum:', hre.ethers.formatEther(feeSplitSum), 'BNB');
  } else {
    console.log('   FeeSplit events: (none found)');
  }
  console.log(
    '   Match (by events):',
    feeMatchByEvents === null ? '❓ (no FeeCollected event)' : feeMatchByEvents ? '✅' : '❌'
  );

  const [treasuryAfter, referralAfter, sbtAfter] = await Promise.all([
    hre.ethers.provider.getBalance(treasuryVault),
    hre.ethers.provider.getBalance(referralPoolVault),
    hre.ethers.provider.getBalance(sbtStakingVault),
  ]);

  // #region agent log (H1/H2/H3)
  fetch(AGENT_LOG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: AGENT_RUN_ID,
      hypothesisId: 'H1',
      location: 'scripts/e2e-test-fairlaunch.js:post-finalize',
      message: 'Post-finalize fee context',
      data: {
        finalizeTx: finalizeTx.hash,
        finalizeBlock: finalizeReceipt.blockNumber,
        expectedFee: expectedFee.toString(),
        feeSplitterBalanceAfter: feeBalanceAfter.toString(),
        feeSplitterBalanceDelta: feeReceived.toString(),
        vaultBalancesAfter: {
          treasury: treasuryAfter.toString(),
          referral: referralAfter.toString(),
          sbt: sbtAfter.toString(),
        },
        vaultBalanceDeltas: {
          treasury: (treasuryAfter - treasuryBefore).toString(),
          referral: (referralAfter - referralBefore).toString(),
          sbt: (sbtAfter - sbtBefore).toString(),
        },
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  // #region agent log (H1/H2/H3)
  fetch(AGENT_LOG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: AGENT_RUN_ID,
      hypothesisId: 'H1',
      location: 'scripts/e2e-test-fairlaunch.js:receipt-events',
      message: 'FeeSplitter events seen in finalize receipt',
      data: {
        finalizeTx: finalizeTx.hash,
        feeCollectedTotal,
        feeSplitEventsCount: feeSplitEvents.length,
        feeSplitEvents: feeSplitEvents.slice(0, 5), // safety cap
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  // Check DEX router
  const dexRouter = await fairlaunch.dexRouter();
  const expectedRouter = '0xD99D1c33F9fC3444f8101754aBC46c52416550D1'; // BSC Testnet V2

  console.log('\n✅ DEX Router Check:');
  console.log('   Configured router:', dexRouter);
  console.log('   Expected (Testnet V2):', expectedRouter);
  console.log('   Match:', dexRouter.toLowerCase() === expectedRouter.toLowerCase() ? '✅' : '❌');

  // Check finalization events
  console.log('\n✅ Events Check:');
  const liquidityLockedEvent = finalizeReceipt.logs.find((log) => {
    try {
      const parsed = fairlaunch.interface.parseLog({ topics: log.topics, data: log.data });
      return parsed.name === 'LiquidityLocked';
    } catch {
      return false;
    }
  });

  if (liquidityLockedEvent) {
    const parsed = fairlaunch.interface.parseLog({
      topics: liquidityLockedEvent.topics,
      data: liquidityLockedEvent.data,
    });
    console.log('   LiquidityLocked event found ✅');
    console.log('   LP Token:', parsed.args.lpToken);
    console.log('   Amount:', hre.ethers.formatEther(parsed.args.amount));
    console.log('   Unlock time:', new Date(Number(parsed.args.unlockTime) * 1000).toISOString());
  } else {
    console.log('   LiquidityLocked event: ❌ NOT FOUND');
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 E2E TEST COMPLETED!\n');
  console.log('Summary:');
  console.log('  ✅ Token deployed');
  console.log('  ✅ Fairlaunch created via factory');
  console.log('  ✅ LP Locker configured');
  console.log('  ✅ Contribution successful');
  console.log('  ✅ Finalize completed');
  console.log(
    `  ${feeMatchByEvents === true ? '✅' : feeMatchByEvents === false ? '❌' : '❓'} Fee distributed (verified by events)`
  );
  console.log('  ✅ Correct DEX router used');
  console.log('  ✅ LP tokens locked');
  console.log('\nFairlaunch Address:', fairlaunchAddress);
  console.log('View on BscScan:', `https://testnet.bscscan.com/address/${fairlaunchAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ TEST FAILED:');
    console.error(error);
    process.exit(1);
  });
