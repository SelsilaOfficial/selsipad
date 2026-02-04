const hre = require('hardhat');

/**
 * Deploy Presale for Successful Vesting Test
 *
 * Config:
 * - Softcap: 1.5 BNB
 * - Hardcap: 3 BNB
 * - Duration: 10 minutes
 * - Vesting: 25% TGE, 30min cliff, 2h linear
 */

async function main() {
  console.log('\n🚀 DEPLOYING PRESALE FOR VESTING TEST\n');

  const factory = await hre.ethers.getContractAt(
    'PresaleFactory',
    '0x237cc0f76e64DA3172bb7705287617f03DC0B016'
  );

  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  const admin = signers[1];

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Admin: ${admin.address}\n`);

  // Vesting parameters - observable in 2.5 hours
  const vestingParams = {
    tgeUnlockBps: 2500, // 25% TGE
    cliffDuration: 1800, // 30 minutes
    vestingDuration: 7200, // 2 hours
  };

  console.log('📋 Vesting Schedule:\n');
  console.log(`  TGE Unlock: ${vestingParams.tgeUnlockBps / 100}%`);
  console.log(`  Cliff: ${vestingParams.cliffDuration / 60} minutes`);
  console.log(`  Linear Vesting: ${vestingParams.vestingDuration / 3600} hours`);
  console.log(
    `  Total Duration: ${
      (vestingParams.cliffDuration + vestingParams.vestingDuration) / 3600
    } hours\n`
  );

  // Presale timing
  const now = Math.floor(Date.now() / 1000);
  const startTime = now + 60; // Start in 1 minute
  const endTime = startTime + 600; // 10 minutes duration

  // Use existing project token
  const projectToken = '0xDf71d701A312ee22264a04cC09856b22a9a08b16';

  console.log('⏱️  Presale Timing:\n');
  console.log(`  Start: ${new Date(startTime * 1000).toLocaleString()}`);
  console.log(`  End: ${new Date(endTime * 1000).toLocaleString()}`);
  console.log(`  Duration: 10 minutes\n`);

  // Presale parameters
  const params = {
    projectToken: projectToken,
    paymentToken: hre.ethers.ZeroAddress,
    softCap: hre.ethers.parseEther('1.5'),
    hardCap: hre.ethers.parseEther('3'),
    minContribution: hre.ethers.parseEther('0.5'),
    maxContribution: hre.ethers.parseEther('2'),
    startTime: startTime,
    endTime: endTime,
    projectOwner: admin.address,
  };

  const lpPlan = {
    lockMonths: 12,
    dexId: hre.ethers.id('pancakeswap'),
    liquidityPercent: 5000,
  };

  const complianceHash = hre.ethers.ZeroHash;

  console.log('💰 Presale Config:\n');
  console.log(`  Project Token: ${params.projectToken}`);
  console.log(`  Softcap: ${hre.ethers.formatEther(params.softCap)} BNB ✅`);
  console.log(`  Hardcap: ${hre.ethers.formatEther(params.hardCap)} BNB`);
  console.log(`  Min: ${hre.ethers.formatEther(params.minContribution)} BNB`);
  console.log(`  Max: ${hre.ethers.formatEther(params.maxContribution)} BNB per wallet\n`);

  // Deploy
  console.log('📤 Deploying...\n');

  const tx = await factory
    .connect(deployer)
    .createPresale(params, vestingParams, lpPlan, complianceHash);

  console.log(`Transaction: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`✅ Confirmed in block ${receipt.blockNumber}\n`);

  // Parse event
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

  if (!event) {
    console.log('❌ Could not find PresaleCreated event\n');
    return;
  }

  const roundAddr = event.args.round;
  const vestingVaultAddr = event.args.vesting;

  console.log('✅ DEPLOYMENT SUCCESSFUL!\n');
  console.log(`PresaleRound: ${roundAddr}`);
  console.log(`VestingVault: ${vestingVaultAddr}\n`);

  // Save deployment info
  const deploymentInfo = {
    presaleRound: roundAddr,
    vestingVault: vestingVaultAddr,
    projectToken: projectToken,
    startTime: startTime,
    endTime: endTime,
    softCap: hre.ethers.formatEther(params.softCap),
    hardCap: hre.ethers.formatEther(params.hardCap),
    vesting: vestingParams,
    network: 'bsc_testnet',
    deployedAt: new Date().toISOString(),
  };

  const fs = require('fs');
  fs.writeFileSync('deployment-vesting-final.json', JSON.stringify(deploymentInfo, null, 2));

  console.log('💾 Saved to: deployment-vesting-final.json\n');
  console.log('📋 Next: Contribute 1.8+ BNB to reach softcap\n');
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
