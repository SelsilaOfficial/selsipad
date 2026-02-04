const hre = require('hardhat');
const fs = require('fs');

// Quick 3-scenario presale test (30 min duration)
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 BSC TESTNET - 3 PRESALE SCENARIOS (30 MIN TEST)');
  console.log('='.repeat(70) + '\n');

  // Get signers from .env
  const provider = hre.ethers.provider;
  const [admin, timelock, buyer1, buyer2, buyer3, buyer4, buyer5] = await hre.ethers.getSigners();

  console.log('👥 Wallets:');
  console.log(`   Admin: ${admin.address}`);
  console.log(`   Timelock: ${timelock.address}`);
  console.log(`   Buyers: ${buyer1.address}, ${buyer2.address}, ${buyer3.address}...\n`);

  // Contract addresses
  const factoryAddr = '0x237cc0f76e64DA3172bb7705287617f03DC0B016';
  const feeSplitterAddr = '0xce329E6d7415999160bB6f47133b552a91C915a0';

  const factory = await hre.ethers.getContractAt('PresaleFactory', factoryAddr);
  const feeSplitter = await hre.ethers.getContractAt('FeeSplitter', feeSplitterAddr);

  // Get vault addresses for verification
  const treasuryVault = await feeSplitter.treasuryVault();
  const referralVault = await feeSplitter.referralPoolVault();
  const sbtVault = await feeSplitter.sbtStakingVault();

  // Timing: start in 2 min, end in 30 min
  const now = Math.floor(Date.now() / 1000);
  const startTime = now + 120; // 2 minutes from now
  const endTime = startTime + 1800; // 30 minutes duration

  console.log(`⏰ Timing:`);
  console.log(`   Start: ${new Date(startTime * 1000).toLocaleTimeString()}`);
  console.log(`   End: ${new Date(endTime * 1000).toLocaleTimeString()}`);
  console.log(`   Duration: 30 minutes\n`);

  const results = [];

  // ============================================
  // SCENARIO 1: HARDCAP SUCCESS (5 BNB)
  // ============================================
  console.log('=' + '='.repeat(69));
  console.log('📊 S1: HARDCAP SUCCESS (5 BNB)');
  console.log('=' + '='.repeat(69) + '\n');

  const s1 = await runScenario({
    id: 'S1_HARDCAP',
    factory,
    admin,
    timelock,
    buyers: [buyer1, buyer2, buyer3, buyer4, buyer5],
    contributions: ['1.0', '1.0', '1.0', '1.0', '1.0'],
    softCap: '2.5',
    hardCap: '5.0',
    startTime,
    endTime: startTime + 1800,
    treasuryVault,
    referralVault,
    sbtVault,
    provider,
  });
  results.push(s1);

  // Short delay
  await new Promise((r) => setTimeout(r, 3000));

  // ============================================
  // SCENARIO 2: SOFTCAP ONLY (3 BNB)
  // ============================================
  console.log('\n' + '=' + '='.repeat(69));
  console.log('📊 S2: SOFTCAP SUCCESS (3 BNB)');
  console.log('=' + '='.repeat(69) + '\n');

  const s2 = await runScenario({
    id: 'S2_SOFTCAP',
    factory,
    admin,
    timelock,
    buyers: [buyer1, buyer2, buyer3],
    contributions: ['1.0', '1.0', '1.0'],
    softCap: '2.5',
    hardCap: '5.0',
    startTime: startTime + 60,
    endTime: startTime + 1860,
    treasuryVault,
    referralVault,
    sbtVault,
    provider,
  });
  results.push(s2);

  await new Promise((r) => setTimeout(r, 3000));

  // ============================================
  // SCENARIO 3: FAILED + REFUND (2 BNB)
  // ============================================
  console.log('\n' + '=' + '='.repeat(69));
  console.log('📊 S3: FAILED + REFUND (2 BNB)');
  console.log('=' + '='.repeat(69) + '\n');

  const s3 = await runScenario({
    id: 'S3_FAILED',
    factory,
    admin,
    timelock,
    buyers: [buyer1, buyer2],
    contributions: ['1.0', '1.0'],
    softCap: '2.5',
    hardCap: '5.0',
    startTime: startTime + 120,
    endTime: startTime + 1920,
    treasuryVault,
    referralVault,
    sbtVault,
    provider,
    expectFail: true,
  });
  results.push(s3);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(70));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(70) + '\n');

  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.id}`);
    console.log(`   Round: ${r.round}`);
    console.log(`   Total Raised: ${r.totalRaised} BNB`);
    console.log(`   Status: ${r.status}`);
    if (r.feeAmount) {
      console.log(`   Fee: ${r.feeAmount} BNB`);
    }
    console.log('');
  });

  // Save results
  const output = {
    timestamp: new Date().toISOString(),
    network: 'bsc_testnet',
    scenarios: results,
  };

  fs.writeFileSync('./scenario-results.json', JSON.stringify(output, null, 2));
  console.log('💾 Results saved to: scenario-results.json\n');

  console.log('✅ All scenarios created! Waiting for endTime to finalize...');
  console.log(`⏰ Come back after ${new Date(endTime * 1000).toLocaleTimeString()} to finalize\n`);
}

async function runScenario(opts) {
  const {
    id,
    factory,
    admin,
    timelock,
    buyers,
    contributions,
    softCap,
    hardCap,
    startTime,
    endTime,
    treasuryVault,
    referralVault,
    sbtVault,
    provider,
    expectFail,
  } = opts;

  console.log(`Creating presale: ${id}...`);

  // Create mock project token (ERC20Mock)
  const ERC20Mock = await hre.ethers.getContractFactory('ERC20Mock');
  const projectToken = await ERC20Mock.deploy('TEST', 'TST', 18);
  await projectToken.waitForDeployment();
  const projectTokenAddr = await projectToken.getAddress();

  console.log(`   Project Token: ${projectTokenAddr}`);

  // Presale params
  const params = {
    projectToken: projectTokenAddr,
    paymentToken: hre.ethers.ZeroAddress, // Native BNB
    softCap: hre.ethers.parseEther(softCap),
    hardCap: hre.ethers.parseEther(hardCap),
    minContribution: hre.ethers.parseEther('0.1'),
    maxContribution: hre.ethers.parseEther('1.0'),
    startTime: startTime,
    endTime: endTime,
    projectOwner: admin.address,
  };

  const vestingParams = {
    tgeUnlockBps: 1000, // 10%
    cliffDuration: 0,
    vestingDuration: 2592000, // 30 days
    scheduleSalt: hre.ethers.ZeroHash, // Auto
  };

  const lpPlan = {
    lockMonths: 12,
    dexId: hre.ethers.id('PANCAKESWAP'),
    liquidityPercent: 7000,
  };

  const complianceHash = hre.ethers.id(`TESTNET_${id}`);

  // Create presale
  console.log(`   Creating via Factory...`);
  const tx = await factory
    .connect(admin)
    .createPresale(params, vestingParams, lpPlan, complianceHash);
  const receipt = await tx.wait();

  // Parse event
  const evt = receipt.logs
    .map((log) => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((e) => e && e.name === 'PresaleCreated');

  const roundAddr = evt.args.round;
  const vestingAddr = evt.args.vesting;

  console.log(`   ✅ Round: ${roundAddr}`);
  console.log(`   ✅ Vesting: ${vestingAddr}\n`);

  const round = await hre.ethers.getContractAt('PresaleRound', roundAddr);

  // Wait for start time
  console.log(`   ⏳ Waiting for start time...`);
  while (Math.floor(Date.now() / 1000) < startTime) {
    await new Promise((r) => setTimeout(r, 5000));
    process.stdout.write('.');
  }
  console.log(' Started!\n');

  // Contributions
  console.log(`   💰 Processing contributions:`);
  let totalRaised = 0n;
  for (let i = 0; i < buyers.length; i++) {
    const buyer = buyers[i];
    const amount = hre.ethers.parseEther(contributions[i]);

    const tx = await buyer.sendTransaction({
      to: roundAddr,
      value: amount,
      data: round.interface.encodeFunctionData('contribute', [amount, hre.ethers.ZeroAddress]),
    });
    await tx.wait();

    totalRaised += amount;
    console.log(`      ${buyer.address.slice(0, 10)}... → ${contributions[i]} BNB ✅`);
  }

  console.log(`   📊 Total Raised: ${hre.ethers.formatEther(totalRaised)} BNB\n`);

  return {
    id,
    round: roundAddr,
    vesting: vestingAddr,
    projectToken: projectTokenAddr,
    totalRaised: hre.ethers.formatEther(totalRaised),
    status: 'CREATED',
    startTime,
    endTime,
  };
}

main()
  .then(() => {
    console.log('🎉 Scenario creation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
