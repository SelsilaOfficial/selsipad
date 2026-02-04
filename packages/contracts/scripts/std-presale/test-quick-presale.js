const hre = require('hardhat');
const fs = require('fs');

// Quick scenario test - simplified for existing wallets only
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 QUICK PRESALE TEST - BSC TESTNET');
  console.log('='.repeat(70) + '\n');

  // Use only admin and timelock wallets (both available in .env)
  const [admin, timelock] = await hre.ethers.getSigners();

  console.log(`👥 Test Wallets:`);
  console.log(`   Admin (creator + buyer): ${admin.address}`);
  console.log(`   Timelock: ${timelock.address}\n`);

  // Check balance
  const balance = await hre.ethers.provider.getBalance(admin.address);
  console.log(`💰 Admin Balance: ${hre.ethers.formatEther(balance)} BNB\n`);

  if (balance < hre.ethers.parseEther('0.2')) {
    console.log('❌ Need at least 0.2 BNB for testing!');
    process.exit(1);
  }

  // Contracts
  const factoryAddr = '0x237cc0f76e64DA3172bb7705287617f03DC0B016';
  const factory = await hre.ethers.getContractAt('PresaleFactory', factoryAddr);

  // Timing: super quick for testing
  const now = Math.floor(Date.now() / 1000);
  const startTime = now + 60; // 1 min from now
  const endTime = startTime + 300; // 5 min duration (quick test)

  console.log(`⏰ Timing:`);
  console.log(`   Start: ${new Date(startTime * 1000).toLocaleTimeString()}`);
  console.log(`   End: ${new Date(endTime * 1000).toLocaleTimeString()}\n`);

  // Create ONE quick test presale
  console.log('=' + '='.repeat(69));
  console.log('📊 Creating Test Presale (Softcap 0.5 BNB, Hardcap 1 BNB)');
  console.log('=' + '='.repeat(69) + '\n');

  // Deploy mock project token
  console.log('1️⃣  Deploying mock project token...');
  const ERC20Mock = await hre.ethers.getContractFactory('ERC20Mock');
  const projectToken = await ERC20Mock.deploy('TEST', 'TST', 18);
  await projectToken.waitForDeployment();
  const projectTokenAddr = await projectToken.getAddress();
  console.log(`   ✅ Token: ${projectTokenAddr}\n`);

  // Presale params (small amounts for quick test)
  console.log('2️⃣  Creating presale via Factory...');
  const params = {
    projectToken: projectTokenAddr,
    paymentToken: hre.ethers.ZeroAddress, // Native BNB
    softCap: hre.ethers.parseEther('0.5'),
    hardCap: hre.ethers.parseEther('1.0'),
    minContribution: hre.ethers.parseEther('0.1'),
    maxContribution: hre.ethers.parseEther('0.5'),
    startTime: startTime,
    endTime: endTime,
    projectOwner: admin.address,
  };

  const vestingParams = {
    tgeUnlockBps: 1000, // 10%
    cliffDuration: 0,
    vestingDuration: 86400, // 1 day
    scheduleSalt: hre.ethers.ZeroHash, // Auto
  };

  const lpPlan = {
    lockMonths: 12,
    dexId: hre.ethers.id('PANCAKESWAP'),
    liquidityPercent: 7000,
  };

  const complianceHash = hre.ethers.id('TESTNET_QUICK');

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
  const salt = evt.args.scheduleSalt;

  console.log(`   ✅ Created!`);
  console.log(`   Round: ${roundAddr}`);
  console.log(`   Vesting: ${vestingAddr}`);
  console.log(`   Salt: ${salt}\n`);

  const round = await hre.ethers.getContractAt('PresaleRound', roundAddr);

  // Wait for start
  console.log('3️⃣  Waiting for start time...');
  const waitMs = (startTime - Math.floor(Date.now() / 1000)) * 1000;
  if (waitMs > 0) {
    await new Promise((r) => setTimeout(r, waitMs + 1000));
  }
  console.log('   ✅ Started!\n');

  // Contribute from admin
  console.log('4️⃣  Contributing 0.5 BNB (reaches softcap)...');
  const contributeTx = await round
    .connect(admin)
    .contribute(hre.ethers.parseEther('0.5'), hre.ethers.ZeroAddress, {
      value: hre.ethers.parseEther('0.5'),
    });
  await contributeTx.wait();
  console.log('   ✅ Contribution successful!\n');

  // Check status
  const totalRaised = await round.totalRaised();
  console.log(`📊 Status:`);
  console.log(`   Total Raised: ${hre.ethers.formatEther(totalRaised)} BNB`);
  console.log(`   Softcap: 0.5 BNB ✅`);
  console.log(`   Hardcap: 1.0 BNB`);
  console.log(`   Status: ACTIVE (waiting for end time)\n`);

  // Save result
  const result = {
    timestamp: new Date().toISOString(),
    network: 'bsc_testnet',
    round: roundAddr,
    vesting: vestingAddr,
    projectToken: projectTokenAddr,
    scheduleSalt: salt,
    totalRaised: hre.ethers.formatEther(totalRaised),
    softCap: '0.5',
    hardCap: '1.0',
    startTime,
    endTime,
    status: 'ACTIVE',
    explorer: `https://testnet.bscscan.com/address/${roundAddr}`,
  };

  fs.writeFileSync('./quick-test-result.json', JSON.stringify(result, null, 2));

  console.log('=' + '='.repeat(69));
  console.log('✅ TEST PRESALE CREATED & ACTIVE!');
  console.log('=' + '='.repeat(69) + '\n');

  console.log('📝 Next Steps:');
  console.log(`1. Wait until ${new Date(endTime * 1000).toLocaleTimeString()}`);
  console.log(`2. Run finalization script to complete presale`);
  console.log(`3. Verify fee distribution\n`);

  console.log('🔗 View on BSCScan:');
  console.log(`   ${result.explorer}\n`);

  console.log('💾 Result saved to: quick-test-result.json\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
