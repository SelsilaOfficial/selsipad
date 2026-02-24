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

// ─── Router addresses per network ───
const ROUTERS = {
  bscTestnet: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1', // PancakeSwap V2 Testnet
  bsc: '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap V2 Mainnet
  sepolia: '0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008', // Uniswap V2 Sepolia
  base_sepolia: '0x1689E7B1F10000AE47eBfE339a4f69dECd19F602', // Uniswap V2 Base Sepolia
};

async function main() {
  logSection('🚀 BONDING CURVE FACTORY DEPLOYMENT');

  const network = hre.network.name;
  log(`📡 Network: ${network}`, 'cyan');

  // Get signers
  const [deployer] = await hre.ethers.getSigners();
  log(`👷 Deployer: ${deployer.address}`, 'blue');

  // Check balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const nativeCoin = ['bscTestnet', 'bsc'].includes(network) ? 'BNB' : 'ETH';
  log(`💰 Deployer Balance: ${hre.ethers.formatEther(balance)} ${nativeCoin}`, 'green');

  if (balance === 0n) {
    log('❌ ERROR: Deployer has no balance! Fund your wallet first.', 'red');
    process.exit(1);
  }

  // Resolve router address
  const routerAddress = ROUTERS[network];
  if (!routerAddress) {
    log(`❌ ERROR: No router configured for network "${network}"`, 'red');
    log(`   Supported networks: ${Object.keys(ROUTERS).join(', ')}`, 'yellow');
    process.exit(1);
  }

  // Treasury wallet — reuse existing env variable
  const treasuryWallet = process.env.TREASURY_VAULT_ADDRESS || deployer.address;

  log('\n📋 Configuration:', 'yellow');
  log(`   Router:   ${routerAddress}`, 'blue');
  log(`   Treasury: ${treasuryWallet}`, 'blue');
  log(`   Migration Threshold: 1 ${nativeCoin} (default)`, 'blue');

  // ════════════════════════════════════════════
  // Deploy SelsipadBondingCurveFactory
  // ════════════════════════════════════════════
  logSection('1️⃣  Deploying SelsipadBondingCurveFactory');

  const Factory = await hre.ethers.getContractFactory('SelsipadBondingCurveFactory');
  log('📦 Deploying contract...', 'yellow');

  const factory = await Factory.deploy(routerAddress, treasuryWallet);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  log(`✅ SelsipadBondingCurveFactory deployed to: ${factoryAddress}`, 'green');

  // Wait for confirmations
  const confirmations = parseInt(process.env.CONFIRMATIONS || '5');
  log(`⏳ Waiting for ${confirmations} confirmations...`, 'yellow');
  await factory.deploymentTransaction().wait(confirmations);
  log('✅ Confirmed!', 'green');

  // ════════════════════════════════════════════
  // Verify Contract
  // ════════════════════════════════════════════
  if (process.env.VERIFY_CONTRACTS === 'true' && network !== 'hardhat') {
    logSection('2️⃣  Verifying Contract on Explorer');
    log('⏳ Waiting 30s for explorer to index...', 'yellow');
    await new Promise((r) => setTimeout(r, 30000));

    try {
      log('🔍 Verifying SelsipadBondingCurveFactory...', 'yellow');
      await hre.run('verify:verify', {
        address: factoryAddress,
        constructorArguments: [routerAddress, treasuryWallet],
      });
      log('✅ Contract verified!', 'green');
    } catch (error) {
      log(`⚠️  Verification failed: ${error.message}`, 'yellow');
    }
  }

  // ════════════════════════════════════════════
  // Save Deployment Info
  // ════════════════════════════════════════════
  logSection('3️⃣  Saving Deployment Info');

  const explorerBaseUrl =
    {
      bscTestnet: 'https://testnet.bscscan.com',
      bsc: 'https://bscscan.com',
      sepolia: 'https://sepolia.etherscan.io',
      base_sepolia: 'https://sepolia.basescan.org',
    }[network] || 'https://etherscan.io';

  const deploymentInfo = {
    network,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      bondingCurveFactory: factoryAddress,
    },
    config: {
      router: routerAddress,
      treasuryWallet,
      migrationThreshold: '1 ' + nativeCoin,
      tradeFee: '1.5%',
      referralSplit: '50% of fee (0.75%)',
    },
    explorer: explorerBaseUrl,
  };

  const outputDir = process.env.DEPLOYMENT_OUTPUT_DIR || './deployments';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `bonding-curve-${network}-${Date.now()}.json`;
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  log(`💾 Deployment info saved to: ${filepath}`, 'green');

  // ════════════════════════════════════════════
  // Summary
  // ════════════════════════════════════════════
  logSection('✅ DEPLOYMENT COMPLETE!');

  console.log('\n📝 Deployment Summary:\n');
  log(`Network:  ${network}`, 'cyan');
  log(`Chain ID: ${deploymentInfo.chainId}`, 'cyan');
  log(`Deployer: ${deployer.address}`, 'blue');
  console.log('');
  log(`SelsipadBondingCurveFactory: ${factoryAddress}`, 'green');
  log(`Router:                     ${routerAddress}`, 'blue');
  log(`Treasury:                   ${treasuryWallet}`, 'blue');
  console.log('');
  log(`🔗 View on Explorer:`, 'yellow');
  log(`   ${explorerBaseUrl}/address/${factoryAddress}`, 'blue');
  console.log('');
  log(`💾 Config saved to: ${filepath}`, 'cyan');
  console.log('');

  log('🎉 Bonding Curve factory deployed successfully!', 'green');
  log('', '');
  log('📌 Next Steps:', 'yellow');
  log('   1. Update CONTRACT_ADDRESSES in frontend', 'blue');
  log('   2. Test by launching a token: launchToken("Test", "TST", referrer)', 'blue');
  log('   3. Buy tokens until migration threshold is reached', 'blue');
  log('   4. Verify LP was created on DEX', 'blue');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
