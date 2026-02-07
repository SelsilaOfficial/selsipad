/**
 * E2E Finalization Test
 *
 * Full lifecycle: Deploy Token → Create Fairlaunch via Factory → Contribute →
 * Wait for end → Finalize (step-by-step) → Verify all steps.
 *
 * Uses VERY SHORT timings (start in 30s, end in 90s) so we can test quickly.
 */
const hre = require('hardhat');

// ─── addresses (BSC Testnet, just deployed) ───
const FACTORY = '0x5Fa2528164baF18cA6Cd859701d7a5a6ad197DEa';
const FEE_SPLITTER = '0x3301b82B4559F1607DA83FA460DC9820CbE1344e';
const LP_LOCKER = '0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F';
const DEX_ROUTER = '0xD99D1c33F9fC3444f8101754aBC46c52416550D1'; // PancakeSwap V2 Testnet

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const provider = deployer.provider;

  console.log('═══════════════════════════════════════════════════');
  console.log('  E2E FAIRLAUNCH FINALIZATION TEST');
  console.log('═══════════════════════════════════════════════════');
  console.log('Deployer:', deployer.address);
  console.log(
    'Balance:',
    hre.ethers.formatEther(await provider.getBalance(deployer.address)),
    'BNB\n'
  );

  // ──────────────────────────────────────────────
  // Step 1: Deploy a test ERC20 token
  // ──────────────────────────────────────────────
  console.log('━━━ STEP 1: Deploying test ERC20 token ━━━');
  const TestToken = await hre.ethers.getContractFactory('SimpleToken');

  // SimpleToken constructor: (name, symbol, totalSupply, decimals, owner)
  const totalSupply = hre.ethers.parseUnits('1000000', 18); // 1M tokens
  const token = await TestToken.deploy(
    'E2E Test Token',
    'E2ETEST',
    totalSupply,
    18,
    deployer.address
  );
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log('✅ Token deployed:', tokenAddr);
  console.log('   Supply:', hre.ethers.formatUnits(await token.balanceOf(deployer.address), 18));

  // ──────────────────────────────────────────────
  // Step 2: Create Fairlaunch via Factory
  // ──────────────────────────────────────────────
  console.log('\n━━━ STEP 2: Creating Fairlaunch via Factory ━━━');
  const factory = await hre.ethers.getContractAt('FairlaunchFactory', FACTORY);

  // Use SHORT timings for test
  const now = (await provider.getBlock('latest')).timestamp;
  const startTime = now + 30; // Start in 30 seconds
  const endTime = now + 120; // End in 2 minutes

  const softcap = hre.ethers.parseEther('0.01'); // 0.01 BNB softcap (very low)
  const tokensForSale = hre.ethers.parseUnits('100000', 18); // 100K tokens
  const minContribution = hre.ethers.parseEther('0.005');
  const maxContribution = hre.ethers.parseEther('1.0');
  const liquidityPercent = 7000; // 70%
  const lpLockMonths = 12;

  // Calculate total tokens needed: tokensForSale + liquidity tokens
  const liquidityTokens = (tokensForSale * BigInt(liquidityPercent)) / 10000n;
  const totalTokensNeeded = tokensForSale + liquidityTokens;
  console.log('Tokens for sale:', hre.ethers.formatUnits(tokensForSale, 18));
  console.log('Liquidity tokens:', hre.ethers.formatUnits(liquidityTokens, 18));
  console.log('Total needed:', hre.ethers.formatUnits(totalTokensNeeded, 18));

  // Approve factory to pull tokens
  console.log('Approving factory...');
  const approveTx = await token.approve(FACTORY, hre.ethers.MaxUint256);
  await approveTx.wait();
  console.log('✅ Factory approved');

  // CreateFairlaunchParams
  const createParams = {
    projectToken: tokenAddr,
    paymentToken: hre.ethers.ZeroAddress, // Native BNB
    softcap,
    tokensForSale,
    minContribution,
    maxContribution,
    startTime: BigInt(startTime),
    endTime: BigInt(endTime),
    projectOwner: deployer.address,
    listingPremiumBps: 0,
  };

  // TeamVestingParams (empty = no vesting)
  const vestingParams = {
    beneficiary: deployer.address,
    startTime: BigInt(endTime),
    durations: [],
    amounts: [],
  };

  // LPLockPlan
  const lpPlan = {
    lockMonths: BigInt(lpLockMonths),
    liquidityPercent: BigInt(liquidityPercent),
    dexId: hre.ethers.id('PancakeSwap'),
  };

  // Get deployment fee
  const deploymentFee = await factory.DEPLOYMENT_FEE();
  console.log('Deployment fee:', hre.ethers.formatEther(deploymentFee), 'BNB');

  // Deploy
  console.log('Creating Fairlaunch...');
  const createTx = await factory.createFairlaunch(createParams, vestingParams, lpPlan, {
    value: deploymentFee,
  });
  const createReceipt = await createTx.wait();

  // Extract addresses from event
  const iface = factory.interface;
  let fairlaunchAddr, vestingAddr;
  for (const log of createReceipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'FairlaunchCreated') {
        fairlaunchAddr = parsed.args.fairlaunch;
        vestingAddr = parsed.args.vesting;
        break;
      }
    } catch {}
  }

  if (!fairlaunchAddr) throw new Error('FairlaunchCreated event not found!');
  console.log('✅ Fairlaunch deployed:', fairlaunchAddr);
  console.log('   Vesting:', vestingAddr);

  // Verify key properties
  const fairlaunch = await hre.ethers.getContractAt(
    'contracts/fairlaunch/Fairlaunch.sol:Fairlaunch',
    fairlaunchAddr
  );

  console.log('\n━━━ Contract Configuration Checks ━━━');
  const feeS = await fairlaunch.feeSplitter();
  const router = await fairlaunch.dexRouter();
  const lpLock = await fairlaunch.lpLocker();

  console.log(
    '✅ FeeSplitter:',
    feeS,
    feeS.toLowerCase() === FEE_SPLITTER.toLowerCase() ? '✅ MATCH' : '❌ MISMATCH!'
  );
  console.log(
    '   DEX Router:',
    router,
    router.toLowerCase() === DEX_ROUTER.toLowerCase() ? '✅ MATCH' : '❌ MISMATCH!'
  );
  console.log('   LP Locker:', lpLock, '(not yet configured - will be set by admin)');

  // ──────────────────────────────────────────────
  // Step 2.5: Set LP Locker
  // ──────────────────────────────────────────────
  console.log('\n━━━ STEP 2.5: Setting LP Locker ━━━');
  const setLPTx = await fairlaunch.setLPLocker(LP_LOCKER);
  await setLPTx.wait();
  const lpLockerSet = await fairlaunch.lpLocker();
  console.log(
    '✅ LP Locker set:',
    lpLockerSet,
    lpLockerSet.toLowerCase() === LP_LOCKER.toLowerCase() ? '✅ MATCH' : '❌ MISMATCH!'
  );

  // ──────────────────────────────────────────────
  // Step 3: Wait for sale to start, then contribute
  // ──────────────────────────────────────────────
  console.log('\n━━━ STEP 3: Waiting for sale to begin... ━━━');
  let currentBlock = await provider.getBlock('latest');
  let waitSecs = startTime - currentBlock.timestamp + 5; // +5 margin
  if (waitSecs > 0) {
    console.log(`Waiting ${waitSecs}s for sale to start...`);
    await sleep(waitSecs * 1000);
  }

  // Contribute above softcap
  const contributeAmount = hre.ethers.parseEther('0.05'); // 0.05 BNB (5x softcap)
  console.log('Contributing', hre.ethers.formatEther(contributeAmount), 'BNB...');
  const contributeTx = await fairlaunch.contribute({ value: contributeAmount });
  await contributeTx.wait();

  const totalRaised = await fairlaunch.totalRaised();
  const softcapVal = await fairlaunch.softcap();
  console.log('✅ Contributed! Total raised:', hre.ethers.formatEther(totalRaised), 'BNB');
  console.log('   Softcap:', hre.ethers.formatEther(softcapVal), 'BNB');
  console.log('   Softcap met?', totalRaised >= softcapVal ? '✅ YES' : '❌ NO');

  // ──────────────────────────────────────────────
  // Step 4: Wait for sale to end
  // ──────────────────────────────────────────────
  console.log('\n━━━ STEP 4: Waiting for sale to end... ━━━');
  currentBlock = await provider.getBlock('latest');
  waitSecs = endTime - currentBlock.timestamp + 5; // +5 margin
  if (waitSecs > 0) {
    console.log(`Waiting ${waitSecs}s for sale to end...`);
    await sleep(waitSecs * 1000);
  }

  // Check status
  let status = await fairlaunch.status();
  console.log(
    'Status before update:',
    status,
    `(${['UPCOMING', 'LIVE', 'ENDED', 'SUCCESS', 'FAILED', 'CANCELLED'][Number(status)]})`
  );

  // ──────────────────────────────────────────────
  // Step 5: Finalize (step-by-step for detailed debugging)
  // ──────────────────────────────────────────────
  console.log('\n━━━ STEP 5: FINALIZATION ━━━');
  console.log('Testing step-by-step admin finalization...\n');

  // Step 5a: Fee Distribution
  console.log('─── 5a: Admin Distribute Fee ───');
  try {
    const feeTx = await fairlaunch.adminDistributeFee({ gasLimit: 500000 });
    const feeReceipt = await feeTx.wait();
    const step = await fairlaunch.finalizeStep();
    console.log(
      '✅ Fee distributed! Step:',
      step.toString(),
      'Gas:',
      feeReceipt.gasUsed.toString()
    );
  } catch (err) {
    console.error('❌ Fee distribution FAILED:', err.message);
    // Try to decode
    if (err.data) {
      try {
        const decoded = fairlaunch.interface.parseError(err.data);
        console.error('   Decoded error:', decoded?.name, decoded?.args);
      } catch {}
    }
    process.exit(1);
  }

  // Step 5b: Add Liquidity
  console.log('\n─── 5b: Admin Add Liquidity ───');
  try {
    const liqTx = await fairlaunch.adminAddLiquidity({ gasLimit: 1000000 });
    const liqReceipt = await liqTx.wait();
    const step = await fairlaunch.finalizeStep();
    const lpAddr = await fairlaunch.lpTokenAddress();
    console.log(
      '✅ Liquidity added! Step:',
      step.toString(),
      'Gas:',
      liqReceipt.gasUsed.toString()
    );
    console.log('   LP Token:', lpAddr);
  } catch (err) {
    console.error('❌ Add Liquidity FAILED:', err.message);
    process.exit(1);
  }

  // Step 5c: Lock LP
  console.log('\n─── 5c: Admin Lock LP ───');
  try {
    const lockTx = await fairlaunch.adminLockLP({ gasLimit: 500000 });
    const lockReceipt = await lockTx.wait();
    const step = await fairlaunch.finalizeStep();
    console.log('✅ LP Locked! Step:', step.toString(), 'Gas:', lockReceipt.gasUsed.toString());
  } catch (err) {
    console.error('❌ LP Lock FAILED:', err.message);
    process.exit(1);
  }

  // Step 5d: Distribute Funds
  console.log('\n─── 5d: Admin Distribute Funds ───');
  try {
    const fundsTx = await fairlaunch.adminDistributeFunds({ gasLimit: 500000 });
    const fundsReceipt = await fundsTx.wait();
    const step = await fairlaunch.finalizeStep();
    console.log(
      '✅ Funds distributed! Step:',
      step.toString(),
      'Gas:',
      fundsReceipt.gasUsed.toString()
    );
  } catch (err) {
    console.error('❌ Fund Distribution FAILED:', err.message);
    process.exit(1);
  }

  // ──────────────────────────────────────────────
  // Step 6: Verify Final State
  // ──────────────────────────────────────────────
  console.log('\n━━━ STEP 6: FINAL VERIFICATION ━━━');
  status = await fairlaunch.status();
  const finalized = await fairlaunch.isFinalized();
  const finalStep = await fairlaunch.finalizeStep();
  const lpAddr = await fairlaunch.lpTokenAddress();

  console.log(
    'Status:',
    status,
    `(${['UPCOMING', 'LIVE', 'ENDED', 'SUCCESS', 'FAILED', 'CANCELLED'][Number(status)]})`
  );
  console.log('Finalized:', finalized);
  console.log('Final Step:', finalStep);
  console.log('LP Token:', lpAddr);
  console.log('Total Raised:', hre.ethers.formatEther(totalRaised), 'BNB');

  // Check deployer balance (should have received remaining funds)
  const finalBalance = await provider.getBalance(deployer.address);
  console.log('Deployer balance:', hre.ethers.formatEther(finalBalance), 'BNB');

  console.log('\n═══════════════════════════════════════════════════');
  if (finalized && Number(status) === 3) {
    console.log('  🎉 E2E TEST PASSED - FINALIZATION SUCCESSFUL! 🎉');
  } else {
    console.log('  ❌ E2E TEST FAILED');
    console.log('  Expected: status=3 (SUCCESS), isFinalized=true');
    console.log('  Got: status=' + status + ', isFinalized=' + finalized);
  }
  console.log('═══════════════════════════════════════════════════');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
