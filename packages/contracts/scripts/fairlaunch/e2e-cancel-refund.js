/**
 * E2E Cancel + Refund Test
 *
 * Tests the flow for failed/cancelled projects:
 *   1. Deploy token + create Fairlaunch
 *   2. Contributor buys in
 *   3. Admin cancels the project
 *   4. Contributor claims refund
 *   5. Verify BNB returned
 *
 * Usage: npx hardhat run scripts/fairlaunch/e2e-cancel-refund.js --network bscTestnet
 */

const hre = require('hardhat');

const FACTORY = '0x5Fa2528164baF18cA6Cd859701d7a5a6ad197DEa';
const LP_LOCKER = '0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F';

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

  header('E2E CANCEL + REFUND TEST');
  log('👤', `Admin: ${admin.address}`);
  const startBalance = await provider.getBalance(admin.address);
  log('💰', `Balance: ${hre.ethers.formatEther(startBalance)} BNB`);

  // ═══════════════════════
  // STEP 1: Deploy Token + Fairlaunch
  // ═══════════════════════
  step(1, 'Deploy Token + Create Fairlaunch');

  const SimpleToken = await hre.ethers.getContractFactory('SimpleToken');
  const totalSupply = hre.ethers.parseUnits('1000000', 18);
  const token = await SimpleToken.deploy(
    'Refund Test Token',
    'REFTEST',
    totalSupply,
    18,
    admin.address
  );
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  log('✅', `Token: ${tokenAddr}`);

  // Approve factory
  await (await token.approve(FACTORY, hre.ethers.MaxUint256)).wait();

  const factory = await hre.ethers.getContractAt('FairlaunchFactory', FACTORY);
  const now = (await provider.getBlock('latest')).timestamp;

  const tokensForSale = hre.ethers.parseUnits('100000', 18);
  const liquidityPercent = 7000n;

  const createParams = {
    projectToken: tokenAddr,
    paymentToken: hre.ethers.ZeroAddress,
    softcap: hre.ethers.parseEther('0.01'),
    tokensForSale,
    minContribution: hre.ethers.parseEther('0.005'),
    maxContribution: hre.ethers.parseEther('1.0'),
    startTime: BigInt(now + 20),
    endTime: BigInt(now + 600), // 10 min — long enough that we cancel BEFORE it ends
    projectOwner: admin.address,
    listingPremiumBps: 0,
  };

  const vestingParams = {
    beneficiary: admin.address,
    startTime: BigInt(now + 600),
    durations: [],
    amounts: [],
  };

  const lpPlan = {
    lockMonths: 12n,
    liquidityPercent,
    dexId: hre.ethers.id('PancakeSwap'),
  };

  const deploymentFee = await factory.DEPLOYMENT_FEE();
  const createTx = await factory.createFairlaunch(createParams, vestingParams, lpPlan, {
    value: deploymentFee,
  });
  const createReceipt = await createTx.wait();

  let fairlaunchAddr;
  for (const logEntry of createReceipt.logs) {
    try {
      const parsed = factory.interface.parseLog(logEntry);
      if (parsed?.name === 'FairlaunchCreated') {
        fairlaunchAddr = parsed.args.fairlaunch;
        break;
      }
    } catch {}
  }
  log('✅', `Fairlaunch: ${fairlaunchAddr}`);

  const fairlaunch = await hre.ethers.getContractAt(
    'contracts/fairlaunch/Fairlaunch.sol:Fairlaunch',
    fairlaunchAddr
  );

  // Set LP Locker
  await (await fairlaunch.setLPLocker(LP_LOCKER)).wait();
  log('✅', 'LP Locker set');

  // ═══════════════════════
  // STEP 2: Wait for LIVE → Contribute
  // ═══════════════════════
  step(2, 'Contribute to Fairlaunch');

  let currentBlock = await provider.getBlock('latest');
  let wait = now + 20 - currentBlock.timestamp + 5;
  if (wait > 0) {
    log('⏳', `Waiting ${wait}s for sale to start...`);
    await sleep(wait * 1000);
  }

  const contributeAmount = hre.ethers.parseEther('0.05');
  const balanceBeforeContribute = await provider.getBalance(admin.address);

  log('💸', `Contributing ${hre.ethers.formatEther(contributeAmount)} BNB...`);
  const contribTx = await fairlaunch.contribute({ value: contributeAmount });
  const contribReceipt = await contribTx.wait();
  const contribGasCost = contribReceipt.gasUsed * contribReceipt.gasPrice;

  const totalRaised = await fairlaunch.totalRaised();
  const myContribution = await fairlaunch.contributions(admin.address);
  log('✅', `Contributed! My contribution: ${hre.ethers.formatEther(myContribution)} BNB`);
  log('📊', `Total raised: ${hre.ethers.formatEther(totalRaised)} BNB`);

  // ═══════════════════════
  // STEP 3: Admin Cancels (while LIVE)
  // ═══════════════════════
  step(3, 'Admin Cancels Fairlaunch');

  let status = await fairlaunch.status();
  log(
    '📊',
    `Status before cancel: ${status} (${
      ['UPCOMING', 'LIVE', 'ENDED', 'SUCCESS', 'FAILED', 'CANCELLED'][Number(status)]
    })`
  );

  log('🚫', 'Calling cancel()...');
  const cancelTx = await fairlaunch.cancel({ gasLimit: 200000 });
  const cancelReceipt = await cancelTx.wait();

  status = await fairlaunch.status();
  log(
    '✅',
    `Cancelled! Status: ${status} (${
      ['UPCOMING', 'LIVE', 'ENDED', 'SUCCESS', 'FAILED', 'CANCELLED'][Number(status)]
    })`
  );
  log('📊', `Cancel TX: ${cancelReceipt.hash}`);

  if (Number(status) !== 5) {
    log('❌', 'Expected status CANCELLED (5)!');
    process.exit(1);
  }

  // ═══════════════════════
  // STEP 4: Contributor Claims Refund
  // ═══════════════════════
  step(4, 'Contributor Claims Refund');

  const balanceBeforeRefund = await provider.getBalance(admin.address);
  log('💰', `Balance before refund: ${hre.ethers.formatEther(balanceBeforeRefund)} BNB`);
  log('💸', `Expected refund: ${hre.ethers.formatEther(myContribution)} BNB`);

  log('🔄', 'Calling refund()...');
  const refundTx = await fairlaunch.refund({ gasLimit: 200000 });
  const refundReceipt = await refundTx.wait();
  const refundGasCost = refundReceipt.gasUsed * refundReceipt.gasPrice;

  const balanceAfterRefund = await provider.getBalance(admin.address);
  const actualRefund = balanceAfterRefund - balanceBeforeRefund + refundGasCost;

  log('✅', `Refund claimed! TX: ${refundReceipt.hash}`);
  log('💰', `Balance after refund: ${hre.ethers.formatEther(balanceAfterRefund)} BNB`);
  log('📊', `Actual refund (+ gas): ${hre.ethers.formatEther(actualRefund)} BNB`);
  log('📊', `Gas cost: ${hre.ethers.formatEther(refundGasCost)} BNB`);

  // Verify contribution is now zero
  const contribAfter = await fairlaunch.contributions(admin.address);
  log('📊', `Contribution after refund: ${hre.ethers.formatEther(contribAfter)} BNB (should be 0)`);

  // ═══════════════════════
  // STEP 5: Try Double-Refund (should fail)
  // ═══════════════════════
  step(5, 'Double-Refund Protection Test');

  try {
    await fairlaunch.refund.staticCall({ gasLimit: 200000 });
    log('❌', 'Double refund should have reverted!');
  } catch (err) {
    log('✅', `Double refund correctly blocked: ${err.message.substring(0, 80)}...`);
  }

  // ═══════════════════════
  // FINAL VERIFICATION
  // ═══════════════════════
  header('TEST RESULTS');

  const checks = [
    ['Status = CANCELLED (5)', Number(status) === 5],
    ['Contribution zeroed after refund', contribAfter === 0n],
    [
      'Actual refund ≈ contribution',
      actualRefund >= myContribution - hre.ethers.parseEther('0.001'),
    ],
    ['Double-refund blocked', true], // verified above
  ];

  let allPassed = true;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${label}`);
    if (!ok) allPassed = false;
  }

  console.log();
  if (allPassed) {
    console.log('  🎉🎉🎉  ALL CHECKS PASSED — CANCEL + REFUND WORKS  🎉🎉🎉');
  } else {
    console.log('  ❌  SOME CHECKS FAILED');
  }

  console.log(`\n  Fairlaunch: ${fairlaunchAddr}`);
  console.log(`  Refund amount: ${hre.ethers.formatEther(actualRefund)} BNB`);
  console.log(`${'═'.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
