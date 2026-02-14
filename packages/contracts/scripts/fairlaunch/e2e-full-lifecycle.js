/**
 * ═══════════════════════════════════════════════════════════════════
 * E2E Full Lifecycle — Fairlaunch (Multi-Network Pre-Mainnet Test)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Supported networks: BSC Testnet, Sepolia, Base Sepolia
 *
 * Mimics the ENTIRE UI Wizard → Admin → Contributor flow:
 *
 *  PHASE 1 — WIZARD (Developer)
 *   1. Create token (SimpleToken deploy = "Launchpad Template")
 *   2. Approve + deposit tokens to EscrowVault (wizard submit step)
 *
 *  PHASE 2 — ADMIN DEPLOYMENT
 *   3. Admin releases tokens from escrow
 *   4. Admin approves factory for token spend
 *   5. Admin deploys Fairlaunch via Factory
 *   6. Admin sets LP Locker
 *
 *  PHASE 3 — LIVE SALE
 *   7. Wait for sale start → Contributors buy in
 *   8. Wait for sale end
 *
 *  PHASE 4 — FINALIZATION (Admin 4-step)
 *   9a. adminDistributeFee  (→ FeeSplitter)
 *   9b. adminAddLiquidity   (→ DEX Router)
 *   9c. adminLockLP         (→ LPLocker)
 *   9d. adminDistributeFunds (→ Project Owner)
 *
 *  PHASE 5 — CLAIM (Contributor)
 *   10. Contributor claims tokens
 *   11. Verify double-claim protection
 *
 *  PHASE 6 — FINAL VERIFICATION
 *   12. All checks (status, balances, events, invariants)
 *
 * Usage:
 *   npx hardhat run scripts/fairlaunch/e2e-full-lifecycle.js --network bscTestnet
 *   npx hardhat run scripts/fairlaunch/e2e-full-lifecycle.js --network sepolia
 *   npx hardhat run scripts/fairlaunch/e2e-full-lifecycle.js --network base_sepolia
 */

const hre = require('hardhat');

// ═══════════════════════════════════════════════
// MULTI-NETWORK CONFIG
// ═══════════════════════════════════════════════
const NETWORK_CONFIG = {
  // BSC Testnet (chainId 97)
  97: {
    name: 'BSC Testnet',
    nativeToken: 'BNB',
    escrowVault: '0x6849A09c27F26fF0e58a2E36Dd5CAB2F9d0c617F',
    factory: '0xa6dE6Ebd3E0ED5AcbE9c07B59C738C610821e175',
    feeSplitter: '0x3301b82B4559F1607DA83FA460DC9820CbE1344e',
    lpLocker: '0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F',
    dexRouter: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1',
    dexName: 'PancakeSwap',
    // Amounts (BNB is cheap on testnet)
    softcap: '0.01',
    contribution: '0.05',
    minContrib: '0.005',
    maxContrib: '1.0',
  },
  // Sepolia (chainId 11155111)
  11155111: {
    name: 'Sepolia',
    nativeToken: 'ETH',
    escrowVault: '0x534D1Dce8deb8a0f62419d5310Ac97B37F86359F',
    factory: '0x53850a56397379Da8572A6a47003bca88bB52A24',
    feeSplitter: '0x5f3cf3D4fD540EFb2eEDA43921292fD08608518D',
    lpLocker: '0x151f010682D2991183E6235CA396c1c99cEF5A30',
    dexRouter: '0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3',
    dexName: 'UniswapV2',
    // Amounts (use smaller amounts on Sepolia — faucet ETH)
    softcap: '0.005',
    contribution: '0.02',
    minContrib: '0.001',
    maxContrib: '1.0',
  },
  // Base Sepolia (chainId 84532)
  84532: {
    name: 'Base Sepolia',
    nativeToken: 'ETH',
    escrowVault: '0x38C4eF7cE57fa9dbb09a2c7cb26C5c15406940C8',
    factory: '0xeEf8C1da1b94111237c419AB7C6cC30761f31572',
    feeSplitter: '0x069b5487A3CAbD868B498c34DA2d7cCfc2D3Dc4C',
    lpLocker: '0xaAbC564820edFc8A3Ce4Dd0547e6f4455731DB7a',
    dexRouter: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
    dexName: 'UniswapV2',
    // Amounts (Base Sepolia ETH from faucet)
    softcap: '0.001',
    contribution: '0.005',
    minContrib: '0.0005',
    maxContrib: '1.0',
  },
};

// Wizard-style fixed params
const WIZARD_PARAMS = {
  tokenName: 'E2E Full Test Token',
  tokenSymbol: 'E2EFULL',
  tokenDecimals: 18,
  totalSupply: '1000000', // 1M tokens
  tokensForSale: '100000', // 100K tokens
  liquidityPercent: 70, // 70%
  lpLockMonths: 12, // 12 months
  listingPremiumBps: 0, // 0% (fair price)
  startDelaySeconds: 30, // Start in 30s
  saleDurationSeconds: 90, // Run for 90s
};

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
const STATUS_LABELS = ['UPCOMING', 'LIVE', 'ENDED', 'SUCCESS', 'FAILED', 'CANCELLED'];
const STEP_LABELS = [
  'NONE',
  'FEE_DISTRIBUTED',
  'LIQUIDITY_ADDED',
  'LP_LOCKED',
  'FUNDS_DISTRIBUTED',
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function log(e, m) {
  console.log(`  ${e} ${m}`);
}

function header(title) {
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(64)}`);
}

function phase(n, title) {
  console.log(`\n${'━'.repeat(56)}`);
  console.log(`  PHASE ${n}: ${title}`);
  console.log(`${'━'.repeat(56)}`);
}

function step(n, title) {
  console.log(`\n  ── Step ${n}: ${title} ──`);
}

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════
async function main() {
  const [admin] = await hre.ethers.getSigners();
  const provider = admin.provider;
  const chainId = Number((await provider.getNetwork()).chainId);

  const config = NETWORK_CONFIG[chainId];
  if (!config) {
    throw new Error(
      `No config for chainId ${chainId}. Supported: ${Object.keys(NETWORK_CONFIG).join(', ')}`
    );
  }

  const results = {};

  header(`E2E FULL LIFECYCLE — FAIRLAUNCH (${config.name})`);
  log('👤', `Admin/Developer: ${admin.address}`);
  log(
    '💰',
    `Balance: ${hre.ethers.formatEther(await provider.getBalance(admin.address))} ${
      config.nativeToken
    }`
  );
  log('🌐', `Network: ${config.name} (chainId ${chainId})`);
  log('📋', `Factory:     ${config.factory}`);
  log('📋', `EscrowVault: ${config.escrowVault}`);
  log('📋', `FeeSplitter: ${config.feeSplitter}`);
  log('📋', `LPLocker:    ${config.lpLocker}`);
  log('📋', `DEX Router:  ${config.dexRouter} (${config.dexName})`);

  // ═══════════════════════════════════════════════════════════
  // PHASE 1: WIZARD — Developer Submission
  // ═══════════════════════════════════════════════════════════
  phase(1, 'WIZARD — Developer Submission');

  // Step 1.1: Create Token
  step('1.1', 'Create Token (Launchpad Template)');
  const SimpleToken = await hre.ethers.getContractFactory('SimpleToken');
  const totalSupply = hre.ethers.parseUnits(WIZARD_PARAMS.totalSupply, WIZARD_PARAMS.tokenDecimals);
  const token = await SimpleToken.deploy(
    `${WIZARD_PARAMS.tokenName}-${config.name}`,
    WIZARD_PARAMS.tokenSymbol,
    totalSupply,
    WIZARD_PARAMS.tokenDecimals,
    admin.address
  );
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  results.tokenAddress = tokenAddr;

  log('✅', `Token deployed: ${tokenAddr}`);
  log('📊', `Name: ${WIZARD_PARAMS.tokenName}-${config.name} ($${WIZARD_PARAMS.tokenSymbol})`);
  log('📊', `Supply: ${hre.ethers.formatUnits(totalSupply, 18)} tokens`);

  // Step 1.2: Calculate Token Allocation
  step('1.2', 'Calculate Token Allocation');
  const tokensForSale = hre.ethers.parseUnits(WIZARD_PARAMS.tokensForSale, 18);
  const liquidityBps = BigInt(WIZARD_PARAMS.liquidityPercent * 100);
  const liquidityTokens = (tokensForSale * liquidityBps) / 10000n;
  const totalTokensNeeded = tokensForSale + liquidityTokens;

  log('📦', `Tokens for sale:     ${hre.ethers.formatUnits(tokensForSale, 18)}`);
  log(
    '💧',
    `Liquidity tokens:    ${hre.ethers.formatUnits(liquidityTokens, 18)} (${
      WIZARD_PARAMS.liquidityPercent
    }%)`
  );
  log('📦', `Total to escrow:     ${hre.ethers.formatUnits(totalTokensNeeded, 18)}`);

  // Step 1.3: Approve + Deposit to EscrowVault
  step('1.3', 'Approve + Deposit to EscrowVault');
  const projectId = hre.ethers.id(`e2e-${config.name}-${Date.now()}`);
  log('🔑', `Project ID (bytes32): ${projectId}`);

  const approveTx1 = await token.approve(config.escrowVault, totalTokensNeeded);
  await approveTx1.wait();
  log('✅', 'Approved EscrowVault for token transfer');

  const escrow = await hre.ethers.getContractAt('EscrowVault', config.escrowVault);
  const depositTx = await escrow.deposit(projectId, tokenAddr, totalTokensNeeded);
  const depositReceipt = await depositTx.wait();
  log('✅', `Tokens deposited to escrow | TX: ${depositReceipt.hash}`);

  const escrowBalance = await escrow.getBalance(projectId);
  if (escrowBalance !== totalTokensNeeded) {
    throw new Error(`Escrow balance mismatch! Expected ${totalTokensNeeded}, got ${escrowBalance}`);
  }
  log('✅', `Escrow balance verified: ${hre.ethers.formatUnits(escrowBalance, 18)} tokens`);
  results.escrowDeposit = true;

  // ═══════════════════════════════════════════════════════════
  // PHASE 2: ADMIN DEPLOYMENT
  // ═══════════════════════════════════════════════════════════
  phase(2, 'ADMIN — Approve & Deploy');

  // Step 2.1: Admin releases tokens from escrow
  step('2.1', 'Admin Releases Tokens from Escrow');
  const releaseTx = await escrow.release(projectId, admin.address);
  await releaseTx.wait();
  log(
    '✅',
    `Tokens released to admin: ${hre.ethers.formatUnits(await token.balanceOf(admin.address), 18)}`
  );

  const escrowAfter = await escrow.getBalance(projectId);
  if (escrowAfter !== 0n) throw new Error('Escrow not empty after release!');
  log('✅', 'Escrow is now empty ✓');
  results.escrowRelease = true;

  // Step 2.2: Approve Factory
  step('2.2', 'Approve Factory for Token Spend');
  const approveTx2 = await token.approve(config.factory, hre.ethers.MaxUint256);
  await approveTx2.wait();
  log('✅', 'Factory approved for unlimited token spend');

  // Step 2.3: Deploy Fairlaunch via Factory
  step('2.3', 'Deploy Fairlaunch via Factory');
  const now = (await provider.getBlock('latest')).timestamp;
  const startTime = now + WIZARD_PARAMS.startDelaySeconds;
  const endTime = startTime + WIZARD_PARAMS.saleDurationSeconds;

  const createParams = {
    projectToken: tokenAddr,
    paymentToken: hre.ethers.ZeroAddress,
    softcap: hre.ethers.parseEther(config.softcap),
    tokensForSale: tokensForSale,
    minContribution: hre.ethers.parseEther(config.minContrib),
    maxContribution: hre.ethers.parseEther(config.maxContrib),
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
    liquidityPercent: liquidityBps,
    dexId: hre.ethers.id(config.dexName),
  };

  const factory = await hre.ethers.getContractAt('FairlaunchFactory', config.factory);
  const deploymentFee = await factory.DEPLOYMENT_FEE();
  log('💳', `Deployment fee: ${hre.ethers.formatEther(deploymentFee)} ${config.nativeToken}`);

  log('🚀', 'Calling factory.createFairlaunch()...');
  const createTx = await factory.createFairlaunch(createParams, vestingParams, lpPlan, {
    value: deploymentFee,
    gasLimit: 8000000,
  });
  const createReceipt = await createTx.wait();

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

  results.fairlaunchAddress = fairlaunchAddr;
  log('✅', `Fairlaunch: ${fairlaunchAddr}`);
  log('📋', `Vesting:    ${vestingAddr || 'none'}`);
  log('💰', `Deploy TX:  ${createReceipt.hash}`);

  const fairlaunch = await hre.ethers.getContractAt(
    'contracts/fairlaunch/Fairlaunch.sol:Fairlaunch',
    fairlaunchAddr
  );

  const feeS = await fairlaunch.feeSplitter();
  const router = await fairlaunch.dexRouter();
  log(
    '🔍',
    `FeeSplitter: ${feeS} ${feeS.toLowerCase() === config.feeSplitter.toLowerCase() ? '✅' : '❌'}`
  );
  log(
    '🔍',
    `DEX Router:  ${router} ${
      router.toLowerCase() === config.dexRouter.toLowerCase() ? '✅' : '❌'
    }`
  );

  // Step 2.4: Set LP Locker
  step('2.4', 'Set LP Locker');
  const setLPTx = await fairlaunch.setLPLocker(config.lpLocker);
  await setLPTx.wait();
  const locker = await fairlaunch.lpLocker();
  log(
    '✅',
    `LP Locker: ${locker} ${locker.toLowerCase() === config.lpLocker.toLowerCase() ? '✅' : '❌'}`
  );
  results.deploySuccess = true;

  // ═══════════════════════════════════════════════════════════
  // PHASE 3: LIVE SALE — Contribution
  // ═══════════════════════════════════════════════════════════
  phase(3, 'LIVE SALE — Contribute');

  step('3.1', 'Wait for Sale Start');
  let currentBlock = await provider.getBlock('latest');
  let waitSecs = startTime - currentBlock.timestamp + 5;
  if (waitSecs > 0) {
    log('⏳', `Waiting ${waitSecs}s for sale to start...`);
    await sleep(waitSecs * 1000);
  }

  let status = await fairlaunch.getStatus();
  log('📊', `Status: ${STATUS_LABELS[Number(status)]}`);

  step('3.2', 'Contributor Buys In');
  const contributeAmt = hre.ethers.parseEther(config.contribution);
  log('💸', `Contributing ${config.contribution} ${config.nativeToken}...`);
  const contributeTx = await fairlaunch.contribute({ value: contributeAmt });
  const contributeReceipt = await contributeTx.wait();

  const totalRaised = await fairlaunch.totalRaised();
  const softcapVal = await fairlaunch.softcap();
  const participants = await fairlaunch.participantCount();

  log('✅', `Contributed! TX: ${contributeReceipt.hash}`);
  log('📊', `Total raised:   ${hre.ethers.formatEther(totalRaised)} ${config.nativeToken}`);
  log(
    '📊',
    `Softcap:        ${hre.ethers.formatEther(softcapVal)} ${config.nativeToken} — Met? ${
      totalRaised >= softcapVal ? '✅ YES' : '❌ NO'
    }`
  );
  log('📊', `Participants:   ${participants.toString()}`);
  results.contributionSuccess = totalRaised >= softcapVal;

  step('3.3', 'Wait for Sale End');
  currentBlock = await provider.getBlock('latest');
  waitSecs = endTime - currentBlock.timestamp + 5;
  if (waitSecs > 0) {
    log('⏳', `Waiting ${waitSecs}s for sale to end...`);
    await sleep(waitSecs * 1000);
  }
  status = await fairlaunch.getStatus();
  log('📊', `Status: ${STATUS_LABELS[Number(status)]}`);

  // ═══════════════════════════════════════════════════════════
  // PHASE 4: FINALIZATION (Admin 4-Step)
  // ═══════════════════════════════════════════════════════════
  phase(4, 'ADMIN — Finalization (4-Step)');
  const GAS = 5000000;

  // 4a: Fee Distribution
  step('4a', 'adminDistributeFee → FeeSplitter');
  try {
    const tx = await fairlaunch.adminDistributeFee({ gasLimit: GAS });
    const r = await tx.wait();
    log(
      '✅',
      `Fee distributed! Step: ${STEP_LABELS[Number(await fairlaunch.finalizeStep())]}, Gas: ${
        r.gasUsed
      }`
    );
    results.feeDistributed = true;
  } catch (err) {
    log('❌', `FAILED: ${err.message}`);
    results.feeDistributed = false;
    process.exit(1);
  }

  // 4b: Add Liquidity
  step('4b', `adminAddLiquidity → ${config.dexName}`);
  try {
    const tx = await fairlaunch.adminAddLiquidity({ gasLimit: GAS });
    const r = await tx.wait();
    const lp = await fairlaunch.lpTokenAddress();
    log(
      '✅',
      `Liquidity added! Step: ${STEP_LABELS[Number(await fairlaunch.finalizeStep())]}, Gas: ${
        r.gasUsed
      }`
    );
    log('📊', `LP Token: ${lp}`);
    results.lpTokenAddress = lp;
    results.liquidityAdded = true;
  } catch (err) {
    log('❌', `FAILED: ${err.message}`);
    results.liquidityAdded = false;
    process.exit(1);
  }

  // 4c: Lock LP
  step('4c', 'adminLockLP → LPLocker');
  try {
    const tx = await fairlaunch.adminLockLP({ gasLimit: GAS });
    const r = await tx.wait();
    log(
      '✅',
      `LP locked! Step: ${STEP_LABELS[Number(await fairlaunch.finalizeStep())]}, Gas: ${r.gasUsed}`
    );
    results.lpLocked = true;
  } catch (err) {
    log('❌', `FAILED: ${err.message}`);
    results.lpLocked = false;
    process.exit(1);
  }

  // 4d: Distribute Funds
  step('4d', 'adminDistributeFunds → Project Owner');
  try {
    const tx = await fairlaunch.adminDistributeFunds({ gasLimit: GAS });
    const r = await tx.wait();
    log(
      '✅',
      `Funds distributed! Step: ${STEP_LABELS[Number(await fairlaunch.finalizeStep())]}, Gas: ${
        r.gasUsed
      }`
    );
    results.fundsDistributed = true;
  } catch (err) {
    log('❌', `FAILED: ${err.message}`);
    results.fundsDistributed = false;
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 5: CLAIM — Contributor Claims Tokens
  // ═══════════════════════════════════════════════════════════
  phase(5, 'CLAIM — Contributor Claims Tokens');

  step('5.1', 'Verify Pre-Claim State');
  status = Number(await fairlaunch.status());
  const isFinalized = await fairlaunch.isFinalized();
  const allocation = await fairlaunch.getUserAllocation(admin.address);

  log('📊', `Status: ${STATUS_LABELS[status]} (${status})`);
  log('📊', `isFinalized: ${isFinalized}`);
  log(
    '📊',
    `Token allocation: ${hre.ethers.formatUnits(allocation, 18)} $${WIZARD_PARAMS.tokenSymbol}`
  );

  if (status !== 3) {
    log('❌', 'Status is not SUCCESS — cannot claim!');
    process.exit(1);
  }

  step('5.2', 'Claim Tokens');
  const tokenBalBefore = await token.balanceOf(admin.address);
  log('📊', `Token balance before: ${hre.ethers.formatUnits(tokenBalBefore, 18)}`);

  try {
    const claimTx = await fairlaunch.claimTokens();
    const claimReceipt = await claimTx.wait();
    const tokenBalAfter = await token.balanceOf(admin.address);
    const tokensReceived = tokenBalAfter - tokenBalBefore;

    log('✅', `Claimed! TX: ${claimReceipt.hash}`);
    log(
      '📊',
      `Tokens received: ${hre.ethers.formatUnits(tokensReceived, 18)} $${WIZARD_PARAMS.tokenSymbol}`
    );
    log('📊', `Expected:        ${hre.ethers.formatUnits(allocation, 18)}`);
    log('📊', `Match? ${tokensReceived === allocation ? '✅ YES' : '❌ NO'}`);

    results.claimSuccess = true;
    results.tokensReceived = tokensReceived;
    results.expectedAllocation = allocation;
  } catch (err) {
    log('❌', `Claim FAILED: ${err.message}`);
    results.claimSuccess = false;
    process.exit(1);
  }

  // Step 5.3: Double-claim protection
  step('5.3', 'Verify Double-Claim Protection');
  try {
    await fairlaunch.claimTokens();
    log('❌', 'Double claim SHOULD have reverted but did not!');
    results.doubleClaimProtection = false;
  } catch (err) {
    log('✅', 'Double claim correctly reverted: AlreadyClaimed');
    results.doubleClaimProtection = true;
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 6: FINAL VERIFICATION
  // ═══════════════════════════════════════════════════════════
  phase(6, 'FINAL VERIFICATION');

  status = Number(await fairlaunch.status());
  const finalizedFlag = await fairlaunch.isFinalized();
  const finalStep = Number(await fairlaunch.finalizeStep());
  const lpAddr = await fairlaunch.lpTokenAddress();
  const finalPrice = await fairlaunch.finalTokenPrice();
  const hasClaimed = await fairlaunch.hasClaimed(admin.address);

  log('📊', `Status:          ${STATUS_LABELS[status]} (${status})`);
  log('📊', `Finalized:       ${finalizedFlag}`);
  log('📊', `Finalize Step:   ${STEP_LABELS[finalStep]} (${finalStep})`);
  log('📊', `LP Token:        ${lpAddr}`);
  log(
    '📊',
    `Final Price:     ${hre.ethers.formatUnits(finalPrice, 18)} ${config.nativeToken}/token`
  );
  log('📊', `Has Claimed:     ${hasClaimed}`);
  log('📊', `Total Raised:    ${hre.ethers.formatEther(totalRaised)} ${config.nativeToken}`);
  log(
    '📊',
    `Balance:         ${hre.ethers.formatEther(await provider.getBalance(admin.address))} ${
      config.nativeToken
    }`
  );

  // ═══════════════════════════════════════════════════════════
  // RESULT TABLE
  // ═══════════════════════════════════════════════════════════
  header(`TEST RESULTS — ${config.name}`);

  const checks = [
    ['Token created', !!results.tokenAddress],
    ['Escrow deposit successful', results.escrowDeposit],
    ['Escrow release successful', results.escrowRelease],
    ['Factory deploy (FairlaunchCreated)', !!results.fairlaunchAddress],
    ['LP Locker configured', locker.toLowerCase() === config.lpLocker.toLowerCase()],
    ['FeeSplitter configured', feeS.toLowerCase() === config.feeSplitter.toLowerCase()],
    ['DEX Router configured', router.toLowerCase() === config.dexRouter.toLowerCase()],
    ['Contribution success + softcap met', results.contributionSuccess],
    ['4a. Fee distributed', results.feeDistributed],
    ['4b. Liquidity added', results.liquidityAdded],
    ['4c. LP locked', results.lpLocked],
    ['4d. Funds distributed', results.fundsDistributed],
    ['Status = SUCCESS (3)', status === 3],
    ['isFinalized = true', finalizedFlag === true],
    ['finalizeStep = FUNDS_DISTRIBUTED (4)', finalStep === 4],
    ['LP Token != 0x0', lpAddr !== hre.ethers.ZeroAddress],
    ['Escrow empty after release', escrowAfter === 0n],
    ['Claim tokens successful', results.claimSuccess],
    ['Tokens received match allocation', results.tokensReceived === results.expectedAllocation],
    ['Double-claim protection works', results.doubleClaimProtection],
    ['hasClaimed = true', hasClaimed === true],
  ];

  let passed = 0;
  let failed = 0;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${label}`);
    ok ? passed++ : failed++;
  }

  console.log(`\n  ${'─'.repeat(40)}`);
  console.log(`  Total: ${passed}/${checks.length} passed, ${failed} failed`);
  console.log(`  ${'─'.repeat(40)}`);

  if (failed === 0) {
    console.log(`\n  🎉🎉🎉  ALL CHECKS PASSED — ${config.name} E2E SUCCESS  🎉🎉🎉`);
  } else {
    console.log('\n  ❌  SOME CHECKS FAILED — REVIEW ABOVE');
  }

  console.log(`\n  Addresses:`);
  console.log(`    Fairlaunch: ${fairlaunchAddr}`);
  console.log(`    Token:      ${tokenAddr}`);
  console.log(`    LP Token:   ${lpAddr}`);
  console.log(`    Vesting:    ${vestingAddr || 'none'}`);
  console.log(`${'═'.repeat(64)}\n`);

  if (failed > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n  💥 Fatal error:', error);
    process.exit(1);
  });
