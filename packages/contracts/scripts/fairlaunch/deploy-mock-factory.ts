/**
 * Deploy MockFairlaunchFactory for testnet
 * Compatible with existing wizard UI
 */

import { ethers } from 'hardhat';

async function main() {
  const FEE_SPLITTER = '0x2672af17eA89bc5e46BB52385C45Cb42e5eC8C48';
  const TREASURY = '0x95D94D86CfC550897d2b80672a3c94c12429a90D';
  const ADMIN_EXECUTOR = '0x95D94D86CfC550897d2b80672a3c94c12429a90D';
  const DEPLOYMENT_FEE = ethers.parseEther('0.2');

  console.log('\n🏭 Deploying MockFairlaunchFactory');
  console.log('=====================================\n');

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(
    `Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} BNB\n`
  );

  console.log('📋 Configuration:');
  console.log(`  Deployment Fee: ${ethers.formatEther(DEPLOYMENT_FEE)} BNB`);
  console.log(`  Fee Splitter: ${FEE_SPLITTER}`);
  console.log(`  Treasury: ${TREASURY}`);
  console.log(`  Admin: ${ADMIN_EXECUTOR}\n`);

  // Deploy
  console.log('🔄 Deploying MockFairlaunchFactory...');
  const MockFactory = await ethers.getContractFactory('MockFairlaunchFactory');
  const factory = await MockFactory.deploy(DEPLOYMENT_FEE, FEE_SPLITTER, TREASURY, ADMIN_EXECUTOR);

  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  console.log(`✅ Factory deployed: ${factoryAddress}`);
  console.log(`   https://testnet.bscscan.com/address/${factoryAddress}\n`);

  // Verify config
  const setFee = await factory.DEPLOYMENT_FEE();
  console.log(`✅ Deployment fee: ${ethers.formatEther(setFee)} BNB`);

  console.log('\n🎉 Deployment Complete!');
  console.log('=====================================');
  console.log(`\n📝 Update Frontend Config:`);
  console.log(`   File: apps/web/src/lib/web3/fairlaunch-contracts.ts`);
  console.log(`   Address: ${factoryAddress}`);
  console.log(`\n✅ Wizard UI unchanged - already compatible!`);
  console.log(`\n🧪 Test Flow:`);
  console.log(`   1. Navigate to: localhost:3000/create/fairlaunch`);
  console.log(`   2. Complete steps 1-7`);
  console.log(`   3. Deploy fairlaunch`);
  console.log(`   4. Contribute + finalize (no DEX needed)`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
