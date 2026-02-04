const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

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
  logSection('🚀 FAIRLAUNCH TESTNET DEPLOYMENT');

  const network = hre.network.name;
  log(`📡 Network: ${network}`, 'cyan');

  const [deployer] = await hre.ethers.getSigners();
  log(`👷 Deployer: ${deployer.address}`, 'blue');

  const deployerBalance = await hre.ethers.provider.getBalance(deployer.address);
  log(`💰 Balance: ${hre.ethers.formatEther(deployerBalance)} ETH`, 'green');

  if (deployerBalance === 0n) {
    log('❌ ERROR: Deployer has no balance!', 'red');
    process.exit(1);
  }

  // Deployment config
  const deploymentFee = hre.ethers.parseEther('0.01'); // 0.01 ETH for testnets
  
  const deployments = {};

  // ============================================
  // 1. Deploy MockFeeSplitter
  // ============================================
  logSection('1️⃣  Deploying MockFeeSplitter');

  const MockFeeSplitter = await hre.ethers.getContractFactory(
    'contracts/mocks/MockFeeSplitter.sol:MockFeeSplitter'
  );
  log('📦 Deploying MockFeeSplitter...', 'yellow');

  const feeSplitter = await MockFeeSplitter.deploy();
  await feeSplitter.waitForDeployment();
  const feeSplitterAddress = await feeSplitter.getAddress();
  deployments.feeSplitter = feeSplitterAddress;

  log(`✅ MockFeeSplitter deployed to: ${feeSplitterAddress}`, 'green');

  // ============================================
  // 2. Deploy FairlaunchFactory
  // ============================================
  logSection('2️⃣  Deploying FairlaunchFactory');

  const FairlaunchFactory = await hre.ethers.getContractFactory('FairlaunchFactory');
  log('📦 Deploying FairlaunchFactory...', 'yellow');

  const factory = await FairlaunchFactory.deploy(
    deploymentFee,
    feeSplitterAddress,
    deployer.address, // Treasury = deployer for testing
    deployer.address  // Admin = deployer for testing
  );

  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  deployments.fairlaunchFactory = factoryAddress;

  log(`✅ FairlaunchFactory deployed to: ${factoryAddress}`, 'green');

  // Wait for confirmations
  const confirmations = 5;
  log(`⏳ Waiting for ${confirmations} confirmations...`, 'yellow');
  await factory.deploymentTransaction().wait(confirmations);
  log('✅ Confirmed!', 'green');

  // ============================================
  // 3. Verify Contracts
  // ============================================
  if (process.env.VERIFY_CONTRACTS === 'true' && network !== 'hardhat') {
    logSection('3️⃣  Verifying Contracts');

    log('⏳ Waiting 30s for explorer to index...', 'yellow');
    await new Promise((resolve) => setTimeout(resolve, 30000));

    try {
      log('🔍 Verifying MockFeeSplitter...', 'yellow');
      await hre.run('verify:verify', {
        address: feeSplitterAddress,
        constructorArguments: [],
      });
      log('✅ MockFeeSplitter verified!', 'green');
    } catch (error) {
      log(`⚠️  MockFeeSplitter verification failed: ${error.message}`, 'yellow');
    }

    try {
      log('🔍 Verifying FairlaunchFactory...', 'yellow');
      await hre.run('verify:verify', {
        address: factoryAddress,
        constructorArguments: [
          deploymentFee,
          feeSplitterAddress,
          deployer.address,
          deployer.address,
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
    sepolia: 'https://sepolia.etherscan.io',
    base_sepolia: 'https://sepolia.basescan.org',
    bsc_testnet: 'https://testnet.bscscan.com',
  }[network] || 'https://etherscan.io';

  const deploymentInfo = {
    network: network,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      fairlaunchFactory: factoryAddress,
      feeSplitter: feeSplitterAddress,
    },
    config: {
      deploymentFee: hre.ethers.formatEther(deploymentFee),
      treasuryVault: deployer.address,
      adminExecutor: deployer.address,
    },
    explorer: explorerBaseUrl,
  };

  const outputDir = './deployments';
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
  console.log('');
  log(`FairlaunchFactory: ${factoryAddress}`, 'green');
  log(`MockFeeSplitter: ${feeSplitterAddress}`, 'green');
  console.log('');
  log(`🔗 View on Explorer:`, 'yellow');
  log(`   Factory: ${explorerBaseUrl}/address/${factoryAddress}`, 'blue');
  log(`   FeeSplitter: ${explorerBaseUrl}/address/${feeSplitterAddress}`, 'blue');
  console.log('');
  log(`💾 Saved to: ${filepath}`, 'cyan');
  console.log('');

  log('🎉 Deployment successful!', 'green');
  console.log('');
  log('📌 Update frontend config:', 'yellow');
  log(`   bsc_testnet: '${factoryAddress}',`, 'blue');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
