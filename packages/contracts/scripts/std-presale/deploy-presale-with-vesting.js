const hre = require('hardhat');

/**
 * Deploy New Presale with Proper Vesting Schedule
 *
 * Vesting Schedule (for testing):
 * - TGE Unlock: 20% (realistic for presales)
 * - Cliff: 1 hour (quick testing)
 * - Vesting: 6 hours linear (observable)
 * - Total Duration: 7 hours from TGE
 *
 * Presale Config:
 * - Duration: 10 minutes
 * - Softcap: 2.5 BNB
 * - Hardcap: 5 BNB
 * - Min: 0.1 BNB
 * - Max: 2 BNB per wallet
 */

async function main() {
  console.log('\n🚀 DEPLOYING NEW PRESALE WITH VESTING\n');

  const factory = await hre.ethers.getContractAt(
    'PresaleFactory',
    '0x237cc0f76e64DA3172bb7705287617f03DC0B016'
  );

  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  const admin = signers[1];

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Admin: ${admin.address}\n`);

  // Vesting parameters
  const vestingParams = {
    tgeUnlockBps: 2000, // 20%
    cliffDuration: 3600, // 1 hour
    vestingDuration: 21600, // 6 hours
  };

  console.log('📋 Vesting Schedule:\n');
  console.log(`  TGE Unlock: ${vestingParams.tgeUnlockBps / 100}%`);
  console.log(`  Cliff: ${vestingParams.cliffDuration / 3600} hour`);
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

  // Use existing project token from previous presale
  const projectToken = '0xDf71d701A312ee22264a04cC09856b22a9a08b16';

  console.log('⏱️  Presale Timing:\n');
  console.log(`  Start: ${new Date(startTime * 1000).toLocaleString()}`);
  console.log(`  End: ${new Date(endTime * 1000).toLocaleString()}`);
  console.log(`  Duration: 10 minutes\n`);

  // Create params struct
  const params = {
    projectToken: projectToken,
    paymentToken: hre.ethers.ZeroAddress,
    softCap: hre.ethers.parseEther('2.5'),
    hardCap: hre.ethers.parseEther('5'),
    minContribution: hre.ethers.parseEther('0.1'),
    maxContribution: hre.ethers.parseEther('2'),
    startTime: startTime,
    endTime: endTime,
    projectOwner: admin.address,
  };

  const lpPlan = {
    lockMonths: 12, // Minimum required
    dexId: hre.ethers.id('pancakeswap'),
    liquidityPercent: 5000, // 50%
  };

  const complianceHash = hre.ethers.ZeroHash; // No compliance hash for testing

  console.log('💰 Presale Config:\n');
  console.log(`  Project Token: ${params.projectToken}`);
  console.log(`  Payment: NATIVE BNB`);
  console.log(`  Softcap: ${hre.ethers.formatEther(params.softCap)} BNB`);
  console.log(`  Hardcap: ${hre.ethers.formatEther(params.hardCap)} BNB`);
  console.log(`  Min: ${hre.ethers.formatEther(params.minContribution)} BNB`);
  console.log(`  Max: ${hre.ethers.formatEther(params.maxContribution)} BNB per wallet\n`);

  console.log('🔒 LP Lock Plan:\n');
  console.log(`  Lock Duration: ${lpPlan.lockMonths} months`);
  console.log(`  Liquidity: ${lpPlan.liquidityPercent / 100}%\n`);

  // Deploy
  console.log('📤 Deploying presale...\n');

  const tx = await factory
    .connect(deployer)
    .createPresale(params, vestingParams, lpPlan, complianceHash);

  console.log(`Transaction: ${tx.hash}`);
  console.log('Waiting for confirmation...\n');

  const receipt = await tx.wait();
  console.log(`✅ Confirmed in block ${receipt.blockNumber}\n`);

  // Parse PresaleCreated event
  const factoryInterface = factory.interface;
  const event = receipt.logs
    .map((log) => {
      try {
        return factoryInterface.parseLog({
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

  console.log('🔗 Explorer Links:\n');
  console.log(`  Round: https://testnet.bscscan.com/address/${roundAddr}`);
  console.log(`  Vault: https://testnet.bscscan.com/address/${vestingVaultAddr}\n`);

  // Save deployment info
  const deploymentInfo = {
    presaleRound: roundAddr,
    vestingVault: vestingVaultAddr,
    projectToken: projectToken,
    startTime: startTime,
    endTime: endTime,
    vesting: vestingParams,
    network: 'bsc_testnet',
    deployedAt: new Date().toISOString(),
  };

  const fs = require('fs');
  fs.writeFileSync('deployment-vesting-test.json', JSON.stringify(deploymentInfo, null, 2));

  console.log('💾 Deployment info saved to: deployment-vesting-test.json\n');

  console.log('📋 Next Steps:\n');
  console.log('  1. Wait 1 minute for presale to start');
  console.log('  2. Run contribution script');
  console.log('  3. Generate merkle tree with buyer allocations');
  console.log('  4. Finalize presale');
  console.log('  5. Test claims\n');
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
