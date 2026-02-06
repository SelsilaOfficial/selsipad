// Verify Fairlaunch LP Locker integration on BSC Testnet
// Usage: npx hardhat run scripts/verify-fairlaunch-manual.ts --network bscTestnet

import { ethers } from 'hardhat';

async function main() {
  console.log('🚀 Verifying Fairlaunch LP Locker Integration...\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  // Constants
  const FACTORY_ADDRESS = '0x8a2C1ECce8459d12E33B3154DD278399c2f1a055'; // Updated Factory
  const LP_LOCKER_ADDRESS = '0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F';
  const FEE_SPLITTER = '0x2672af17eA89bc5e46BB52385C45Cb42e5eC8C48';

  // 1. Deploy Test Token
  console.log('\n1️⃣  Deploying Test Token...');
  const MockERC20 = await ethers.getContractFactory('contracts/mocks/MockERC20.sol:MockERC20');
  const token = await MockERC20.deploy('Verify Token', 'VERIFY', ethers.parseEther('1000000'));
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log('✅ Test Token:', tokenAddress);

  // 2. Approve Factory
  console.log('\n2️⃣  Approving Factory...');
  const txApprove = await token.approve(FACTORY_ADDRESS, ethers.MaxUint256);
  await txApprove.wait();
  console.log('✅ Approved');

  // 3. Create Fairlaunch
  console.log('\n3️⃣  Creating Fairlaunch Pool...');
  const FairlaunchFactory = await ethers.getContractFactory('FairlaunchFactory');
  const factory = FairlaunchFactory.attach(FACTORY_ADDRESS);

  const deploymentFee = await factory.DEPLOYMENT_FEE();

  const now = Math.floor(Date.now() / 1000);
  const startTime = now + 600; // 10 mins from now
  const endTime = startTime + 3600; // 1 hour duration

  const createParams = {
    projectToken: tokenAddress,
    paymentToken: ethers.ZeroAddress,
    softcap: ethers.parseEther('0.1'),
    tokensForSale: ethers.parseEther('100000'), // 10% of supply
    minContribution: ethers.parseEther('0.01'),
    maxContribution: ethers.parseEther('1'),
    startTime: startTime,
    endTime: endTime,
    projectOwner: deployer.address,
    listingPremiumBps: 0,
  };

  const vestingParams = {
    beneficiary: deployer.address,
    startTime: endTime,
    durations: [],
    amounts: [],
  };

  const lpPlan = {
    lockMonths: 12,
    liquidityPercent: 8000, // 80%
    dexId: ethers.id('PancakeSwap'),
  };

  const txCreate = await factory.createFairlaunch(createParams, vestingParams, lpPlan, {
    value: deploymentFee,
  });
  console.log('TX Sent:', txCreate.hash);
  const receipt = await txCreate.wait();

  // Find FairlaunchCreated event
  const event = receipt.logs.find((log) => {
    try {
      return factory.interface.parseLog(log)?.name === 'FairlaunchCreated';
    } catch (e) {
      return false;
    }
  });

  const parsedLog = factory.interface.parseLog(event);
  const fairlaunchAddress = parsedLog.args.fairlaunch;
  console.log('✅ Fairlaunch Deployed:', fairlaunchAddress);

  // 4. Verify LP Locker Functions
  console.log('\n4️⃣  Verifying LP Locker Integration...');
  const Fairlaunch = await ethers.getContractFactory('Fairlaunch');
  const fairlaunch = Fairlaunch.attach(fairlaunchAddress);

  // 4a. Check initial state
  try {
    const locker1 = await fairlaunch.lpLockerAddress();
    console.log('Initial LP Locker Address:', locker1);
    if (locker1 !== ethers.ZeroAddress) throw new Error('Should be 0x0 initially');
  } catch (e) {
    console.log(
      '❌ Failed to call lpLockerAddress() - Function might be missing! Error:',
      e.message
    );
    throw e;
  }

  // 4b. Set LP Locker
  console.log(`Setting LP Locker to ${LP_LOCKER_ADDRESS}...`);
  const txSet = await fairlaunch.setLPLocker(LP_LOCKER_ADDRESS);
  await txSet.wait();
  console.log('✅ Set LP Locker TX Confirmed');

  // 4c. Verify state
  const locker2 = await fairlaunch.lpLockerAddress();
  console.log('Updated LP Locker Address:', locker2);

  if (locker2 === LP_LOCKER_ADDRESS) {
    console.log('\n🎉 SUCCESS! LP Locker integration verified.');
  } else {
    console.error('\n❌ FAILURE! Address mismatch.');
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
