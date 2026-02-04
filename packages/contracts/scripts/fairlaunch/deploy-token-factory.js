const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

async function main() {
  console.log('\n' + '='.repeat(60));
  log('🏭 SIMPLE TOKEN FACTORY DEPLOYMENT', 'cyan');
  console.log('='.repeat(60));

  const network = hre.network.name;
  log(`📡 Network: ${network}`, 'cyan');

  const [deployer] = await hre.ethers.getSigners();
  log(`👷 Deployer: ${deployer.address}`, 'blue');

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  log(`💰 Balance: ${hre.ethers.formatEther(balance)} ETH\n`, 'green');

  // Deployment config
  const creationFee = network.includes('bsc') 
    ? hre.ethers.parseEther('0.2')  // BSC: 0.2 BNB
    : hre.ethers.parseEther('0.01'); // Others: 0.01 ETH

  log(`⚙️  Configuration:`, 'yellow');
  log(`   Treasury: ${deployer.address}`, 'blue');
  log(`   Creation Fee: ${hre.ethers.formatEther(creationFee)} ETH\n`, 'blue');

  // Deploy
  console.log('='.repeat(60));
  log('📦 Deploying SimpleTokenFactory...', 'yellow');
  console.log('='.repeat(60));

  const SimpleTokenFactory = await hre.ethers.getContractFactory('SimpleTokenFactory');
  const factory = await SimpleTokenFactory.deploy(deployer.address, creationFee);

  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  log(`✅ SimpleTokenFactory deployed to: ${factoryAddress}`, 'green');

  // Wait for confirmations
  log(`⏳ Waiting for 5 confirmations...`, 'yellow');
  await factory.deploymentTransaction().wait(5);
  log('✅ Confirmed!\n', 'green');

  // Verify
  if (process.env.VERIFY_CONTRACTS === 'true' && network !== 'hardhat' && network !== 'localhost') {
    console.log('='.repeat(60));
    log('🔍 Verifying Contract...', 'yellow');
    console.log('='.repeat(60));

    log('⏳ Waiting 30s for explorer to index...', 'yellow');
    await new Promise((resolve) => setTimeout(resolve, 30000));

    try {
      await hre.run('verify:verify', {
        address: factoryAddress,
        constructorArguments: [deployer.address, creationFee],
      });
      log('✅ Contract verified!', 'green');
    } catch (error) {
      log(`⚠️  Verification failed: ${error.message}`, 'yellow');
    }
  }

  // Save deployment info
  console.log('\n' + '='.repeat(60));
  log('💾 Saving Deployment Info', 'yellow');
  console.log('='.repeat(60));

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
      simpleTokenFactory: factoryAddress,
    },
    config: {
      treasury: deployer.address,
      creationFee: hre.ethers.formatEther(creationFee),
    },
    explorer: `${explorerBaseUrl}/address/${factoryAddress}`,
  };

  const outputDir = './deployments';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `token-factory-${network}-${Date.now()}.json`;
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  log(`💾 Saved to: ${filepath}\n`, 'green');

  // Summary
  console.log('='.repeat(60));
  log('✅ DEPLOYMENT COMPLETE!', 'green');
  console.log('='.repeat(60));

  console.log('\n📝 Summary:\n');
  log(`Network: ${network}`, 'cyan');
  log(`Factory: ${factoryAddress}`, 'green');
  log(`Creation Fee: ${hre.ethers.formatEther(creationFee)} ETH`, 'blue');
  console.log('');
  log(`🔗 Explorer: ${explorerBaseUrl}/address/${factoryAddress}`, 'blue');
  console.log('');
  log(`📌 Update frontend config:`, 'yellow');
  log(`   ${network}: '${factoryAddress}',`, 'blue');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
