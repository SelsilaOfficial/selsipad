/**
 * Full E2E Test — Launch, Buy, Sell, Migrate, Claim Referral
 * Uses the FIXED factory: 0xb6C19A63624fD155Eb31934719750Ecc7A62390E
 * Sets migration threshold to 0.05 BNB to test with limited tBNB.
 *
 * Usage:
 *   npx hardhat run scripts/bonding-curve/e2e-full-test.js --network bscTestnet
 */

const hre = require('hardhat');

const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};
function log(m, color = 'reset') {
  console.log(`${c[color]}${m}${c.reset}`);
}
function sec(t) {
  console.log('\n' + '═'.repeat(60));
  log(t, 'bright');
  console.log('═'.repeat(60));
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const FACTORY = '0x06bD6D32Ef98DC1EC07B443758C6c1eB80E17E2c';

const UNI_FACTORY_ABI = ['function getPair(address,address) view returns (address)'];
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
];

async function main() {
  sec('🧪 FULL E2E TEST — SelsipadBondingCurveFactory v2');

  const [deployer, referrer] = await hre.ethers.getSigners();
  log(`👷 Deployer:  ${deployer.address}`, 'blue');
  const refAddr = referrer ? referrer.address : deployer.address;
  log(`👤 Referrer:  ${refAddr}`, 'blue');
  const bal = await hre.ethers.provider.getBalance(deployer.address);
  log(`💰 Balance:   ${hre.ethers.formatEther(bal)} BNB`, 'green');

  const factory = await hre.ethers.getContractAt('SelsipadBondingCurveFactory', FACTORY, deployer);

  // ── STEP 0: Lower threshold to 0.05 BNB ──
  sec('0️⃣  SET MIGRATION THRESHOLD = 0.05 BNB');
  const newThreshold = hre.ethers.parseEther('0.05');
  const tx0 = await factory.setMigrationThreshold(newThreshold);
  await tx0.wait();
  log(
    `✅ Threshold set to ${hre.ethers.formatEther(await factory.migrationThreshold())} BNB`,
    'green'
  );
  await sleep(2000);

  // ── STEP 1: Launch Token (with 0.05 BNB create fee + 0.01 BNB initial buy) ──
  sec('1️⃣  LAUNCH TOKEN');
  const createFee = hre.ethers.parseEther('0.05');
  const initBuy = hre.ethers.parseEther('0.01');
  const totalValue = createFee + initBuy; // 0.06 BNB total
  log(`📝 Launching "BC Test V3" (BCV3) with 0.05 BNB fee + 0.01 BNB initial buy...`, 'yellow');

  const tx1 = await factory.launchToken('BC Test V3', 'BCV3', refAddr, { value: totalValue });
  const r1 = await tx1.wait();
  log(`✅ tx: ${r1.hash}`, 'green');

  // Parse TokenLaunched event
  let tokenAddress;
  for (const l of r1.logs) {
    try {
      const p = factory.interface.parseLog({ topics: l.topics, data: l.data });
      if (p?.name === 'TokenLaunched') {
        tokenAddress = p.args[0];
        break;
      }
    } catch {}
  }
  log(`🪙 Token: ${tokenAddress}`, 'green');

  const token = new hre.ethers.Contract(tokenAddress, ERC20_ABI, deployer);
  log(
    `   Deployer tokens: ${hre.ethers.formatEther(await token.balanceOf(deployer.address))}`,
    'cyan'
  );

  let info = await factory.tokens(tokenAddress);
  log(`   rReserveEth: ${hre.ethers.formatEther(info.rReserveEth)}`, 'blue');
  log(`   Progress: ${Number(await factory.getMigrationProgress(tokenAddress)) / 100}%`, 'yellow');
  await sleep(2000);

  // ── STEP 2: Buy more tokens ──
  sec('2️⃣  BUY 0.02 BNB');
  const tx2 = await factory.buyToken(tokenAddress, refAddr, {
    value: hre.ethers.parseEther('0.02'),
  });
  const r2 = await tx2.wait();
  log(`✅ tx: ${r2.hash}`, 'green');

  info = await factory.tokens(tokenAddress);
  log(`   rReserveEth: ${hre.ethers.formatEther(info.rReserveEth)}`, 'blue');
  log(`   Progress: ${Number(await factory.getMigrationProgress(tokenAddress)) / 100}%`, 'yellow');
  log(
    `   Deployer tokens: ${hre.ethers.formatEther(await token.balanceOf(deployer.address))}`,
    'cyan'
  );
  log(
    `   Ref reward: ${hre.ethers.formatEther(await factory.referralRewards(tokenAddress, refAddr))} BNB`,
    'cyan'
  );
  await sleep(2000);

  // ── STEP 3: Sell some tokens ──
  sec('3️⃣  SELL 500,000 TOKENS');
  const sellAmt = hre.ethers.parseEther('500000');
  const curBal = await token.balanceOf(deployer.address);
  if (curBal >= sellAmt) {
    await (await token.approve(FACTORY, sellAmt)).wait();
    const tx3 = await factory.sellToken(tokenAddress, sellAmt, refAddr);
    const r3 = await tx3.wait();
    log(`✅ Sell tx: ${r3.hash}`, 'green');
    info = await factory.tokens(tokenAddress);
    log(`   rReserveEth after sell: ${hre.ethers.formatEther(info.rReserveEth)}`, 'blue');
  } else {
    log('⚠️  Balance too low to sell 500k tokens', 'yellow');
  }
  await sleep(2000);

  // ── STEP 4: Buy to trigger migration ──
  sec('4️⃣  BUY TO TRIGGER MIGRATION');
  info = await factory.tokens(tokenAddress);
  if (info.liquidityMigrated) {
    log('⚠️  Already migrated!', 'yellow');
  } else {
    const threshold = await factory.migrationThreshold();
    const remaining = threshold - info.rReserveEth;
    const buyForMig =
      remaining > 0n ? (remaining * 10300n) / 10000n : hre.ethers.parseEther('0.01');

    log(`   Remaining to threshold: ${hre.ethers.formatEther(remaining)} BNB`, 'blue');
    log(`📝 Buying ${hre.ethers.formatEther(buyForMig)} BNB to trigger migration...`, 'yellow');

    try {
      const tx4 = await factory.buyToken(tokenAddress, refAddr, {
        value: buyForMig,
        gasLimit: 5_000_000,
      });
      const r4 = await tx4.wait();
      log(`✅ tx: ${r4.hash}`, 'green');
      log(`   Gas used: ${r4.gasUsed.toString()}`, 'blue');

      info = await factory.tokens(tokenAddress);
      if (info.liquidityMigrated) {
        log('🎉 MIGRATION SUCCESSFUL!', 'green');
      } else {
        log('❌ Migration did not trigger', 'red');
        log(`   rReserveEth: ${hre.ethers.formatEther(info.rReserveEth)}`, 'blue');
      }
    } catch (err) {
      log(`❌ Migration buy failed: ${err.shortMessage || err.message}`, 'red');
    }
  }
  await sleep(2000);

  // ── STEP 5: Verify LP Pair ──
  sec('5️⃣  VERIFY LP PAIR');
  info = await factory.tokens(tokenAddress);
  if (info.liquidityMigrated) {
    const routerAddr = await factory.uniswapRouter();
    const router = await hre.ethers.getContractAt(
      ['function factory() view returns (address)', 'function WETH() view returns (address)'],
      routerAddr,
      deployer
    );
    const dexFact = await router.factory();
    const weth = await router.WETH();
    const pf = new hre.ethers.Contract(dexFact, UNI_FACTORY_ABI, deployer);
    const pair = await pf.getPair(tokenAddress, weth);

    if (pair !== hre.ethers.ZeroAddress) {
      log(`✅ LP Pair: ${pair}`, 'green');
      log(`   🔗 https://testnet.bscscan.com/address/${pair}`, 'blue');
    } else {
      log('❌ LP pair not found!', 'red');
    }
  } else {
    log('⚠️  Not migrated — skipping', 'yellow');
  }
  await sleep(2000);

  // ── STEP 6: Claim referral ──
  sec('6️⃣  CLAIM REFERRAL REWARD');
  const reward = await factory.referralRewards(tokenAddress, refAddr);
  log(`   Pending reward: ${hre.ethers.formatEther(reward)} BNB`, 'cyan');

  if (!info.liquidityMigrated) {
    log('⚠️  Not migrated — claim blocked until 30-day timeout', 'yellow');
  } else if (reward === 0n) {
    log('⚠️  No rewards to claim', 'yellow');
  } else {
    const signer = referrer || deployer;
    const fAsClaimer = factory.connect(signer);
    try {
      const tx6 = await fAsClaimer.claimReferralReward(tokenAddress);
      const r6 = await tx6.wait();
      log(`✅ Claim tx: ${r6.hash}`, 'green');
      log(
        `   Remaining: ${hre.ethers.formatEther(await factory.referralRewards(tokenAddress, refAddr))} BNB`,
        'cyan'
      );
    } catch (err) {
      log(`❌ Claim failed: ${err.shortMessage || err.message}`, 'red');
    }
  }

  // ── SUMMARY ──
  sec('📊 FINAL SUMMARY');
  info = await factory.tokens(tokenAddress);
  log(`Token:     ${tokenAddress}`, 'cyan');
  log(`Migrated:  ${info.liquidityMigrated}`, info.liquidityMigrated ? 'green' : 'red');
  log(`Supply:    ${hre.ethers.formatEther(await token.totalSupply())}`, 'cyan');
  log(`Launched:  ${await factory.totalTokensLaunched()}`, 'blue');
  console.log('');
  log('🔗 Links:', 'yellow');
  log(`   Factory: https://testnet.bscscan.com/address/${FACTORY}`, 'blue');
  log(`   Token:   https://testnet.bscscan.com/address/${tokenAddress}`, 'blue');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
