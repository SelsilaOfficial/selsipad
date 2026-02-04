import { ethers } from 'hardhat';

/**
 * Deployment Script for BlueCheckRegistry
 *
 * Deploys to BSC Testnet with configured treasury and referral pool addresses
 */

async function main() {
  console.log('🚀 Deploying BlueCheckRegistry to BSC Testnet...\n');

  // Configuration
  const TREASURY_ADDRESS =
    process.env.TREASURY_VAULT_ADDRESS || '0xf87d43d64dab56c481483364ea46b0432a495805';
  const REFERRAL_POOL_ADDRESS =
    process.env.REFERRAL_POOL_VAULT_ADDRESS || '0x3e78cac12633b223e23d7d3db120a87968245842';

  // Initial BNB price: $600 per BNB (18 decimals)
  const INITIAL_BNB_PRICE = ethers.parseEther('600');

  console.log('📋 Deployment Configuration:');
  console.log('  Treasury:', TREASURY_ADDRESS);
  console.log('  Referral Pool:', REFERRAL_POOL_ADDRESS);
  console.log('  Initial BNB Price: $600\n');

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log('👤 Deploying with account:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('💰 Account balance:', ethers.formatEther(balance), 'BNB\n');

  // Deploy contract
  console.log('📝 Deploying BlueCheckRegistry...');
  const BlueCheckRegistry = await ethers.getContractFactory('BlueCheckRegistry');

  const blueCheckRegistry = await BlueCheckRegistry.deploy(
    TREASURY_ADDRESS,
    REFERRAL_POOL_ADDRESS,
    INITIAL_BNB_PRICE
  );

  await blueCheckRegistry.waitForDeployment();
  const contractAddress = await blueCheckRegistry.getAddress();

  console.log('✅ BlueCheckRegistry deployed to:', contractAddress);
  console.log('\n🔍 Verifying deployment...');

  // Verify deployment
  const treasury = await blueCheckRegistry.treasury();
  const referralPool = await blueCheckRegistry.referralPool();
  const manualPrice = await blueCheckRegistry.manualPriceBNB();
  const priceUSD = await blueCheckRegistry.PRICE_USD();
  const requiredBNB = await blueCheckRegistry.getRequiredBNB();

  console.log('\n✓ Contract State:');
  console.log('  Treasury:', treasury);
  console.log('  Referral Pool:', referralPool);
  console.log('  Manual BNB Price:', ethers.formatEther(manualPrice), 'USD');
  console.log('  Blue Check Price:', ethers.formatEther(priceUSD), 'USD');
  console.log('  Required BNB:', ethers.formatEther(requiredBNB), 'BNB');

  // Save deployment info
  const deploymentInfo = {
    network: 'BSC Testnet',
    chainId: 97,
    contractAddress: contractAddress,
    treasury: treasury,
    referralPool: referralPool,
    initialBNBPrice: ethers.formatEther(manualPrice),
    blueCheckPrice: ethers.formatEther(priceUSD),
    requiredBNB: ethers.formatEther(requiredBNB),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    transactionHash: blueCheckRegistry.deploymentTransaction()?.hash,
  };

  console.log('\n📄 Deployment Info:');
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save to file
  const fs = require('fs');
  fs.writeFileSync('./deployment-bluecheck-testnet.json', JSON.stringify(deploymentInfo, null, 2));

  console.log('\n💾 Deployment info saved to: deployment-bluecheck-testnet.json');

  console.log('\n🎯 Next Steps:');
  console.log('1. Verify contract on BSCScan:');
  console.log(
    `   npx hardhat verify --network bscTestnet ${contractAddress} "${TREASURY_ADDRESS}" "${REFERRAL_POOL_ADDRESS}" "${INITIAL_BNB_PRICE}"`
  );
  console.log('\n2. Update frontend contract address in:');
  console.log('   - apps/web/src/hooks/useBlueCheckPurchase.ts');
  console.log('   - apps/web/app/api/bluecheck/verify-purchase/route.ts');
  console.log('\n3. Test purchase flow on testnet');

  console.log('\n✨ Deployment Complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:');
    console.error(error);
    process.exit(1);
  });
