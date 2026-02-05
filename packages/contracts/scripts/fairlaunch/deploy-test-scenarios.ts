/**
 * Deploy 2 Test Fairlaunches for E2E Testing
 *
 * Test 1: REFUND Flow - Softcap NOT met
 * Test 2: FINALIZE/CLAIM Flow - Softcap met
 */

import { ethers } from 'hardhat';

async function main() {
  const FACTORY = '0xeB4f1508102dbA065D0cEd8F003518F65ecc8EA4';
  const LP_LOCKER = '0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F';

  console.log('\n🏭 Deploying 2 Test Fairlaunches');
  console.log('=====================================\n');

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(
    `Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} BNB\n`
  );

  const factory = await ethers.getContractAt('FairlaunchFactory', FACTORY);
  const deploymentFee = await factory.DEPLOYMENT_FEE();

  // ====================================
  // TEST 1: REFUND FLOW
  // ====================================
  console.log('📦 Test 1: REFUND Flow (Softcap NOT met)');
  console.log('------------------------------------------');

  // Deploy token 1
  const TestToken1 = await ethers.getContractFactory('TestToken');
  const token1 = await TestToken1.deploy();
  await token1.waitForDeployment();
  const token1Addr = await token1.getAddress();
  console.log(`Token 1: ${token1Addr}`);

  const now1 = Math.floor(Date.now() / 1000);
  const start1 = now1 + 60; // Start in 1 min
  const end1 = start1 + 180; // End in 4 min (3 min duration)

  const tokensForSale1 = ethers.parseUnits('50000', 18);
  const liquidityTokens1 = (tokensForSale1 * BigInt(8000)) / BigInt(10000);

  await (await token1.approve(FACTORY, tokensForSale1 + liquidityTokens1)).wait();

  const tx1 = await factory.createFairlaunch(
    {
      projectToken: token1Addr,
      paymentToken: ethers.ZeroAddress,
      softcap: ethers.parseEther('2.0'), // High softcap - won't be met
      tokensForSale: tokensForSale1,
      minContribution: ethers.parseEther('0.1'),
      maxContribution: ethers.parseEther('0.5'),
      startTime: start1,
      endTime: end1,
      projectOwner: deployer.address,
      listingPremiumBps: 500,
    },
    { beneficiary: deployer.address, startTime: end1, durations: [], amounts: [] },
    { lockMonths: 6, liquidityPercent: 8000, dexId: ethers.id('PANCAKE') },
    { value: deploymentFee }
  );

  const receipt1 = await tx1.wait();
  const event1 = receipt1!.logs
    .map((log) => {
      try {
        return factory.interface.parseLog(log as any);
      } catch {
        return null;
      }
    })
    .find((e) => e?.name === 'FairlaunchCreated');

  const fairlaunch1 = event1!.args.fairlaunch;
  console.log(`✅ Fairlaunch 1 deployed: ${fairlaunch1}`);
  console.log(`   Softcap: 2.0 BNB (HIGH - for refund test)`);
  console.log(`   Duration: ${start1} → ${end1} (3 min)`);

  // Set LP Locker
  const fl1 = await ethers.getContractAt('Fairlaunch', fairlaunch1);
  await (await fl1.setLPLocker(LP_LOCKER)).wait();
  console.log(`   LP Locker set ✅`);

  // ====================================
  // TEST 2: FINALIZE/CLAIM FLOW
  // ====================================
  console.log('\n📦 Test 2: FINALIZE/CLAIM Flow (Softcap met)');
  console.log('-----------------------------------------------');

  // Deploy token 2
  const TestToken2 = await ethers.getContractFactory('TestToken');
  const token2 = await TestToken2.deploy();
  await token2.waitForDeployment();
  const token2Addr = await token2.getAddress();
  console.log(`Token 2: ${token2Addr}`);

  const now2 = Math.floor(Date.now() / 1000);
  const start2 = now2 + 60; // Start in 1 min
  const end2 = start2 + 180; // End in 4 min (3 min duration)

  const tokensForSale2 = ethers.parseUnits('100000', 18);
  const liquidityTokens2 = (tokensForSale2 * BigInt(8000)) / BigInt(10000);

  await (await token2.approve(FACTORY, tokensForSale2 + liquidityTokens2)).wait();

  const tx2 = await factory.createFairlaunch(
    {
      projectToken: token2Addr,
      paymentToken: ethers.ZeroAddress,
      softcap: ethers.parseEther('0.5'), // Low softcap - easy to meet
      tokensForSale: tokensForSale2,
      minContribution: ethers.parseEther('0.1'),
      maxContribution: ethers.parseEther('1.0'),
      startTime: start2,
      endTime: end2,
      projectOwner: deployer.address,
      listingPremiumBps: 500,
    },
    { beneficiary: deployer.address, startTime: end2, durations: [], amounts: [] },
    { lockMonths: 12, liquidityPercent: 8000, dexId: ethers.id('PANCAKE') },
    { value: deploymentFee }
  );

  const receipt2 = await tx2.wait();
  const event2 = receipt2!.logs
    .map((log) => {
      try {
        return factory.interface.parseLog(log as any);
      } catch {
        return null;
      }
    })
    .find((e) => e?.name === 'FairlaunchCreated');

  const fairlaunch2 = event2!.args.fairlaunch;
  console.log(`✅ Fairlaunch 2 deployed: ${fairlaunch2}`);
  console.log(`   Softcap: 0.5 BNB (LOW - easy to meet)`);
  console.log(`   Duration: ${start2} → ${end2} (3 min)`);

  // Set LP Locker
  const fl2 = await ethers.getContractAt('Fairlaunch', fairlaunch2);
  await (await fl2.setLPLocker(LP_LOCKER)).wait();
  console.log(`   LP Locker set ✅`);

  // ====================================
  // SUMMARY
  // ====================================
  console.log('\n=====================================');
  console.log('🎉 Both Test Fairlaunches Deployed!');
  console.log('=====================================\n');

  console.log('📝 Test Scenario 1: REFUND');
  console.log(`   Fairlaunch: ${fairlaunch1}`);
  console.log(`   Token: ${token1Addr}`);
  console.log(`   Softcap: 2.0 BNB`);
  console.log(`   Start: ${new Date(start1 * 1000).toLocaleString()}`);
  console.log(`   End: ${new Date(end1 * 1000).toLocaleString()}`);
  console.log(`   Test: Contribute < 2.0 BNB, then refund after end`);

  console.log(`\n📝 Test Scenario 2: FINALIZE/CLAIM`);
  console.log(`   Fairlaunch: ${fairlaunch2}`);
  console.log(`   Token: ${token2Addr}`);
  console.log(`   Softcap: 0.5 BNB`);
  console.log(`   Start: ${new Date(start2 * 1000).toLocaleString()}`);
  console.log(`   End: ${new Date(end2 * 1000).toLocaleString()}`);
  console.log(`   Test: Contribute >= 0.5 BNB, finalize, then claim`);

  console.log(`\n🧪 Next Steps:`);
  console.log(`   1. Wait 1 min for both to start`);
  console.log(`   2. Contribute to Fairlaunch 1: 0.3 BNB (below softcap)`);
  console.log(`   3. Contribute to Fairlaunch 2: 0.6 BNB (above softcap)`);
  console.log(`   4. Wait 3 min for both to end`);
  console.log(`   5. Test refund on Fairlaunch 1`);
  console.log(`   6. Test finalize on Fairlaunch 2 (will hit DEX issue)`);
  console.log(`   7. Test claim on Fairlaunch 2 (if finalize succeeds)`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
