const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

/**
 * Deploy PresaleFactory v2.4 with LP support
 *
 * Steps:
 *   1. Deploy MockLPLocker (or skip if already deployed)
 *   2. Deploy PresaleFactory V2.4 (feeSplitter, timelock, dexRouter, lpLocker)
 *   3. Configure roles
 *   4. Verify on BSCScan
 *   5. Save deployment info with deploy block
 *
 * Usage:
 *   npx hardhat run scripts/std-presale/deploy-factory-v2.4.js --network bscTestnet
 */

// ─── Config ───
const PANCAKE_ROUTER_TESTNET = '0xD99D1c33F9fC3444f8101754aBC46c52416550D1';

function log(msg) {
  console.log(msg);
}

async function main() {
  log('\n🚀 PRESALE FACTORY v2.4 DEPLOYMENT (LP + Phase-Based Finalization)\n');

  const network = hre.network.name;
  log(`📡 Network: ${network}`);

  const [deployer, admin] = await hre.ethers.getSigners();
  log(`👷 Deployer: ${deployer.address}`);
  if (admin) log(`👑 Admin:    ${admin.address}`);
  log('');

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  log(`💰 Deployer Balance: ${hre.ethers.formatEther(balance)} tBNB\n`);

  if (balance === 0n) {
    log('❌ No balance! Fund your wallet first.');
    process.exit(1);
  }

  // ─── Environment Variables ───
  const feeSplitterAddr = process.env.FEE_SPLITTER_ADDRESS;
  const timelockAddr = process.env.TIMELOCK_ADDRESS;
  const dexRouterAddr = process.env.DEX_ROUTER_ADDRESS || PANCAKE_ROUTER_TESTNET;

  if (!feeSplitterAddr) {
    log('❌ Missing FEE_SPLITTER_ADDRESS in .env');
    process.exit(1);
  }
  if (!timelockAddr) {
    log('❌ Missing TIMELOCK_ADDRESS in .env');
    process.exit(1);
  }

  log('📋 Configuration:');
  log(`   FeeSplitter:  ${feeSplitterAddr}`);
  log(`   Timelock:     ${timelockAddr}`);
  log(`   DEX Router:   ${dexRouterAddr}\n`);

  // ════════════════════════════════════════
  // STEP 1: Deploy MockLPLocker
  // ════════════════════════════════════════
  let lpLockerAddr = process.env.LP_LOCKER_ADDRESS;

  if (!lpLockerAddr) {
    log('1️⃣  Deploying MockLPLocker...');
    const LPLocker = await hre.ethers.getContractFactory('MockLPLocker');
    const lpLocker = await LPLocker.deploy();
    await lpLocker.waitForDeployment();
    lpLockerAddr = await lpLocker.getAddress();
    log(`   ✅ MockLPLocker: ${lpLockerAddr}`);

    const lpTx = lpLocker.deploymentTransaction();
    if (lpTx) {
      const receipt = await lpTx.wait(3);
      log(`   Confirmed (3 blocks) — block: ${receipt.blockNumber}\n`);
    }
  } else {
    log(`1️⃣  Using existing LPLocker: ${lpLockerAddr}\n`);
  }

  // ════════════════════════════════════════
  // STEP 2: Deploy PresaleFactory V2.4
  // ════════════════════════════════════════
  log('2️⃣  Deploying PresaleFactory v2.4...');
  const Factory = await hre.ethers.getContractFactory('PresaleFactory');
  const factory = await Factory.deploy(
    feeSplitterAddr,
    timelockAddr,
    dexRouterAddr,
    lpLockerAddr
  );
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  log(`   ✅ PresaleFactory: ${factoryAddr}`);

  const factoryTx = factory.deploymentTransaction();
  let deployBlock = 0;
  if (factoryTx) {
    const receipt = await factoryTx.wait(3);
    deployBlock = receipt.blockNumber;
    log(`   Confirmed (3 blocks) — deploy block: ${deployBlock}\n`);
  }

  // ════════════════════════════════════════
  // STEP 3: Configure Roles
  // ════════════════════════════════════════
  log('3️⃣  Configuring Roles...');

  // Grant FACTORY_ADMIN_ROLE to admin on factory
  const adminSigner = admin || deployer;
  if (admin && admin.address !== deployer.address) {
    const tx = await factory.connect(deployer).grantRole(
      await factory.FACTORY_ADMIN_ROLE(),
      admin.address
    );
    await tx.wait();
    log(`   ✅ Admin (${admin.address}) → Factory FACTORY_ADMIN_ROLE`);
  }

  // Grant factory DEFAULT_ADMIN on FeeSplitter so factory can grantPresaleRole
  try {
    const FeeSplitter = await hre.ethers.getContractFactory('FeeSplitter');
    const feeSplitter = FeeSplitter.attach(feeSplitterAddr);
    const fsTx = await feeSplitter.connect(adminSigner).grantRole(
      await feeSplitter.DEFAULT_ADMIN_ROLE(),
      factoryAddr
    );
    await fsTx.wait();
    log(`   ✅ Factory → FeeSplitter DEFAULT_ADMIN_ROLE`);
  } catch (e) {
    log(`   ⚠️ FeeSplitter role grant failed: ${e.message}`);
    log(`   ℹ️ You may need to grant this manually if deployer != FeeSplitter admin`);
  }

  log('');

  // ════════════════════════════════════════
  // STEP 4: Verify on BSCScan
  // ════════════════════════════════════════
  if (network !== 'hardhat' && network !== 'localhost') {
    log('4️⃣  Verifying on BSCScan...');
    await new Promise((r) => setTimeout(r, 20000));

    // Verify MockLPLocker
    if (!process.env.LP_LOCKER_ADDRESS) {
      try {
        await hre.run('verify:verify', {
          address: lpLockerAddr,
          constructorArguments: [],
        });
        log('   ✅ MockLPLocker verified');
      } catch (e) {
        log(`   ⚠️ MockLPLocker verify: ${e.message}`);
      }
    }

    // Verify Factory
    try {
      await hre.run('verify:verify', {
        address: factoryAddr,
        constructorArguments: [feeSplitterAddr, timelockAddr, dexRouterAddr, lpLockerAddr],
      });
      log('   ✅ PresaleFactory verified');
    } catch (e) {
      log(`   ⚠️ Factory verify: ${e.message}`);
    }
    console.log('');
  }

  // ════════════════════════════════════════
  // STEP 5: Save Deployment Info
  // ════════════════════════════════════════
  const deployInfo = {
    version: '2.4',
    network,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    timestamp: new Date().toISOString(),
    deployBlock,
    deployer: deployer.address,
    admin: adminSigner.address,
    contracts: {
      factory: factoryAddr,
      feeSplitter: feeSplitterAddr,
      lpLocker: lpLockerAddr,
      dexRouter: dexRouterAddr,
      timelock: timelockAddr,
    },
    previousVersion: {
      version: '2.3',
      factory: '0xb6AB0db764dF5Ae4BBE8464289A22F5AcE0DdcAB',
      feeSplitter: '0xDCE874B2E99C6318Dc88157DA313Cc11D957d2aF',
    },
    changes: [
      'V2.4: Phase-based finalization with FinalizeSnapshot + 4 phase flags',
      'V2.4: LP creation via PancakeRouter + LP lock via ILPLocker',
      'V2.4: FINALIZING status for retry safety',
      'V2.4: sweepExcess for admin cleanup of stray native tokens',
      'V2.4: InsufficientTokenBudget guard (vesting + LP + burn <= balance)',
      'V2.4: Fee-before-LP enforcement via FeeNotDone/LPNotDone guards',
      'V2.4: Owner payout computed from snapshot, not address(this).balance',
    ],
  };

  const outputDir = './deployments';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const filename = `presale-v2.4-${network}-${Date.now()}.json`;
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deployInfo, null, 2));

  log('════════════════════════════════════════');
  log('✅ V2.4 DEPLOYMENT COMPLETE!');
  log('════════════════════════════════════════\n');
  log(`MockLPLocker:     ${lpLockerAddr}`);
  log(`PresaleFactory:   ${factoryAddr}`);
  log(`FeeSplitter:      ${feeSplitterAddr}`);
  log(`DEX Router:       ${dexRouterAddr}`);
  log(`Deploy Block:     ${deployBlock}`);
  log(`\n🔗 Explorer:`);
  log(`   https://testnet.bscscan.com/address/${lpLockerAddr}`);
  log(`   https://testnet.bscscan.com/address/${factoryAddr}`);
  log(`\n💾 Saved to: ${filepath}`);
  log(`\n⚠️  UPDATE these addresses:`);
  log(`   1. apps/web/src/actions/admin/deploy-presale.ts → FACTORY_ADDRESSES['97']`);
  log(`   2. packages/contracts/.env → LP_LOCKER_ADDRESS (optional cache)`);
  log(`   3. DB/config → factory_address + deploy_block for event range\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
