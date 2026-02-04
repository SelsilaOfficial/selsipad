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
  logSection('🚀 PRESALE CONTRACTS DEPLOYMENT');

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
    referralPoolVault: process.env.REFERRAL_POOL_VAULT_ADDRESS,
    sbtStakingVault: process.env.SBT_STAKING_VAULT_ADDRESS,
    timelockAddress: process.env.TIMELOCK_ADDRESS,
    feeTotalBps: parseInt(process.env.FEE_TOTAL_BPS || '500'),
    feeTreasuryBps: parseInt(process.env.FEE_TREASURY_BPS || '250'),
    feeReferralPoolBps: parseInt(process.env.FEE_REFERRAL_POOL_BPS || '200'),
    feeSbtStakingBps: parseInt(process.env.FEE_SBT_STAKING_BPS || '50'),
  };

  // Validate addresses
  if (
    !hre.ethers.isAddress(config.treasuryVault) ||
    !hre.ethers.isAddress(config.referralPoolVault) ||
    !hre.ethers.isAddress(config.sbtStakingVault) ||
    !hre.ethers.isAddress(config.timelockAddress)
  ) {
    log('❌ ERROR: Invalid vault or timelock addresses in .env', 'red');
    process.exit(1);
  }

  log('\n📋 Configuration:', 'yellow');
  log(`   Treasury Vault: ${config.treasuryVault}`, 'blue');
  log(`   Referral Pool: ${config.referralPoolVault}`, 'blue');
  log(`   SBT Staking: ${config.sbtStakingVault}`, 'blue');
  log(`   Timelock: ${config.timelockAddress}`, 'blue');
  log(`   Fee Total: ${config.feeTotalBps} BPS (${config.feeTotalBps / 100}%)`, 'blue');

  const deployments = {};

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

  // Wait for confirmations
  const confirmations = parseInt(process.env.CONFIRMATIONS || '5');
  log(`⏳ Waiting for ${confirmations} confirmations...`, 'yellow');
  await feeSplitter.deploymentTransaction().wait(confirmations);
  log('✅ Confirmed!', 'green');

  // ============================================
  // 2. Deploy PresaleFactory
  // ============================================
  logSection('2️⃣  Deploying PresaleFactory');

  const Factory = await hre.ethers.getContractFactory('PresaleFactory');
  log('📦 Deploying contract...', 'yellow');

  const factory = await Factory.deploy(feeSplitterAddress, config.timelockAddress);

  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  deployments.factory = factoryAddress;

  log(`✅ PresaleFactory deployed to: ${factoryAddress}`, 'green');

  log(`⏳ Waiting for ${confirmations} confirmations...`, 'yellow');
  await factory.deploymentTransaction().wait(confirmations);
  log('✅ Confirmed!', 'green');

  // ============================================
  // 3. Configure Roles
  // ============================================
  logSection('3️⃣  Configuring Roles');

  // Grant Factory admin role on FeeSplitter
  log('🔐 Granting DEFAULT_ADMIN_ROLE to Factory on FeeSplitter...', 'yellow');
  const feeSplitterWithAdmin = feeSplitter.connect(admin);
  const tx1 = await feeSplitterWithAdmin.grantRole(
    await feeSplitter.DEFAULT_ADMIN_ROLE(),
    factoryAddress
  );
  await tx1.wait();
  log('✅ Role granted!', 'green');

  // Grant ops role on Factory
  log('🔐 Granting FACTORY_ADMIN_ROLE to admin on Factory...', 'yellow');
  const factoryWithDeployer = factory.connect(deployer);
  const FACTORY_ADMIN_ROLE = await factory.FACTORY_ADMIN_ROLE();
  const tx2 = await factoryWithDeployer.grantRole(FACTORY_ADMIN_ROLE, admin.address);
  await tx2.wait();
  log('✅ Role granted!', 'green');

  // ============================================
  // 4. Verify Contracts
  // ============================================
  if (process.env.VERIFY_CONTRACTS === 'true' && network !== 'hardhat') {
    logSection('4️⃣  Verifying Contracts on BSCScan');

    // Wait a bit for BSCScan to index
    log('⏳ Waiting 30s for BSCScan to index...', 'yellow');
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
      log(`⚠️  Verification failed: ${error.message}`, 'yellow');
    }

    try {
      log('🔍 Verifying PresaleFactory...', 'yellow');
      await hre.run('verify:verify', {
        address: factoryAddress,
        constructorArguments: [feeSplitterAddress, config.timelockAddress],
      });
      log('✅ PresaleFactory verified!', 'green');
    } catch (error) {
      log(`⚠️  Verification failed: ${error.message}`, 'yellow');
    }
  }

  // ============================================
  // 5. Save Deployment Info
  // ============================================
  logSection('5️⃣  Saving Deployment Info');

  const deploymentInfo = {
    network: network,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    admin: admin.address,
    contracts: {
      feeSplitter: feeSplitterAddress,
      factory: factoryAddress,
    },
    config: config,
    explorer:
      network === 'bsc_testnet' ? `https://testnet.bscscan.com` : `https://sepolia.etherscan.io`,
  };

  const outputDir = process.env.DEPLOYMENT_OUTPUT_DIR || './deployments';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `${network}-${Date.now()}.json`;
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
  log(`PresaleFactory: ${factoryAddress}`, 'green');
  console.log('');
  log(`🔗 View on Explorer:`, 'yellow');
  log(`   ${deploymentInfo.explorer}/address/${feeSplitterAddress}`, 'blue');
  log(`   ${deploymentInfo.explorer}/address/${factoryAddress}`, 'blue');
  console.log('');
  log(`💾 Config saved to: ${filepath}`, 'cyan');
  console.log('');

  log('🎉 All contracts deployed and configured successfully!', 'green');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
