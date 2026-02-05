/**
 * End-to-end test: Create token, deploy fairlaunch, contribute, finalize
 * Uses UPDATED factory with setLPLocker support
 */

import { ethers } from 'hardhat';

async function main() {
  const FACTORY_ADDRESS = '0xeB4f1508102dbA065D0cEd8F003518F65ecc8EA4'; // UPDATED FACTORY
  const LP_LOCKER_ADDRESS = '0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F';

  console.log('\n🧪 Fairlaunch Finalization Test (Updated Factory)\n');

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}\n`);

  // STEP 1: Create test token
  console.log('Step 1: Creating TEST2 token...');
  const TestToken = await ethers.getContractFactory('TestToken');
  const token = await TestToken.deploy();
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log(`✅ Token: ${tokenAddress}\n`);

  // STEP 2: Deploy Fairlaunch via UPDATED Factory
  console.log('Step 2: Deploying Fairlaunch via UPDATED factory...');
  const factory = await ethers.getContractAt('FairlaunchFactory', FACTORY_ADDRESS);
  const deploymentFee = await factory.DEPLOYMENT_FEE();

  const now = Math.floor(Date.now() / 1000);
  const startTime = now + 60;
  const endTime = startTime + 300;

  const tokensForSale = ethers.parseUnits('100000', 18);
  const liquidityTokens = (tokensForSale * BigInt(8000)) / BigInt(10000);
  const totalNeeded = tokensForSale + liquidityTokens;

  await token.approve(FACTORY_ADDRESS, totalNeeded);
  console.log('✅ Approved tokens');

  const tx = await factory.createFairlaunch(
    {
      projectToken: tokenAddress,
      paymentToken: ethers.ZeroAddress,
      softcap: ethers.parseEther('1.0'),
      tokensForSale,
      minContribution: ethers.parseEther('0.1'),
      maxContribution: ethers.parseEther('2.0'),
      startTime,
      endTime,
      projectOwner: deployer.address,
      listingPremiumBps: 500,
    },
    {
      beneficiary: deployer.address,
      startTime: endTime,
      durations: [],
      amounts: [],
    },
    {
      lockMonths: 12,
      liquidityPercent: 8000,
      dexId: ethers.id('PANCAKESWAP'),
    },
    { value: deploymentFee }
  );

  const receipt = await tx.wait();
  const event = receipt!.logs
    .map((log) => {
      try {
        return factory.interface.parseLog(log as any);
      } catch {
        return null;
      }
    })
    .find((e) => e?.name === 'FairlaunchCreated');

  const fairlaunchAddress = event!.args.fairlaunch;
  console.log(`✅ Fairlaunch: ${fairlaunchAddress}\n`);

  // STEP 3: Verify setLPLocker exists
  console.log('Step 3: Checking if setLPLocker function exists...');
  const fairlaunch = await ethers.getContractAt('Fairlaunch', fairlaunchAddress);

  const code = await ethers.provider.getCode(fairlaunchAddress);
  const selector = fairlaunch.interface.getFunction('setLPLocker')!.selector;
  const selectorExists = code.includes(selector.slice(2));

  console.log(`Function selector ${selector}: ${selectorExists ? 'FOUND ✅' : 'NOT FOUND ❌'}`);

  if (!selectorExists) {
    console.error('❌ setLPLocker function not found in deployed contract!');
    console.error('Factory still deploying old bytecode!');
    process.exit(1);
  }

  // STEP 4: Set LP Locker
  console.log('\nStep 4: Setting LP Locker...');
  await (await fairlaunch.setLPLocker(LP_LOCKER_ADDRESS)).wait();
  const setLocker = await fairlaunch.lpLocker();
  console.log(
    `✅ LP Locker set: ${setLocker === LP_LOCKER_ADDRESS ? 'MATCH ✅' : 'MISMATCH ❌'}\n`
  );

  // STEP 5: Wait for start
  console.log('Step 5: Waiting for start...');
  const waitStart = startTime - Math.floor(Date.now() / 1000);
  if (waitStart > 0) {
    console.log(`Waiting ${waitStart}s...`);
    await new Promise((r) => setTimeout(r, (waitStart + 5) * 1000));
  }

  // STEP 6: Contribute
  console.log('\nStep 6: Contributing 1.5 BNB...');
  await (await fairlaunch.contribute({ value: ethers.parseEther('1.5') })).wait();
  const totalRaised = await fairlaunch.totalRaised();
  console.log(`✅ Total raised: ${ethers.formatEther(totalRaised)} BNB\n`);

  // STEP 7: Wait for end
  console.log('Step 7: Waiting for end time...');
  const waitEnd = endTime - Math.floor(Date.now() / 1000);
  if (waitEnd > 0) {
    console.log(`Waiting ${waitEnd}s...`);
    await new Promise((r) => setTimeout(r, (waitEnd + 5) * 1000));
  }

  // STEP 8: Finalize
  console.log('\nStep 8: Finalizing fairlaunch...');
  const finalizeTx = await fairlaunch.finalize();
  const finalizeReceipt = await finalizeTx.wait();

  console.log(`\n🎉 FINALIZATION SUCCESSFUL!`);
  console.log(`=====================================`);
  console.log(`Tx: https://testnet.bscscan.com/tx/${finalizeReceipt!.hash}`);
  console.log(`Gas: ${finalizeReceipt!.gasUsed.toString()}`);

  const isFinalized = await fairlaunch.isFinalized();
  const status = await fairlaunch.status();

  console.log(`\nResults:`);
  console.log(`  Finalized:${isFinalized}`);
  console.log(`  Status: ${status} (3 = SUCCESS)`);
  console.log(`  Fairlaunch: ${fairlaunchAddress}`);
  console.log(`  Token: ${tokenAddress}`);
  console.log(`  Factory: ${FACTORY_ADDRESS} (UPDATED)`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
