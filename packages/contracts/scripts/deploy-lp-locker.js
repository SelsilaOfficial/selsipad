const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

/**
 * Deploy Unified LPLocker (shared by Presale + Fairlaunch)
 *
 * Usage:
 *   npx hardhat run scripts/deploy-lp-locker.js --network bscTestnet
 *   npx hardhat run scripts/deploy-lp-locker.js --network bscMainnet
 */

function log(msg) {
  console.log(msg);
}

async function main() {
  log('\n🔒 UNIFIED LP LOCKER DEPLOYMENT\n');

  const network = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();

  log(`📡 Network:  ${network}`);
  log(`👷 Deployer: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  log(
    `💰 Balance:  ${hre.ethers.formatEther(balance)} ${network.includes('bsc') ? 'BNB' : 'ETH'}\n`
  );

  if (balance === 0n) {
    log('❌ No balance! Fund your wallet first.');
    process.exit(1);
  }

  // ════════════════════════════════════════
  // STEP 1: Deploy LPLocker
  // ════════════════════════════════════════
  log('1️⃣  Deploying LPLocker (shared)...');
  const LPLocker = await hre.ethers.getContractFactory('contracts/shared/LPLocker.sol:LPLocker');
  const locker = await LPLocker.deploy();
  await locker.waitForDeployment();
  const lockerAddr = await locker.getAddress();
  log(`   ✅ LPLocker: ${lockerAddr}`);

  const deployTx = locker.deploymentTransaction();
  let deployBlock = 0;
  if (deployTx) {
    const receipt = await deployTx.wait(3);
    deployBlock = receipt.blockNumber;
    log(`   Confirmed (3 blocks) — block: ${deployBlock}\n`);
  }

  // ════════════════════════════════════════
  // STEP 2: Update existing PresaleFactory (if address provided)
  // ════════════════════════════════════════
  const presaleFactoryAddr = process.env.PRESALE_FACTORY_ADDRESS;
  if (presaleFactoryAddr) {
    log('2️⃣  Updating PresaleFactory LP Locker...');
    try {
      const factory = await hre.ethers.getContractAt(
        ['function setLPLocker(address _l) external'],
        presaleFactoryAddr,
        deployer
      );
      const tx = await factory.setLPLocker(lockerAddr);
      await tx.wait();
      log(`   ✅ PresaleFactory.setLPLocker(${lockerAddr})\n`);
    } catch (e) {
      log(`   ⚠️ Failed: ${e.message}`);
      log(`   ℹ️ You may need to call setLPLocker manually if deployer != admin\n`);
    }
  } else {
    log('2️⃣  Skipped PresaleFactory update (no PRESALE_FACTORY_ADDRESS in .env)\n');
  }

  // ════════════════════════════════════════
  // STEP 3: Verify on Explorer
  // ════════════════════════════════════════
  if (network !== 'hardhat' && network !== 'localhost') {
    log('3️⃣  Verifying on Explorer...');
    await new Promise((r) => setTimeout(r, 20000));

    try {
      await hre.run('verify:verify', {
        address: lockerAddr,
        constructorArguments: [],
      });
      log('   ✅ LPLocker verified on explorer!');
    } catch (e) {
      log(`   ⚠️ Verify: ${e.message}`);
    }
    log('');
  }

  // ════════════════════════════════════════
  // STEP 4: Save Deployment Info
  // ════════════════════════════════════════
  const chainId = (await hre.ethers.provider.getNetwork()).chainId.toString();
  const deployInfo = {
    contract: 'LPLocker (Unified)',
    version: '1.0',
    network,
    chainId,
    timestamp: new Date().toISOString(),
    deployBlock,
    deployer: deployer.address,
    address: lockerAddr,
    usage: [
      'Shared LP locker for Presale + Fairlaunch',
      'Call PresaleFactory.setLPLocker(address) to update',
      'Call Fairlaunch.setLPLocker(address) per-instance to update',
    ],
    nextSteps: [
      `Update PRESALE_FACTORY_ADDRESS in .env, then re-run to auto-update`,
      `Update LP_LOCKER_ADDRESS in .env: ${lockerAddr}`,
      `Update finalize-presale.ts and finalize-fairlaunch.ts with locker address`,
    ],
  };

  const outputDir = './deployments';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const filename = `lp-locker-${network}-${Date.now()}.json`;
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deployInfo, null, 2));

  log('════════════════════════════════════════');
  log('✅ LP LOCKER DEPLOYMENT COMPLETE!');
  log('════════════════════════════════════════\n');
  log(`LPLocker:     ${lockerAddr}`);
  log(`Chain:        ${chainId}`);
  log(`Deploy Block: ${deployBlock}`);

  const explorerBase =
    chainId === '56'
      ? 'https://bscscan.com'
      : chainId === '97'
      ? 'https://testnet.bscscan.com'
      : chainId === '8453'
      ? 'https://basescan.org'
      : 'https://etherscan.io';

  log(`\n🔗 Explorer: ${explorerBase}/address/${lockerAddr}`);
  log(`💾 Saved to: ${filepath}`);
  log(`\n⚠️  NEXT STEPS:`);
  log(`   1. Set .env: LP_LOCKER_ADDRESS=${lockerAddr}`);
  log(`   2. Update PresaleFactory: setLPLocker("${lockerAddr}")`);
  log(`   3. Update finalize-presale.ts: LP_LOCKER_ADDRESS`);
  log(`   4. Update finalize-fairlaunch.ts: LP_LOCKER_ADDRESS\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
