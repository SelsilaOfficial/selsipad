/**
 * E2E Test Script for SelsipadBondingCurveFactory on BSC Testnet
 *
 * Tests the full lifecycle:
 *   1. launchToken (create + optional initial buy)
 *   2. buyToken (multiple buys to approach migration)
 *   3. sellToken (sell some tokens)
 *   4. buyToken until migration threshold triggers auto-migration
 *   5. claimReferralReward (after migration)
 *   6. Verify LP pair on PancakeSwap
 *
 * Usage:
 *   npx hardhat run scripts/bonding-curve/e2e-test-bsc-testnet.js --network bscTestnet
 */

const hre = require('hardhat');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};
function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}
function logSection(title) {
  console.log('\n' + '═'.repeat(60));
  log(title, 'bright');
  console.log('═'.repeat(60));
}

const FACTORY_ADDRESS = '0x4fF7ED86972DD4762096044F1B6eDEad28FD5ADd';

// Minimal ABI for PancakeSwap Factory (to check LP pair)
const UNISWAP_FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) view returns (address pair)',
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
];

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  logSection('🧪 E2E TEST — SelsipadBondingCurveFactory');

  const network = hre.network.name;
  log(`📡 Network: ${network}`, 'cyan');

  const [deployer, secondWallet] = await hre.ethers.getSigners();
  log(`👷 Deployer (wallet 1): ${deployer.address}`, 'blue');

  const hasSecondWallet = !!secondWallet;
  if (hasSecondWallet) {
    log(`👤 Second wallet (referrer): ${secondWallet.address}`, 'blue');
  } else {
    log(`⚠️  Only 1 wallet available — referral test will use deployer as mock referrer`, 'yellow');
  }

  const bal = await hre.ethers.provider.getBalance(deployer.address);
  log(`💰 Deployer balance: ${hre.ethers.formatEther(bal)} BNB`, 'green');

  // Connect to factory
  const factory = await hre.ethers.getContractAt(
    'SelsipadBondingCurveFactory',
    FACTORY_ADDRESS,
    deployer
  );

  const treasuryWallet = await factory.treasuryWallet();
  const migrationThreshold = await factory.migrationThreshold();
  log(`🏦 Treasury: ${treasuryWallet}`, 'blue');
  log(`📊 Migration threshold: ${hre.ethers.formatEther(migrationThreshold)} BNB`, 'blue');

  // ════════════════════════════════════════════════════════════════
  // STEP 1: Launch Token
  // ════════════════════════════════════════════════════════════════
  logSection('1️⃣  LAUNCH TOKEN');

  const referrerAddress = hasSecondWallet ? secondWallet.address : deployer.address;
  const initialBuy = hre.ethers.parseEther('0.01'); // small initial buy

  log(`📝 Launching "Selsipad Test" (STEST) with initial buy of 0.01 BNB...`, 'yellow');
  log(`   Referrer: ${referrerAddress}`, 'blue');

  const launchTx = await factory.launchToken('Selsipad Test', 'STEST', referrerAddress, {
    value: initialBuy,
  });

  const launchReceipt = await launchTx.wait();
  log(`✅ Launch tx: ${launchReceipt.hash}`, 'green');

  // Find the token address from TokenLaunched event
  const launchEvent = launchReceipt.logs.find((l) => {
    try {
      return (
        factory.interface.parseLog({ topics: l.topics, data: l.data })?.name === 'TokenLaunched'
      );
    } catch {
      return false;
    }
  });

  let tokenAddress;
  if (launchEvent) {
    const parsed = factory.interface.parseLog({
      topics: launchEvent.topics,
      data: launchEvent.data,
    });
    tokenAddress = parsed.args[0]; // first indexed param = token address
    log(`🪙 Token deployed at: ${tokenAddress}`, 'green');
  } else {
    log('❌ Could not find TokenLaunched event!', 'red');
    process.exit(1);
  }

  // Check token details
  const token = new hre.ethers.Contract(tokenAddress, ERC20_ABI, deployer);
  const tokenName = await token.name();
  const tokenSymbol = await token.symbol();
  const deployerTokenBal = await token.balanceOf(deployer.address);
  log(`   Name: ${tokenName}, Symbol: ${tokenSymbol}`, 'cyan');
  log(`   Deployer token balance: ${hre.ethers.formatEther(deployerTokenBal)}`, 'cyan');

  // Check factory state
  const info = await factory.tokens(tokenAddress);
  log(`   vReserveEth:   ${hre.ethers.formatEther(info.vReserveEth)}`, 'blue');
  log(`   vReserveToken: ${hre.ethers.formatEther(info.vReserveToken)}`, 'blue');
  log(`   rReserveEth:   ${hre.ethers.formatEther(info.rReserveEth)}`, 'blue');
  log(`   Migrated: ${info.liquidityMigrated}`, 'blue');

  const progress1 = await factory.getMigrationProgress(tokenAddress);
  log(`   Migration progress: ${Number(progress1) / 100}%`, 'yellow');

  await sleep(3000);

  // ════════════════════════════════════════════════════════════════
  // STEP 2: Buy Tokens (multiple buys)
  // ════════════════════════════════════════════════════════════════
  logSection('2️⃣  BUY TOKENS');

  const buyAmount = hre.ethers.parseEther('0.05');
  log(`📝 Buying tokens for 0.05 BNB...`, 'yellow');

  const buyTx = await factory.buyToken(tokenAddress, referrerAddress, { value: buyAmount });
  const buyReceipt = await buyTx.wait();
  log(`✅ Buy tx: ${buyReceipt.hash}`, 'green');

  const deployerTokenBal2 = await token.balanceOf(deployer.address);
  log(`   Deployer token balance: ${hre.ethers.formatEther(deployerTokenBal2)}`, 'cyan');

  const info2 = await factory.tokens(tokenAddress);
  log(`   rReserveEth:   ${hre.ethers.formatEther(info2.rReserveEth)}`, 'blue');
  const progress2 = await factory.getMigrationProgress(tokenAddress);
  log(`   Migration progress: ${Number(progress2) / 100}%`, 'yellow');

  // Check referral reward accumulated
  const refReward = await factory.referralRewards(tokenAddress, referrerAddress);
  log(
    `   Referral reward accumulated for ${referrerAddress.slice(0, 10)}...: ${hre.ethers.formatEther(refReward)} BNB`,
    'cyan'
  );

  await sleep(3000);

  // ════════════════════════════════════════════════════════════════
  // STEP 3: Sell Tokens
  // ════════════════════════════════════════════════════════════════
  logSection('3️⃣  SELL TOKENS');

  const sellAmount = hre.ethers.parseEther('1000000'); // sell 1M tokens
  const currentBal = await token.balanceOf(deployer.address);

  if (currentBal >= sellAmount) {
    log(`📝 Approving ${hre.ethers.formatEther(sellAmount)} tokens...`, 'yellow');
    const approveTx = await token.approve(FACTORY_ADDRESS, sellAmount);
    await approveTx.wait();
    log(`✅ Approved`, 'green');

    log(`📝 Selling ${hre.ethers.formatEther(sellAmount)} tokens...`, 'yellow');
    const sellTx = await factory.sellToken(tokenAddress, sellAmount, referrerAddress);
    const sellReceipt = await sellTx.wait();
    log(`✅ Sell tx: ${sellReceipt.hash}`, 'green');

    const deployerTokenBal3 = await token.balanceOf(deployer.address);
    log(`   Deployer token balance: ${hre.ethers.formatEther(deployerTokenBal3)}`, 'cyan');

    const info3 = await factory.tokens(tokenAddress);
    log(`   rReserveEth after sell: ${hre.ethers.formatEther(info3.rReserveEth)}`, 'blue');
  } else {
    log(`⚠️  Skipping sell — balance too low (${hre.ethers.formatEther(currentBal)})`, 'yellow');
  }

  await sleep(3000);

  // ════════════════════════════════════════════════════════════════
  // STEP 4: Buy until Migration
  // ════════════════════════════════════════════════════════════════
  logSection('4️⃣  BUY UNTIL MIGRATION');

  const infoBeforeMigration = await factory.tokens(tokenAddress);

  if (infoBeforeMigration.liquidityMigrated) {
    log('⚠️  Already migrated from previous buys!', 'yellow');
  } else {
    const currentRealEth = infoBeforeMigration.rReserveEth;
    const remaining = migrationThreshold - currentRealEth;

    if (remaining > 0n) {
      // Add a little buffer for the fee that gets taken out
      const buyForMigration = (remaining * 10200n) / 10000n; // +2% buffer for fees
      const deployerBal = await hre.ethers.provider.getBalance(deployer.address);

      if (deployerBal < buyForMigration) {
        log(
          `❌ Not enough BNB! Need ~${hre.ethers.formatEther(buyForMigration)} BNB, have ${hre.ethers.formatEther(deployerBal)}`,
          'red'
        );
        log('   Skipping migration test. Fund the wallet and re-run.', 'yellow');
      } else {
        log(
          `📝 Buying for ~${hre.ethers.formatEther(buyForMigration)} BNB to trigger migration...`,
          'yellow'
        );
        log(`   (remaining to threshold: ${hre.ethers.formatEther(remaining)} BNB)`, 'blue');

        try {
          const migBuyTx = await factory.buyToken(tokenAddress, referrerAddress, {
            value: buyForMigration,
            gasLimit: 5_000_000, // higher gas for migration + addLiquidity
          });
          const migBuyReceipt = await migBuyTx.wait();
          log(`✅ Migration buy tx: ${migBuyReceipt.hash}`, 'green');

          // Check if migrated
          const infoAfter = await factory.tokens(tokenAddress);
          if (infoAfter.liquidityMigrated) {
            log('🎉 LIQUIDITY MIGRATED SUCCESSFULLY!', 'green');

            // Find LP pair
            const routerAddress = await factory.uniswapRouter();
            const router = await hre.ethers.getContractAt(
              [
                'function factory() view returns (address)',
                'function WETH() view returns (address)',
              ],
              routerAddress,
              deployer
            );
            const dexFactory = await router.factory();
            const weth = await router.WETH();

            const pairFactory = new hre.ethers.Contract(dexFactory, UNISWAP_FACTORY_ABI, deployer);
            const pairAddress = await pairFactory.getPair(tokenAddress, weth);
            log(`   LP Pair: ${pairAddress}`, 'cyan');
            log(`   🔗 https://testnet.bscscan.com/address/${pairAddress}`, 'blue');
          } else {
            log(
              '⚠️  Migration not triggered yet — rReserveEth may still be below threshold',
              'yellow'
            );
            const prog = await factory.getMigrationProgress(tokenAddress);
            log(`   Progress: ${Number(prog) / 100}%`, 'yellow');
          }
        } catch (err) {
          log(`❌ Migration buy failed: ${err.message}`, 'red');
        }
      }
    } else {
      log('⚠️  rReserveEth already exceeds threshold but not migrated?', 'yellow');
    }
  }

  await sleep(3000);

  // ════════════════════════════════════════════════════════════════
  // STEP 5: Claim Referral Reward
  // ════════════════════════════════════════════════════════════════
  logSection('5️⃣  CLAIM REFERRAL REWARD');

  const infoFinal = await factory.tokens(tokenAddress);
  const finalRefReward = await factory.referralRewards(tokenAddress, referrerAddress);

  if (!infoFinal.liquidityMigrated) {
    log('⚠️  Token not yet migrated — referral claim not yet available', 'yellow');
    log(`   Pending reward: ${hre.ethers.formatEther(finalRefReward)} BNB`, 'cyan');
  } else if (finalRefReward === 0n) {
    log('⚠️  No referral rewards to claim', 'yellow');
  } else {
    log(`📝 Claiming ${hre.ethers.formatEther(finalRefReward)} BNB referral reward...`, 'yellow');

    // Use the referrer wallet if available, else deployer
    const claimSigner = hasSecondWallet ? secondWallet : deployer;
    const factoryAsReferrer = factory.connect(claimSigner);

    try {
      const claimTx = await factoryAsReferrer.claimReferralReward(tokenAddress);
      const claimReceipt = await claimTx.wait();
      log(`✅ Claim tx: ${claimReceipt.hash}`, 'green');

      const afterClaim = await factory.referralRewards(tokenAddress, referrerAddress);
      log(`   Remaining reward: ${hre.ethers.formatEther(afterClaim)} BNB (should be 0)`, 'cyan');
    } catch (err) {
      log(`❌ Claim failed: ${err.message}`, 'red');
    }
  }

  // ════════════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════════════
  logSection('📊 TEST SUMMARY');

  const finalInfo = await factory.tokens(tokenAddress);
  const totalTokens = await factory.totalTokensLaunched();

  log(`Token:       ${tokenAddress}`, 'cyan');
  log(`Name:        ${tokenName} (${tokenSymbol})`, 'cyan');
  log(
    `Migrated:    ${finalInfo.liquidityMigrated}`,
    finalInfo.liquidityMigrated ? 'green' : 'yellow'
  );
  log(`rReserveEth: ${hre.ethers.formatEther(finalInfo.rReserveEth)}`, 'blue');
  log(`Total launched: ${totalTokens}`, 'blue');
  log(
    `Ref reward remaining: ${hre.ethers.formatEther(await factory.referralRewards(tokenAddress, referrerAddress))} BNB`,
    'blue'
  );

  console.log('');
  log('🔗 Explorer links:', 'yellow');
  log(`   Factory: https://testnet.bscscan.com/address/${FACTORY_ADDRESS}`, 'blue');
  log(`   Token:   https://testnet.bscscan.com/address/${tokenAddress}`, 'blue');
  console.log('');
  log('✅ E2E test complete!', 'green');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
