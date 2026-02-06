// Deploy FairlaunchFactory to BSC Testnet with LP Locker integration
// Usage: npx hardhat run scripts/deploy-fairlaunch-factory-bsctestnet.ts --network bscTestnet

import { ethers } from 'hardhat';

async function main() {
  console.log('🚀 Deploying FairlaunchFactory to BSC Testnet (LP Locker Version)...\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer address:', deployer.address);
  console.log(
    'Deployer balance:',
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    'BNB\n'
  );

  // Configuration
  // 0.2 BNB for BSC Testnet
  const DEPLOYMENT_FEE = ethers.parseEther('0.2');

  // Existing contract addresses (from previous deployments)
  const FEE_SPLITTER = '0x2672af17eA89bc5e46BB52385C45Cb42e5eC8C48';
  const TREASURY_WALLET = '0x95D94D86CfC550897d2b80672a3c94c12429a90D';
  const ADMIN_EXECUTOR = '0x95D94D86CfC550897d2b80672a3c94c12429a90D';

  console.log('Configs:');
  console.log('- Deployment Fee:', ethers.formatEther(DEPLOYMENT_FEE), 'BNB');
  console.log('- Fee Splitter:', FEE_SPLITTER);
  console.log('- Treasury:', TREASURY_WALLET);
  console.log('- Admin Executor:', ADMIN_EXECUTOR);

  console.log('\n📝 Deploying FairlaunchFactory...');

  const FairlaunchFactory = await ethers.getContractFactory('FairlaunchFactory');
  const factory = await FairlaunchFactory.deploy(
    DEPLOYMENT_FEE,
    FEE_SPLITTER,
    TREASURY_WALLET,
    ADMIN_EXECUTOR
  );

  console.log('⏳ Awaiting deployment confirmation...');
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  console.log('✅ FairlaunchFactory deployed to:', factoryAddress);
  console.log('\n📊 Deployment Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Network: BSC Testnet');
  console.log('FairlaunchFactory:', factoryAddress);
  console.log('FeeSplitter:', FEE_SPLITTER);
  console.log('Treasury Wallet:', TREASURY_WALLET);
  console.log('Admin Executor:', ADMIN_EXECUTOR);
  console.log('Deployment Fee:', ethers.formatEther(DEPLOYMENT_FEE), 'BNB');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Next steps:');
  console.log(
    '1. Update apps/web/.env.local with NEXT_PUBLIC_FAIRLAUNCH_FACTORY_BSC_TESTNET=' +
      factoryAddress
  );
  console.log('2. Update packages/contracts/deployments/fairlaunch-factory-latest.json');
  console.log('3. Update apps/web/src/contracts/FairlaunchFactory.ts');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
