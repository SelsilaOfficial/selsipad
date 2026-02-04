const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

// Color codes for console output
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
  logSection('🚀 FAIRLAUNCH CONTRACTS DEPLOYMENT');

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
    log('❌ ERROR: Deployer has no balance! Fund your wallet first.', 'red');
    process.exit(1);
  }

  // Load environment config
  const config = {
    treasuryVault: process.env.TREASURY_VAULT_ADDRESS,
    feeSplitterAddress: process.env.FEE_SPLITTER_ADDRESS, // Reuse existing FeeSplitter
    adminExecutor: process.env.TIMELOCK_ADDRESS || admin.address,
    
    // Deployment fee based on network
    deploymentFee:
      network === 'bsc_testnet' || network === 'bsc'
        ? hre.ethers.parseEther('0.2') // 0.2 BNB for BSC
        : hre.ethers.parseEther('0.1'), // 0.1 ETH for ETH/Base
  };

  // Validate addresses
  if (!hre.ethers.isAddress(config.treasuryVault)) {
    log('❌ ERROR: Invalid treasury vault address in .env', 'red');
    process.exit(1);
  }

  if (!hre.ethers.isAddress(config.feeSplitterAddress)) {
    log('❌ ERROR: Invalid FeeSplitter address in .env', 'red');
    log('   Deploy FeeSplitter first or set FEE_SPLITTER_ADDRESS in .env', 'yellow');
    process.exit(1);
  }

  log('\n📋 Configuration:', 'yellow');
  log(`   Treasury Vault: ${config.treasuryVault}`, 'blue');
  log(`   FeeSplitter: ${config.feeSplitterAddress}`, 'blue');
  log(
    `   Deployment Fee: ${hre.ethers.formatEther(config.deploymentFee)} ${
      network === 'bsc_testnet' ? 'BNB' : 'ETH'
    }`,
    'blue'
  );
  log(`   Admin Executor: ${config.adminExecutor}`, 'blue');

  const deployments = {};

  // ============================================
  // 1. Deploy FairlaunchFactory
  // ============================================
  logSection('1️⃣  Deploying FairlaunchFactory');

  const FairlaunchFactory = await hre.ethers.getContractFactory('FairlaunchFactory');
  log('📦 Deploying contract...', 'yellow');

  const factory = await FairlaunchFactory.deploy(
    config.deploymentFee,
    config.feeSplitterAddress,
    config.treasuryVault,
    config.adminExecutor
  );

  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  deployments.fairlaunchFactory = factoryAddress;

  log(`✅ FairlaunchFactory deployed to: ${factoryAddress}`, 'green');

  // Wait for confirmations
  const confirmations = parseInt(process.env.CONFIRMATIONS || '5');
  log(`⏳ Waiting for ${confirmations} confirmations...`, 'yellow');
  await factory.deploymentTransaction().wait(confirmations);
  log('✅ Confirmed!', 'green');

  // ============================================
  // 2. Verify Contracts
  // ============================================
  if (process.env.VERIFY_CONTRACTS === 'true' && network !== 'hardhat') {
    logSection('2️⃣  Verifying Contracts on Explorer');

    // Wait a bit for explorer to index
    log('⏳ Waiting 30s for explorer to index...', 'yellow');
    await new Promise((resolve) => setTimeout(resolve, 30000));

    try {
      log('🔍 Verifying FairlaunchFactory...', 'yellow');
      await hre.run('verify:verify', {
        address: factoryAddress,
        constructorArguments: [
          config.deploymentFee,
          config.feeSplitterAddress,
          config.treasuryVault,
          config.adminExecutor,
        ],
      });
      log('✅ FairlaunchFactory verified!', 'green');
    } catch (error) {
      log(`⚠️  Verification failed: ${error.message}`, 'yellow');
    }
  }

  // ============================================
  // 3. Save Deployment Info
  // ============================================
  logSection('3️⃣  Saving Deployment Info');

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
      fairlaunchFactory: factoryAddress,
      feeSplitter: config.feeSplitterAddress, // Reference only
    },
    config: {
      deploymentFee: hre.ethers.formatEther(config.deploymentFee),
      treasuryVault: config.treasuryVault,
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
  log(`FairlaunchFactory: ${factoryAddress}`, 'green');
  log(`FeeSplitter (existing): ${config.feeSplitterAddress}`, 'blue');
  console.log('');
  log(`🔗 View on Explorer:`, 'yellow');
  log(`   ${explorerBaseUrl}/address/${factoryAddress}`, 'blue');
  console.log('');
  log(`💾 Config saved to: ${filepath}`, 'cyan');
  console.log('');

  log('🎉 Fairlaunch contracts deployed successfully!', 'green');
  log('', '');
  log('📌 Next Steps:', 'yellow');
  log('   1. Update CONTRACT_ADDRESSES in frontend (apps/web/lib/contracts/addresses.ts)', 'blue');
  log('   2. Test deployment with a sample Fairlaunch creation', 'blue');
  log('   3. Set up indexer to track Fairlaunch events', 'blue');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
