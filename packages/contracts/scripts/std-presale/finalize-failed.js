const hre = require('hardhat');
const fs = require('fs');

/**
 * Finalize Presale as FAILED
 * Presale did not meet softcap, enable refunds
 */

async function main() {
  console.log('\n❌ FINALIZING PRESALE AS FAILED\n');

  // Load deployment
  const deployment = JSON.parse(fs.readFileSync('deployment-vesting-test.json', 'utf8'));
  const roundAddr = deployment.presaleRound;

  console.log(`PresaleRound: ${roundAddr}\n`);

  const round = await hre.ethers.getContractAt('PresaleRound', roundAddr);
  const signers = await hre.ethers.getSigners();
  const timelock = signers[2]; // Admin

  // Get presale info
  const status = await round.status();
  const totalRaised = await round.totalRaised();
  const softCap = await round.softCap();
  const endTime = await round.endTime();

  console.log('📊 Presale Info:\n');
  console.log(`  Status: ${status}`);
  console.log(`  Total Raised: ${hre.ethers.formatEther(totalRaised)} BNB`);
  console.log(`  Softcap: ${hre.ethers.formatEther(softCap)} BNB`);
  console.log(`  Softcap Met: ${totalRaised >= softCap ? '✅' : '❌'}`);
  console.log(`  End Time: ${new Date(Number(endTime) * 1000).toLocaleString()}\n`);

  if (totalRaised >= softCap) {
    console.log('⚠️  Softcap was met! This should be finalized as SUCCESS, not FAILED.\n');
    return;
  }

  // Finalize as failed
  console.log('📤 Finalizing as FAILED...\n');

  try {
    const tx = await round.connect(timelock).finalizeFailed('Softcap not met - refunds enabled');

    console.log(`  Transaction: ${tx.hash}`);
    console.log('  ⏳ Waiting for confirmation...\n');

    const receipt = await tx.wait();
    console.log(`  ✅ Confirmed in block ${receipt.blockNumber}\n`);

    // Verify status
    const finalStatus = await round.status();
    console.log('✅ FINALIZATION SUCCESSFUL!\n');
    console.log(`  Final Status: ${finalStatus} (should be 4 = FINALIZED_FAILED)`);
    console.log(`  Refunds: ENABLED ✅\n`);

    console.log('📋 Next: Buyers can now claim refunds\n');
  } catch (error) {
    console.log('\n❌ FINALIZATION FAILED\n');
    console.log(`Error: ${error.message}\n`);

    if (error.data) {
      try {
        const decoded = round.interface.parseError(error.data);
        if (decoded) {
          console.log(`Decoded: ${decoded.name}\n`);
        }
      } catch {}
    }

    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
