const hre = require('hardhat');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Explicitly load .env

// Color codes
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
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

async function main() {
  logSection('🚀 FAIRLAUNCH ECOSYSTEM DEPLOYMENT');

  const network = hre.network.name;
  log(`📡 Network: ${network}`, 'cyan');

  // Get signers
  const [deployer, admin] = await hre.ethers.getSigners();
  log(`👷 Deployer: ${deployer.address}`, 'blue');
  log(`👑 Admin: ${admin.address}`, 'blue');

  // Check balances
  const deployerBalance = await hre.ethers.provider.getBalance(deployer.address);
  log(
    `💰 Deployer Balance: ${hre.ethers.formatEther(deployerBalance)} ${
      network === 'bsc_testnet' ? 'tBNB' : 'ETH'
    }`,
    'green'
  );

  if (deployerBalance === 0n) {
    log('❌ ERROR: Deployer has no balance!', 'red');
    process.exit(1);
  }

  // For testnet, use deployer as treasury to avoid checksum issues
  const config = {
    treasuryVault: deployer.address,
    referralPoolVault: deployer.address,
    sbtStakingVault: deployer.address,
    adminExecutor: admin.address,
    deploymentFee:
      network === 'bsc_testnet' || network === 'bsc'
        ? hre.ethers.parseEther('0.2')
        : hre.ethers.parseEther('0.1'),
  };

  log('\n📋 Configuration:', 'yellow');
  log(`   Treasury: ${config.treasuryVault}`, 'blue');
  log(`   Referral Pool: ${config.referralPoolVault}`, 'blue');
  log(`   SBT Staking: ${config.sbtStakingVault}`, 'blue');
  log(`   Admin Executor: ${config.adminExecutor}`, 'blue');
  log(
    `   Deployment Fee: ${hre.ethers.formatEther(config.deploymentFee)} ${
      network === 'bsc_testnet' ? 'BNB' : 'ETH'
    }`,
    'blue'
  );

  const deployments = {};
  const confirmations = parseInt(process.env.CONFIRMATIONS || '5');

  // ============================================
  // 1. Deploy FeeSplitter
  // ============================================
  logSection('1️⃣  Deploying FeeSplitter');

  const FeeSplitter = await hre.ethers.getContractFactory('FeeSplitter');
  log('📦 Deploying contract...', 'yellow');

  const feeSplitter = await FeeSplitter.deploy(
    config.treasuryVault,
    config.referralPoolVault,
    config.sbtStakingVault,
    admin.address
  );

  await feeSplitter.waitForDeployment();
  const feeSplitterAddress = await feeSplitter.getAddress();
  deployments.feeSplitter = feeSplitterAddress;

  log(`✅ FeeSplitter deployed to: ${feeSplitterAddress}`, 'green');

  log(`⏳ Waiting for ${confirmations} confirmations...`, 'yellow');
  await feeSplitter.deploymentTransaction().wait(confirmations);
  log('✅ Confirmed!', 'green');

  // ============================================
  // 2. Deploy LPLocker
  // ============================================
  logSection('2️⃣  Deploying LPLocker');

  const LPLocker = await hre.ethers.getContractFactory('LPLocker');
  log('📦 Deploying LP Locker vault...', 'yellow');

  const lpLocker = await LPLocker.deploy();
  await lpLocker.waitForDeployment();
  const lpLockerAddress = await lpLocker.getAddress();
  deployments.lpLocker = lpLockerAddress;

  log(`✅ LPLocker deployed to: ${lpLockerAddress}`, 'green');

  log(`⏳ Waiting for ${confirmations} confirmations...`, 'yellow');
  await lpLocker.deploymentTransaction().wait(confirmations);
  log('✅ Confirmed!', 'green');

  // ============================================
  // 3. Deploy FairlaunchFactory
  // ============================================
  logSection('3️⃣  Deploying FairlaunchFactory');

  const FairlaunchFactory = await hre.ethers.getContractFactory('FairlaunchFactory');
  log('📦 Deploying contract...', 'yellow');

  const factory = await FairlaunchFactory.deploy(
    config.deploymentFee,
    feeSplitterAddress,
    config.treasuryVault,
    config.adminExecutor
  );

  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  deployments.fairlaunchFactory = factoryAddress;

  log(`✅ FairlaunchFactory deployed to: ${factoryAddress}`, 'green');

  log(`⏳ Waiting for ${confirmations} confirmations...`, 'yellow');
  await factory.deploymentTransaction().wait(confirmations);
  log('✅ Confirmed!', 'green');

  // ============================================
  // 3. Verify Contracts
  // ============================================
  if (process.env.VERIFY_CONTRACTS === 'true' && network !== 'hardhat') {
    logSection('3️⃣  Verifying Contracts on Explorer');

    log('⏳ Waiting 30s for explorer to index...', 'yellow');
    await new Promise((resolve) => setTimeout(resolve, 30000));

    try {
      log('🔍 Verifying FeeSplitter...', 'yellow');
      await hre.run('verify:verify', {
        address: feeSplitterAddress,
        constructorArguments: [
          config.treasuryVault,
          config.referralPoolVault,
          config.sbtStakingVault,
          admin.address,
        ],
      });
      log('✅ FeeSplitter verified!', 'green');
    } catch (error) {
      log(`⚠️  FeeSplitter verification failed: ${error.message}`, 'yellow');
    }

    try {
      log('🔍 Verifying FairlaunchFactory...', 'yellow');
      await hre.run('verify:verify', {
        address: factoryAddress,
        constructorArguments: [
          config.deploymentFee,
          feeSplitterAddress,
          config.treasuryVault,
          config.adminExecutor,
        ],
      });
      log('✅ FairlaunchFactory verified!', 'green');
    } catch (error) {
      log(`⚠️  FairlaunchFactory verification failed: ${error.message}`, 'yellow');
    }
  }

  // ============================================
  // 4. Save Deployment Info
  // ============================================
  logSection('4️⃣  Saving Deployment Info');

  const explorerBaseUrl = {
    bsc_testnet: 'https://testnet.bscscan.com',
    bsc: 'https://bscscan.com',
    sepolia: 'https://sepolia.etherscan.io',
    mainnet: 'https://etherscan.io',
    base: 'https://basescan.org',
    base_sepolia: 'https://sepolia.basescan.org',
  }[network] || 'https://etherscan.io';

  const deploymentInfo = {
    network: network,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    admin: admin.address,
    contracts: {
      feeSplitter: feeSplitterAddress,
      lpLocker: lpLockerAddress,
      fairlaunchFactory: factoryAddress,
    },
    config: {
      deploymentFee: hre.ethers.formatEther(config.deploymentFee),
      treasuryVault: config.treasuryVault,
      referralPoolVault: config.referralPoolVault,
      sbtStakingVault: config.sbtStakingVault,
      adminExecutor: config.adminExecutor,
    },
    explorer: explorerBaseUrl,
  };

  const outputDir = process.env.DEPLOYMENT_OUTPUT_DIR || './deployments';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `fairlaunch-${network}-${Date.now()}.json`;
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  log(`💾 Deployment info saved to: ${filepath}`, 'green');

  // ============================================
  // Summary
  // ============================================
  logSection('✅ DEPLOYMENT COMPLETE!');

  console.log('\n📝 Deployment Summary:\n');
  log(`Network: ${network}`, 'cyan');
  log(`Chain ID: ${deploymentInfo.chainId}`, 'cyan');
  log(`Deployer: ${deployer.address}`, 'blue');
  log(`Admin: ${admin.address}`, 'blue');
  console.log('');
  log(`FeeSplitter: ${feeSplitterAddress}`, 'green');
  log(`LPLocker: ${lpLockerAddress}`, 'green');
  log(`FairlaunchFactory: ${factoryAddress}`, 'green');
  console.log('');
  log(`🔗 View on Explorer:`, 'yellow');
  log(`   ${explorerBaseUrl}/address/${feeSplitterAddress}`, 'blue');
  log(`   ${explorerBaseUrl}/address/${lpLockerAddress}`, 'blue');
  log(`   ${explorerBaseUrl}/address/${factoryAddress}`, 'blue');
  console.log('');
  log(`💾 Config saved to: ${filepath}`, 'cyan');
  console.log('');

  log('🎉 Fairlaunch ecosystem deployed successfully!', 'green');
  log('', '');
  log('📌 Next Steps:', 'yellow');
  log('   1. Update .env: FEE_SPLITTER_ADDRESS=' + feeSplitterAddress, 'blue');
  log('   2. Update frontend CONTRACT_ADDRESSES config', 'blue');
  log('   3. Test deployment with sample Fairlaunch creation', 'blue');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
