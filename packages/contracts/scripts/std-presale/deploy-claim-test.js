const hre = require('hardhat');

async function main() {
  console.log('\n🚀 QUICK PRESALE FOR CLAIM TEST\n');

  const factory = await hre.ethers.getContractAt(
    'PresaleFactory',
    '0x237cc0f76e64DA3172bb7705287617f03DC0B016'
  );

  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  const admin = signers[1];

  // FAST vesting - observable in 40 minutes
  const vestingParams = {
    tgeUnlockBps: 2500, // 25% TGE
    cliffDuration: 600, // 10 minutes
    vestingDuration: 1800, // 30 minutes
  };

  console.log('📋 Quick Vesting:\n');
  console.log(`  TGE: 25%`);
  console.log(`  Cliff: 10 min`);
  console.log(`  Vesting: 30 min`);
  console.log(`  Total: 40 min\n`);

  const now = Math.floor(Date.now() / 1000);
  const startTime = now + 30; // Start in 30 seconds
  const endTime = startTime + 300; // 5 minutes duration

  const projectToken = '0xDf71d701A312ee22264a04cC09856b22a9a08b16';

  const params = {
    projectToken: projectToken,
    paymentToken: hre.ethers.ZeroAddress,
    softCap: hre.ethers.parseEther('0.5'),
    hardCap: hre.ethers.parseEther('2'),
    minContribution: hre.ethers.parseEther('0.1'),
    maxContribution: hre.ethers.parseEther('1'),
    startTime: startTime,
    endTime: endTime,
    projectOwner: admin.address,
  };

  const lpPlan = {
    lockMonths: 12,
    dexId: hre.ethers.id('pancakeswap'),
    liquidityPercent: 5000,
  };

  console.log('💰 Quick Config:\n');
  console.log(`  Softcap: 0.5 BNB`);
  console.log(`  Duration: 5 minutes\n`);

  const tx = await factory
    .connect(deployer)
    .createPresale(params, vestingParams, lpPlan, hre.ethers.ZeroHash);

  const receipt = await tx.wait();

  const event = receipt.logs
    .map((log) => {
      try {
        return factory.interface.parseLog({
          topics: log.topics,
          data: log.data,
        });
      } catch {
        return null;
      }
    })
    .find((e) => e && e.name === 'PresaleCreated');

  const roundAddr = event.args.round;
  const vestingVaultAddr = event.args.vesting;

  console.log('✅ DEPLOYED!\n');
  console.log(`Round: ${roundAddr}`);
  console.log(`Vault: ${vestingVaultAddr}\n`);

  const fs = require('fs');
  fs.writeFileSync(
    'deployment-claim-test.json',
    JSON.stringify(
      {
        presaleRound: roundAddr,
        vestingVault: vestingVaultAddr,
        projectToken: projectToken,
        startTime,
        endTime,
        vesting: vestingParams,
      },
      null,
      2
    )
  );

  console.log('💾 Saved to: deployment-claim-test.json\n');
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
