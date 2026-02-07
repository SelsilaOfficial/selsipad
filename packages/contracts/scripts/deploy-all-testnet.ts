import { ethers } from 'hardhat';

async function main() {
  console.log('🚀 Deploying Fairlaunch & Token Factories to BSC Testnet...\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  // Configuration
  const DEPLOYMENT_FEE = ethers.parseEther('0.2'); // 0.2 BNB
  const TOKEN_CREATION_FEE = ethers.parseEther('0.2'); // 0.2 BNB

  const FEE_SPLITTER = '0x2672af17eA89bc5e46BB52385C45Cb42e5eC8C48';
  const TREASURY_WALLET = '0x95D94D86CfC550897d2b80672a3c94c12429a90D';
  const ADMIN_EXECUTOR = '0x95D94D86CfC550897d2b80672a3c94c12429a90D';

  console.log('--- Configuration ---');
  console.log('Treasury:', TREASURY_WALLET);
  console.log('Fee Splitter:', FEE_SPLITTER);
  console.log('Admin Executor:', ADMIN_EXECUTOR);
  console.log('Deployment Fee:', ethers.formatEther(DEPLOYMENT_FEE), 'BNB');
  console.log('Token Creation Fee:', ethers.formatEther(TOKEN_CREATION_FEE), 'BNB');
  console.log('---------------------\n');

  // 1. Deploy SimpleTokenFactory
  console.log('📝 Deploying SimpleTokenFactory...');
  const SimpleTokenFactory = await ethers.getContractFactory('SimpleTokenFactory');
  const tokenFactory = await SimpleTokenFactory.deploy(TREASURY_WALLET, TOKEN_CREATION_FEE);
  await tokenFactory.waitForDeployment();
  const tokenFactoryAddress = await tokenFactory.getAddress();
  console.log('✅ SimpleTokenFactory deployed to:', tokenFactoryAddress);

  // 2. Deploy FairlaunchFactory
  console.log('\n📝 Deploying FairlaunchFactory...');
  const FairlaunchFactory = await ethers.getContractFactory('FairlaunchFactory');
  const flFactory = await FairlaunchFactory.deploy(
    DEPLOYMENT_FEE,
    FEE_SPLITTER,
    TREASURY_WALLET,
    ADMIN_EXECUTOR
  );
  await flFactory.waitForDeployment();
  const flFactoryAddress = await flFactory.getAddress();
  console.log('✅ FairlaunchFactory deployed to:', flFactoryAddress);

  console.log('\n📊 Deployment Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Network: BSC Testnet');
  console.log('SimpleTokenFactory:', tokenFactoryAddress);
  console.log('FairlaunchFactory:', flFactoryAddress);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Next Steps:');
  console.log('1. Update apps/web/.env.local NEXT_PUBLIC_FAIRLAUNCH_FACTORY_BSC_TESTNET');
  console.log(
    '2. Update apps/web/src/lib/web3/token-factory.ts TOKEN_FACTORY_ADDRESSES[bsc_testnet]'
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
