/**
 * Redeploy LAMPUNG Fairlaunch with updated contract
 * Uses FairlaunchFactory with correct interface
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const OLD_FAIRLAUNCH = '0x612f1d8D7184EdcD7a017E5990B477498BCfbB0f';
  const FACTORY_ADDRESS = '0x10250DAee0baB6bf0f776Ad17b11E09dA9dB2B81';
  const LP_LOCKER_ADDRESS = '0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F';

  console.log('\n🚀 Redeploying LAMPUNG Fairlaunch');
  console.log('=====================================');

  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(
    `Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} BNB\n`
  );

  // Step 1: Fetch parameters from old contract
  console.log('📋 Fetching parameters from old contract...');
  const OldFairlaunch = await ethers.getContractFactory('Fairlaunch');
  const oldContract = OldFairlaunch.attach(OLD_FAIRLAUNCH);

  const projectToken = await oldContract.projectToken();
  const paymentToken = await oldContract.paymentToken();
  const softcap = await oldContract.softcap();
  const tokensForSale = await oldContract.tokensForSale();
  const minContribution = await oldContract.minContribution();
  const maxContribution = await oldContract.maxContribution();
  const listingPremiumBps = await oldContract.listingPremiumBps();
  const liquidityPercent = await oldContract.liquidityPercent();
  const lpLockMonths = await oldContract.lpLockMonths();
  const projectOwner = await oldContract.projectOwner();
  const teamVesting = await oldContract.teamVesting();
  const dexId = await oldContract.dexId();

  console.log(`✅ Parameters fetched`);
  console.log(`  Token: ${projectToken}, Softcap: ${ethers.formatEther(softcap)} BNB`);

  // Step 2: Set new schedule
  const now = Math.floor(Date.now() / 1000);
  const startTime = now + 3600;
  const endTime = startTime + 48 * 3600;

  console.log(
    `\n⏰ New Schedule: ${new Date(startTime * 1000).toISOString()} - ${new Date(
      endTime * 1000
    ).toISOString()}`
  );

  // Step 3: Deploy via Factory
  console.log(`\n🏭 Deploying via Factory...`);

  const FairlaunchFactory = await ethers.getContractFactory('FairlaunchFactory');
  const factory = FairlaunchFactory.attach(FACTORY_ADDRESS);

  const deploymentFee = await factory.DEPLOYMENT_FEE();
  console.log(`Deployment Fee: ${ethers.formatEther(deploymentFee)} BNB`);

  // Prepare parameters (matching FairlaunchFactory structs)
  const createParams = {
    projectToken,
    paymentToken,
    softcap,
    tokensForSale,
    minContribution,
    maxContribution,
    startTime,
    endTime,
    projectOwner,
    listingPremiumBps,
  };

  const vestingParams = {
    beneficiary: projectOwner,
    startTime: endTime,
    durations: [], // No vesting
    amounts: [], // No vesting
  };

  const lpPlan = {
    lockMonths: lpLockMonths,
    liquidityPercent,
    dexId,
  };

  console.log(`\n🔄 Creating Fairlaunch...`);
  const tx = await factory.createFairlaunch(createParams, vestingParams, lpPlan, {
    value: deploymentFee,
  });

  console.log(`Tx sent: ${tx.hash}`);
  console.log(`⏳ Waiting...`);

  const receipt = await tx.wait();

  // Parse event
  const event = receipt!.logs
    .map((log) => {
      try {
        return factory.interface.parseLog(log as any);
      } catch {
        return null;
      }
    })
    .find((e) => e?.name === 'FairlaunchCreated');

  if (!event) {
    console.error('❌ Could not find FairlaunchCreated event!');
    process.exit(1);
  }

  const newFairlaunchAddress = event.args.fairlaunch;
  console.log(`\n✅ New Fairlaunch: ${newFairlaunchAddress}`);
  console.log(`Tx: https://testnet.bscscan.com/tx/${receipt!.hash}`);

  // Step 4: Set LP Locker
  console.log(`\n🔧 Setting LP Locker...`);
  const newFairlaunch = OldFairlaunch.attach(newFairlaunchAddress);

  const setLockerTx = await newFairlaunch.setLPLocker(LP_LOCKER_ADDRESS);
  await setLockerTx.wait();

  const setLocker = await newFairlaunch.lpLocker();
  console.log(`✅ LP Locker Set: ${setLocker === LP_LOCKER_ADDRESS ? 'YES ✅' : 'NO ❌'}`);

  // Save info
  const deploymentInfo = {
    oldFairlaunch: OLD_FAIRLAUNCH,
    newFairlaunch: newFairlaunchAddress,
    lpLocker: LP_LOCKER_ADDRESS,
    deploymentTx: receipt!.hash,
    lpLockerTx: setLockerTx.hash,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(__dirname, '../../deployments', `lampung-redeploy-${Date.now()}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log(`\n🎉 Redeployment Complete!`);
  console.log(`Old: ${OLD_FAIRLAUNCH} (CANCELLED)`);
  console.log(`New: ${newFairlaunchAddress} (ACTIVE)`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
