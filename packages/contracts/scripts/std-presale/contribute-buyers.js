const hre = require('hardhat');
const fs = require('fs');

/**
 * Execute contributions from multiple buyers
 * Each buyer contributes different amounts to test claim distribution
 */

async function main() {
  console.log('\n💰 BUYER CONTRIBUTIONS\n');

  // Load deployment info
  const deployment = JSON.parse(fs.readFileSync('deployment-vesting-test.json', 'utf8'));
  const roundAddr = deployment.presaleRound;

  console.log(`PresaleRound: ${roundAddr}\n`);

  const round = await hre.ethers.getContractAt('PresaleRound', roundAddr);
  const signers = await hre.ethers.getSigners();

  // Buyers: indices 4, 5 (only 2 available)
  const buyers = [
    { signer: signers[4], amount: hre.ethers.parseEther('2.0'), label: 'BUYER1' },
    { signer: signers[5], amount: hre.ethers.parseEther('2.5'), label: 'BUYER2' },
  ];

  console.log('👥 Buyers:\n');
  buyers.forEach((b, i) => {
    console.log(`  ${b.label}: ${b.signer.address} - ${hre.ethers.formatEther(b.amount)} BNB`);
  });
  console.log('');

  // Check if presale has started
  const status = await round.status();
  const startTime = await round.startTime();
  const now = Math.floor(Date.now() / 1000);

  console.log(`Presale Status: ${status}`);
  console.log(`Start Time: ${new Date(Number(startTime) * 1000).toLocaleString()}`);
  console.log(`Current Time: ${new Date(now * 1000).toLocaleString()}\n`);

  if (now < Number(startTime)) {
    const waitTime = Number(startTime) - now;
    console.log(`⏳ Waiting ${waitTime} seconds for presale to start...\n`);
    await new Promise((resolve) => setTimeout(resolve, (waitTime + 2) * 1000));
  }

  // Execute contributions
  console.log('📤 Executing contributions...\n');

  for (const buyer of buyers) {
    try {
      console.log(`  ${buyer.label}: Contributing ${hre.ethers.formatEther(buyer.amount)} BNB...`);

      const tx = await round.connect(buyer.signer).contribute(
        buyer.amount,
        hre.ethers.ZeroAddress, // No referrer
        { value: buyer.amount }
      );

      const receipt = await tx.wait();
      console.log(`    ✅ Confirmed (tx: ${tx.hash.slice(0, 18)}...)\n`);
    } catch (error) {
      console.log(`    ❌ Failed: ${error.message}\n`);
    }
  }

  // Verify contributions
  console.log('✅ Verifying contributions...\n');

  let totalContributed = 0n;
  const contributions = [];

  for (const buyer of buyers) {
    const contrib = await round.contributions(buyer.signer.address);
    totalContributed += contrib;
    contributions.push({
      address: buyer.signer.address,
      amount: contrib,
      label: buyer.label,
    });
    console.log(`  ${buyer.label}: ${hre.ethers.formatEther(contrib)} BNB ✅`);
  }

  const totalRaised = await round.totalRaised();
  console.log(`\n  Total Raised: ${hre.ethers.formatEther(totalRaised)} BNB`);
  console.log(`  Verified: ${totalRaised === totalContributed ? '✅' : '❌'}\n`);

  // Save contributions for merkle tree generation
  fs.writeFileSync(
    'contributions.json',
    JSON.stringify({ contributions, totalRaised: totalRaised.toString() }, null, 2)
  );

  console.log('💾 Contributions saved to: contributions.json\n');
  console.log('📋 Next: Wait for presale to end, then generate merkle tree\n');
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
