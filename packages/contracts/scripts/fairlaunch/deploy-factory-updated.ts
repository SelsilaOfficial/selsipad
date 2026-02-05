/**
 * Deploy FairlaunchFactory to BSC Testnet
 * Uses current compiled Fairlaunch bytecode (includes setLPLocker)
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  // Configuration from .env
  const FEE_SPLITTER_ADDRESS =
    process.env.FEE_SPLITTER_ADDRESS || '0x2672af17eA89bc5e46BB52385C45Cb42e5eC8C48';
  const TREASURY_VAULT_ADDRESS =
    process.env.TREASURY_VAULT_ADDRESS || '0x95D94D86CfC550897d2b80672a3c94c12429a90D';
  const ADMIN_EXECUTOR_ADDRESS = '0x95D94D86CfC550897d2b80672a3c94c12429a90D';
  const DEPLOYMENT_FEE = ethers.parseEther('0.2'); // 0.2 BNB for BSC Testnet

  console.log('\n🏭 Deploying FairlaunchFactory (BSC Testnet)');
  console.log('=====================================');

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(
    `Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} BNB\n`
  );

  console.log('📋 Configuration:');
  console.log(`  Deployment Fee: ${ethers.formatEther(DEPLOYMENT_FEE)} BNB`);
  console.log(`  Fee Splitter: ${FEE_SPLITTER_ADDRESS}`);
  console.log(`  Treasury: ${TREASURY_VAULT_ADDRESS}`);
  console.log(`  Admin Executor: ${ADMIN_EXECUTOR_ADDRESS}\n`);

  // Deploy Factory
  console.log('🔄 Deploying FairlaunchFactory...');
  const FairlaunchFactory = await ethers.getContractFactory('FairlaunchFactory');
  const factory = await FairlaunchFactory.deploy(
    DEPLOYMENT_FEE,
    FEE_SPLITTER_ADDRESS,
    TREASURY_VAULT_ADDRESS,
    ADMIN_EXECUTOR_ADDRESS
  );

  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  console.log(`✅ Factory deployed: ${factoryAddress}`);
  console.log(`Tx: https://testnet.bscscan.com/address/${factoryAddress}\n`);

  // Verify deployment fee is set correctly
  const setDeploymentFee = await factory.DEPLOYMENT_FEE();
  console.log(`✅ Deployment fee verified: ${ethers.formatEther(setDeploymentFee)} BNB`);

  // Save deployment info
  const deploymentInfo = {
    network: 'bsc_testnet',
    chainId: '97',
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    factoryAddress,
    config: {
      deploymentFee: ethers.formatEther(DEPLOYMENT_FEE),
      feeSplitter: FEE_SPLITTER_ADDRESS,
      treasury: TREASURY_VAULT_ADDRESS,
      adminExecutor: ADMIN_EXECUTOR_ADDRESS,
    },
    note: 'Updated factory with Fairlaunch bytecode including setLPLocker function',
  };

  const deploymentsDir = path.join(__dirname, '../deployments');
  const fileName = `fairlaunch-factory-updated-${Date.now()}.json`;
  fs.writeFileSync(path.join(deploymentsDir, fileName), JSON.stringify(deploymentInfo, null, 2));

  console.log(`\n✅ Deployment Complete!`);
  console.log(`=====================================`);
  console.log(`Factory Address: ${factoryAddress}`);
  console.log(`Deployment info saved: ${fileName}`);
  console.log(`\n📝 Next Steps:`);
  console.log(`1. Update .env FairlaunchFactory address`);
  console.log(`2. Update database with new factory address`);
  console.log(`3. Test fairlaunch creation with new factory`);
  console.log(`4. Verify setLPLocker() function works on new deployments`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
