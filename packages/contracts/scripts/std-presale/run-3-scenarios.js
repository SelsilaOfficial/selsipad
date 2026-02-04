const hre = require('hardhat');
const fs = require('fs');

// 3 Presale Scenarios - pakai buyer wallets yang ada balance
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 3 PRESALE SCENARIOS TEST - QUICK (10 MIN)');
  console.log('='.repeat(70) + '\n');

  const signers = await hre.ethers.getSigners();
  const [deployer, admin, buyer1, buyer2, buyer3] = signers;

  console.log(`👥 Wallets:`);
  console.log(`   Admin: ${admin.address}`);
  console.log(
    `   Buyer1: ${buyer1.address} (${hre.ethers.formatEther(
      await hre.ethers.provider.getBalance(buyer1.address)
    )} BNB)`
  );
  console.log(
    `   Buyer2: ${buyer2.address} (${hre.ethers.formatEther(
      await hre.ethers.provider.getBalance(buyer2.address)
    )} BNB)`
  );
  console.log(
    `   Buyer3: ${buyer3.address} (${hre.ethers.formatEther(
      await hre.ethers.provider.getBalance(buyer3.address)
    )} BNB)\n`
  );

  const factoryAddr = '0x237cc0f76e64DA3172bb7705287617f03DC0B016';
  const factory = await hre.ethers.getContractAt('PresaleFactory', factoryAddr);

  // Timing: start 1 min, duration 10 min
  const now = Math.floor(Date.now() / 1000);
  const baseStart = now + 60;
  const duration = 600; // 10 minutes

  const scenarios = [];

  // SCENARIO 1: HARDCAP (5 BNB total from 5 buyers @ 1 BNB each)
  console.log('=' + '='.repeat(69));
  console.log('📊 S1: HARDCAP SUCCESS (5 BNB)');
  console.log('=' + '='.repeat(69) + '\n');

  const s1 = await createPresale({
    id: 'S1_HARDCAP',
    factory,
    admin,
    softCap: '2.5',
    hardCap: '5.0',
    startTime: baseStart,
    endTime: baseStart + duration,
  });

  await waitFor(s1.startTime);
  await contribute(s1.round, buyer1, '1.0');
  await contribute(s1.round, buyer2, '1.0');
  await contribute(s1.round, buyer3, '1.0');
  await contribute(s1.round, buyer1, '1.0'); // 2nd contribution
  await contribute(s1.round, buyer2, '1.0'); // 2nd contribution (total 5)

  const s1Total = await s1.round.totalRaised();
  console.log(`   ✅ Total: ${hre.ethers.formatEther(s1Total)} BNB (HARDCAP REACHED)\n`);
  scenarios.push({ ...s1, totalRaised: hre.ethers.formatEther(s1Total), status: 'HARDCAP' });

  // SCENARIO 2: SOFTCAP ONLY (3 BNB)
  console.log('=' + '='.repeat(69));
  console.log('📊 S2: SOFTCAP SUCCESS (3 BNB)');
  console.log('=' + '='.repeat(69) + '\n');

  const s2 = await createPresale({
    id: 'S2_SOFTCAP',
    factory,
    admin,
    softCap: '2.5',
    hardCap: '5.0',
    startTime: baseStart + 60,
    endTime: baseStart + duration + 60,
  });

  await waitFor(s2.startTime);
  await contribute(s2.round, buyer1, '1.0');
  await contribute(s2.round, buyer2, '1.0');
  await contribute(s2.round, buyer3, '1.0');

  const s2Total = await s2.round.totalRaised();
  console.log(`   ✅ Total: ${hre.ethers.formatEther(s2Total)} BNB (SOFTCAP MET)\n`);
  scenarios.push({ ...s2, totalRaised: hre.ethers.formatEther(s2Total), status: 'SOFTCAP' });

  // SCENARIO 3: FAIL (2 BNB < softcap)
  console.log('=' + '='.repeat(69));
  console.log('📊 S3: FAILED + REFUND (2 BNB)');
  console.log('=' + '='.repeat(69) + '\n');

  const s3 = await createPresale({
    id: 'S3_FAILED',
    factory,
    admin,
    softCap: '2.5',
    hardCap: '5.0',
    startTime: baseStart + 120,
    endTime: baseStart + duration + 120,
  });

  await waitFor(s3.startTime);
  await contribute(s3.round, buyer1, '1.0');
  await contribute(s3.round, buyer2, '1.0');

  const s3Total = await s3.round.totalRaised();
  console.log(`   ✅ Total: ${hre.ethers.formatEther(s3Total)} BNB (BELOW SOFTCAP)\n`);
  scenarios.push({ ...s3, totalRaised: hre.ethers.formatEther(s3Total), status: 'FAILED' });

  // Save results
  const results = {
    timestamp: new Date().toISOString(),
    network: 'bsc_testnet',
    scenarios: scenarios.map((s) => ({
      id: s.id,
      round: s.roundAddr,
      vesting: s.vestingAddr,
      projectToken: s.projectToken,
      totalRaised: s.totalRaised,
      softCap: '2.5',
      hardCap: '5.0',
      status: s.status,
      endTime: s.endTime,
      explorer: `https://testnet.bscscan.com/address/${s.roundAddr}`,
    })),
  };

  fs.writeFileSync('./scenarios-results.json', JSON.stringify(results, null, 2));

  console.log('=' + '='.repeat(69));
  console.log('✅ ALL 3 SCENARIOS CREATED!');
  console.log('=' + '='.repeat(69) + '\n');

  results.scenarios.forEach((s, i) => {
    console.log(`${i + 1}. ${s.id}`);
    console.log(`   Round: ${s.round}`);
    console.log(`   Raised: ${s.totalRaised} BNB`);
    console.log(`   Status: ${s.status}`);
    console.log(`   End: ${new Date(s.endTime * 1000).toLocaleTimeString()}\n`);
  });

  console.log(
    `⏰ Wait until ${new Date(
      results.scenarios[2].endTime * 1000
    ).toLocaleTimeString()} to finalize\n`
  );
  console.log(`💾 Results: scenarios-results.json\n`);
}

async function createPresale(opts) {
  const { id, factory, admin, softCap, hardCap, startTime, endTime } = opts;

  console.log(`Creating ${id}...`);

  // Deploy mock token
  const ERC20Mock = await hre.ethers.getContractFactory('ERC20Mock');
  const token = await ERC20Mock.deploy('TEST', 'TST', 18);
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();

  const params = {
    projectToken: tokenAddr,
    paymentToken: hre.ethers.ZeroAddress,
    softCap: hre.ethers.parseEther(softCap),
    hardCap: hre.ethers.parseEther(hardCap),
    minContribution: hre.ethers.parseEther('0.1'),
    maxContribution: hre.ethers.parseEther('1.0'),
    startTime,
    endTime,
    projectOwner: admin.address,
  };

  const vestingParams = {
    tgeUnlockBps: 1000,
    cliffDuration: 0,
    vestingDuration: 86400,
    scheduleSalt: hre.ethers.ZeroHash,
  };

  const lpPlan = {
    lockMonths: 12,
    dexId: hre.ethers.id('PANCAKESWAP'),
    liquidityPercent: 7000,
  };

  const tx = await factory
    .connect(admin)
    .createPresale(params, vestingParams, lpPlan, hre.ethers.id(id));
  const receipt = await tx.wait();

  const evt = receipt.logs
    .map((l) => {
      try {
        return factory.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((e) => e && e.name === 'PresaleCreated');

  const roundAddr = evt.args.round;
  const vestingAddr = evt.args.vesting;
  const round = await hre.ethers.getContractAt('PresaleRound', roundAddr);

  console.log(`   ✅ Created: ${roundAddr}\n`);

  return {
    id,
    roundAddr,
    vestingAddr,
    projectToken: tokenAddr,
    round,
    startTime,
    endTime,
  };
}

async function contribute(round, buyer, amount) {
  const amountWei = hre.ethers.parseEther(amount);
  const tx = await round
    .connect(buyer)
    .contribute(amountWei, hre.ethers.ZeroAddress, { value: amountWei });
  await tx.wait();
  console.log(`   💰 ${buyer.address.slice(0, 10)}... contributed ${amount} BNB`);
}

async function waitFor(timestamp) {
  const now = Math.floor(Date.now() / 1000);
  if (now < timestamp) {
    const wait = (timestamp - now + 2) * 1000;
    console.log(`   ⏳ Waiting ${Math.floor(wait / 1000)}s...`);
    await new Promise((r) => setTimeout(r, wait));
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
