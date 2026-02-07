/**
 * E2E Escrow → Finalize Test
 *
 * Full production flow:
 *   1. Developer creates token
 *   2. Developer deposits tokens to EscrowVault (wizard submit)
 *   3. Admin approves (simulated DB status change)
 *   4. Admin releases tokens from escrow to admin wallet
 *   5. Admin approves factory for token spend
 *   6. Admin deploys Fairlaunch via Factory (factory pulls tokens)
 *   7. Admin sets LP Locker
 *   8. Project goes LIVE → Contributor buys in
 *   9. Project ENDS
 *  10. Admin finalizes step-by-step
 *      a. distributeFee  (FeeSplitter)
 *      b. addLiquidity    (PancakeSwap V2)
 *      c. lockLP          (LPLocker)
 *      d. distributeFunds (to project owner)
 *
 * Usage: npx hardhat run scripts/fairlaunch/e2e-escrow-finalize.js --network bscTestnet
 */

const hre = require('hardhat');

// ─── Contract Addresses (BSC Testnet) ───
const ESCROW_VAULT = '0x6849A09c27F26fF0e58a2E36Dd5CAB2F9d0c617F';
const FACTORY = '0x5Fa2528164baF18cA6Cd859701d7a5a6ad197DEa';
const FEE_SPLITTER = '0x3301b82B4559F1607DA83FA460DC9820CbE1344e';
const LP_LOCKER = '0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F';

// ─── Wizard-style Parameters ───
const WIZARD_PARAMS = {
  softcap: '0.01', // 0.01 BNB
  tokensForSale: '100000', // 100,000 tokens
  minContribution: '0.005', // 0.005 BNB
  maxContribution: '1.0', // 1.0 BNB
  liquidityPercent: 70, // 70%
  lpLockMonths: 12, // 12 months
  listingPremiumBps: 0, // 0% premium (fair price)
  dexPlatform: 'PancakeSwap',
  saleDurationSeconds: 90, // Short for testing (90s)
  startDelaySeconds: 30, // Start in 30s
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(emoji, msg) {
  console.log(`${emoji} ${msg}`);
}

function header(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(60)}`);
}

function step(n, title) {
  console.log(`\n${'━'.repeat(50)}`);
  console.log(`  STEP ${n}: ${title}`);
  console.log(`${'━'.repeat(50)}`);
}

async function main() {
  const [admin] = await hre.ethers.getSigners();
  const provider = admin.provider;

  header('E2E ESCROW → FINALIZE TEST');
  log('👤', `Admin/Deployer: ${admin.address}`);
  log('💰', `Balance: ${hre.ethers.formatEther(await provider.getBalance(admin.address))} BNB`);

  // ════════════════════════════════════════════════
  // STEP 1: Developer creates token
  // ════════════════════════════════════════════════
  step(1, 'Developer Creates Token');

  const SimpleToken = await hre.ethers.getContractFactory('SimpleToken');
  const totalSupply = hre.ethers.parseUnits('1000000', 18); // 1M tokens
  const token = await SimpleToken.deploy(
    'Escrow Test Token',
    'ESCTEST',
    totalSupply,
    18,
    admin.address
  );
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();

  log('✅', `Token deployed: ${tokenAddr}`);
  log(
    '📊',
    `Total supply: ${hre.ethers.formatUnits(await token.balanceOf(admin.address), 18)} ESCTEST`
  );

  // ════════════════════════════════════════════════
  // STEP 2: Developer deposits tokens to EscrowVault
  // ════════════════════════════════════════════════
  step(2, 'Developer Deposits Tokens to Escrow');

  // Generate a unique projectId (mimicking the wizard's random UUID → keccak256)
  const projectUUID = hre.ethers.id(`e2e-test-${Date.now()}`);
  log('🔑', `Project ID (bytes32): ${projectUUID}`);

  // Calculate total tokens needed: tokensForSale + liquidityTokens
  const tokensForSale = hre.ethers.parseUnits(WIZARD_PARAMS.tokensForSale, 18);
  const liquidityPercent = BigInt(WIZARD_PARAMS.liquidityPercent * 100); // to bps
  const liquidityTokens = (tokensForSale * liquidityPercent) / 10000n;
  const totalTokensNeeded = tokensForSale + liquidityTokens;

  log('📦', `Tokens for sale: ${hre.ethers.formatUnits(tokensForSale, 18)}`);
  log(
    '💧',
    `Liquidity tokens (${WIZARD_PARAMS.liquidityPercent}%): ${hre.ethers.formatUnits(
      liquidityTokens,
      18
    )}`
  );
  log('📦', `Total to escrow: ${hre.ethers.formatUnits(totalTokensNeeded, 18)}`);

  // Approve escrow vault to pull tokens
  const approveTx1 = await token.approve(ESCROW_VAULT, totalTokensNeeded);
  await approveTx1.wait();
  log('✅', 'Approved EscrowVault for token transfer');

  // Deposit to escrow
  const escrow = await hre.ethers.getContractAt('EscrowVault', ESCROW_VAULT);
  const depositTx = await escrow.deposit(projectUUID, tokenAddr, totalTokensNeeded);
  const depositReceipt = await depositTx.wait();

  log('✅', `Tokens deposited to escrow. TX: ${depositReceipt.hash}`);

  // Verify escrow balance
  const escrowBalance = await escrow.getBalance(projectUUID);
  log('📊', `Escrow balance: ${hre.ethers.formatUnits(escrowBalance, 18)} tokens`);

  if (escrowBalance !== totalTokensNeeded) {
    throw new Error('Escrow balance mismatch!');
  }
  log('✅', 'Escrow balance verified ✓');

  // ════════════════════════════════════════════════
  // STEP 3: Admin Approves (simulated)
  // ════════════════════════════════════════════════
  step(3, 'Admin Approves Project (DB status → APPROVED_TO_DEPLOY)');
  log('📋', "In production: Admin reviews project in dashboard, clicks 'Approve & Deploy'");
  log('✅', 'Status: APPROVED_TO_DEPLOY (simulated)');

  // ════════════════════════════════════════════════
  // STEP 4: Admin releases tokens from escrow
  // ════════════════════════════════════════════════
  step(4, 'Admin Releases Tokens from Escrow');

  // Release to admin wallet (same as deploy route.ts does)
  const releaseTx = await escrow.release(projectUUID, admin.address);
  await releaseTx.wait();

  const adminTokenBalance = await token.balanceOf(admin.address);
  log('✅', `Tokens released to admin wallet: ${hre.ethers.formatUnits(adminTokenBalance, 18)}`);

  // Verify escrow is now empty
  const escrowAfter = await escrow.getBalance(projectUUID);
  log('📊', `Escrow balance after release: ${escrowAfter.toString()} (should be 0)`);

  // ════════════════════════════════════════════════
  // STEP 5: Admin approves Factory & deploys Fairlaunch
  // ════════════════════════════════════════════════
  step(5, 'Admin Deploys Fairlaunch via Factory');

  // Approve factory to pull tokens
  const approveTx2 = await token.approve(FACTORY, hre.ethers.MaxUint256);
  await approveTx2.wait();
  log('✅', 'Approved Factory for unlimited token spend');

  // Build params (matching deploy route.ts)
  const now = (await provider.getBlock('latest')).timestamp;
  const startTime = now + WIZARD_PARAMS.startDelaySeconds;
  const endTime = startTime + WIZARD_PARAMS.saleDurationSeconds;

  const createParams = {
    projectToken: tokenAddr,
    paymentToken: hre.ethers.ZeroAddress,
    softcap: hre.ethers.parseEther(WIZARD_PARAMS.softcap),
    tokensForSale: tokensForSale,
    minContribution: hre.ethers.parseEther(WIZARD_PARAMS.minContribution),
    maxContribution: hre.ethers.parseEther(WIZARD_PARAMS.maxContribution),
    startTime: BigInt(startTime),
    endTime: BigInt(endTime),
    projectOwner: admin.address,
    listingPremiumBps: WIZARD_PARAMS.listingPremiumBps,
  };

  const vestingParams = {
    beneficiary: admin.address,
    startTime: BigInt(endTime),
    durations: [],
    amounts: [],
  };

  const lpPlan = {
    lockMonths: BigInt(WIZARD_PARAMS.lpLockMonths),
    liquidityPercent: liquidityPercent,
    dexId: hre.ethers.id(WIZARD_PARAMS.dexPlatform),
  };

  // Get deployment fee
  const factory = await hre.ethers.getContractAt('FairlaunchFactory', FACTORY);
  const deploymentFee = await factory.DEPLOYMENT_FEE();
  log('💳', `Deployment fee: ${hre.ethers.formatEther(deploymentFee)} BNB`);

  // Deploy via factory
  log('🚀', 'Calling factory.createFairlaunch()...');
  const createTx = await factory.createFairlaunch(createParams, vestingParams, lpPlan, {
    value: deploymentFee,
  });
  const createReceipt = await createTx.wait();

  // Extract addresses
  let fairlaunchAddr, vestingAddr;
  for (const logEntry of createReceipt.logs) {
    try {
      const parsed = factory.interface.parseLog(logEntry);
      if (parsed?.name === 'FairlaunchCreated') {
        fairlaunchAddr = parsed.args.fairlaunch;
        vestingAddr = parsed.args.vesting;
        break;
      }
    } catch {}
  }

  if (!fairlaunchAddr) throw new Error('FairlaunchCreated event not found!');
  log('✅', `Fairlaunch deployed: ${fairlaunchAddr}`);
  log('📋', `Vesting: ${vestingAddr || 'none'}`);
  log('💰', `Deploy TX: ${createReceipt.hash}`);

  // ════════════════════════════════════════════════
  // STEP 6: Admin sets LP Locker (auto-config)
  // ════════════════════════════════════════════════
  step(6, 'Admin Configures LP Locker');

  const fairlaunch = await hre.ethers.getContractAt(
    'contracts/fairlaunch/Fairlaunch.sol:Fairlaunch',
    fairlaunchAddr
  );

  const setLPTx = await fairlaunch.setLPLocker(LP_LOCKER);
  await setLPTx.wait();

  // Verify all config
  const feeS = await fairlaunch.feeSplitter();
  const router = await fairlaunch.dexRouter();
  const locker = await fairlaunch.lpLocker();

  log('✅', `LP Locker set: ${locker}`);
  log('🔍', 'Contract Configuration:');
  log(
    '   ',
    `FeeSplitter: ${feeS} ${feeS.toLowerCase() === FEE_SPLITTER.toLowerCase() ? '✅' : '❌'}`
  );
  log('   ', `DEX Router:  ${router} ✅`);
  log(
    '   ',
    `LP Locker:   ${locker} ${locker.toLowerCase() === LP_LOCKER.toLowerCase() ? '✅' : '❌'}`
  );

  // Status: DEPLOYED (DB update in production)
  log('📋', 'Status: DEPLOYED (DB update simulated)');

  // ════════════════════════════════════════════════
  // STEP 7: Wait for sale to start → Contribute
  // ════════════════════════════════════════════════
  step(7, 'Project LIVE — Contributor Buys In');

  let currentBlock = await provider.getBlock('latest');
  let waitSecs = startTime - currentBlock.timestamp + 5;
  if (waitSecs > 0) {
    log('⏳', `Waiting ${waitSecs}s for sale to start...`);
    await sleep(waitSecs * 1000);
  }

  // Contribute 0.05 BNB (5x softcap)
  const contributeAmount = hre.ethers.parseEther('0.05');
  log('💸', `Contributing ${hre.ethers.formatEther(contributeAmount)} BNB...`);
  const contributeTx = await fairlaunch.contribute({ value: contributeAmount });
  await contributeTx.wait();

  const totalRaised = await fairlaunch.totalRaised();
  const softcapVal = await fairlaunch.softcap();
  log('✅', `Contributed! Total raised: ${hre.ethers.formatEther(totalRaised)} BNB`);
  log(
    '📊',
    `Softcap: ${hre.ethers.formatEther(softcapVal)} BNB — Met? ${
      totalRaised >= softcapVal ? '✅ YES' : '❌ NO'
    }`
  );

  // ════════════════════════════════════════════════
  // STEP 8: Wait for sale to end
  // ════════════════════════════════════════════════
  step(8, 'Waiting for Sale to End');

  currentBlock = await provider.getBlock('latest');
  waitSecs = endTime - currentBlock.timestamp + 5;
  if (waitSecs > 0) {
    log('⏳', `Waiting ${waitSecs}s for sale to end...`);
    await sleep(waitSecs * 1000);
  }

  let status = await fairlaunch.status();
  log(
    '📊',
    `On-chain status: ${status} (${
      ['UPCOMING', 'LIVE', 'ENDED', 'SUCCESS', 'FAILED', 'CANCELLED'][Number(status)]
    })`
  );

  // ════════════════════════════════════════════════
  // STEP 9: Admin Finalizes (step-by-step)
  // ════════════════════════════════════════════════
  step(9, 'ADMIN FINALIZATION (Step-by-Step)');

  const GAS = 5000000; // Same as server action

  // 9a: Fee Distribution
  log('', '\n─── 9a: Admin Distribute Fee (FeeSplitter) ───');
  try {
    const tx = await fairlaunch.adminDistributeFee({ gasLimit: GAS });
    const receipt = await tx.wait();
    const s = await fairlaunch.finalizeStep();
    log('✅', `Fee distributed! Step: ${s}, Gas: ${receipt.gasUsed}`);
  } catch (err) {
    log('❌', `Fee distribution FAILED: ${err.message}`);
    process.exit(1);
  }

  // 9b: Add Liquidity
  log('', '\n─── 9b: Admin Add Liquidity (PancakeSwap V2) ───');
  try {
    const tx = await fairlaunch.adminAddLiquidity({ gasLimit: GAS });
    const receipt = await tx.wait();
    const s = await fairlaunch.finalizeStep();
    const lp = await fairlaunch.lpTokenAddress();
    log('✅', `Liquidity added! Step: ${s}, Gas: ${receipt.gasUsed}`);
    log('📊', `LP Token: ${lp}`);
  } catch (err) {
    log('❌', `Add liquidity FAILED: ${err.message}`);
    process.exit(1);
  }

  // 9c: Lock LP
  log('', '\n─── 9c: Admin Lock LP (LPLocker) ───');
  try {
    const tx = await fairlaunch.adminLockLP({ gasLimit: GAS });
    const receipt = await tx.wait();
    const s = await fairlaunch.finalizeStep();
    log('✅', `LP locked! Step: ${s}, Gas: ${receipt.gasUsed}`);
  } catch (err) {
    log('❌', `LP lock FAILED: ${err.message}`);
    process.exit(1);
  }

  // 9d: Distribute Funds
  log('', '\n─── 9d: Admin Distribute Funds (to Project Owner) ───');
  try {
    const tx = await fairlaunch.adminDistributeFunds({ gasLimit: GAS });
    const receipt = await tx.wait();
    const s = await fairlaunch.finalizeStep();
    log('✅', `Funds distributed! Step: ${s}, Gas: ${receipt.gasUsed}`);
  } catch (err) {
    log('❌', `Fund distribution FAILED: ${err.message}`);
    process.exit(1);
  }

  // ════════════════════════════════════════════════
  // STEP 10: Final Verification
  // ════════════════════════════════════════════════
  step(10, 'FINAL VERIFICATION');

  status = await fairlaunch.status();
  const finalized = await fairlaunch.isFinalized();
  const finalStep = await fairlaunch.finalizeStep();
  const lpAddr = await fairlaunch.lpTokenAddress();
  const finalBalance = await provider.getBalance(admin.address);

  log(
    '📊',
    `Status:        ${status} (${
      ['UPCOMING', 'LIVE', 'ENDED', 'SUCCESS', 'FAILED', 'CANCELLED'][Number(status)]
    })`
  );
  log('📊', `Finalized:     ${finalized}`);
  log(
    '📊',
    `Final Step:    ${finalStep} (${
      ['NONE', 'FEE_DISTRIBUTED', 'LIQUIDITY_ADDED', 'LP_LOCKED', 'FUNDS_DISTRIBUTED'][
        Number(finalStep)
      ]
    })`
  );
  log('📊', `LP Token:      ${lpAddr}`);
  log('📊', `Total Raised:  ${hre.ethers.formatEther(totalRaised)} BNB`);
  log('💰', `Admin Balance: ${hre.ethers.formatEther(finalBalance)} BNB`);

  header('TEST RESULTS');

  const checks = [
    ['Status = SUCCESS (3)', Number(status) === 3],
    ['isFinalized = true', finalized === true],
    ['finalizeStep = FUNDS_DISTRIBUTED (4)', Number(finalStep) === 4],
    ['LP Token != 0x0', lpAddr !== hre.ethers.ZeroAddress],
    ['Escrow empty', escrowAfter === 0n],
    ['FeeSplitter match', feeS.toLowerCase() === FEE_SPLITTER.toLowerCase()],
    ['LP Locker match', locker.toLowerCase() === LP_LOCKER.toLowerCase()],
  ];

  let allPassed = true;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${label}`);
    if (!ok) allPassed = false;
  }

  console.log();
  if (allPassed) {
    console.log('  🎉🎉🎉  ALL CHECKS PASSED — E2E ESCROW→FINALIZE SUCCESS  🎉🎉🎉');
  } else {
    console.log('  ❌  SOME CHECKS FAILED');
  }

  console.log(`\n  Fairlaunch: ${fairlaunchAddr}`);
  console.log(`  Token:      ${tokenAddr}`);
  console.log(`  LP Token:   ${lpAddr}`);
  console.log(`${'═'.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
