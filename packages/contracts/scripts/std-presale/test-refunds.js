const hre = require('hardhat');
const fs = require('fs');

/**
 * Test Refund Claims for Failed Presale
 * All buyers can claim full refund (no fees deducted)
 */

async function main() {
  console.log('\n💸 TESTING REFUND CLAIMS\n');

  // Load deployment
  const deployment = JSON.parse(fs.readFileSync('deployment-vesting-test.json', 'utf8'));
  const roundAddr = deployment.presaleRound;

  console.log(`PresaleRound: ${roundAddr}\n`);

  const round = await hre.ethers.getContractAt('PresaleRound', roundAddr);

  // Get signers
  const signers = await hre.ethers.getSigners();
  const buyers = [
    { signer: signers[4], label: 'BUYER1' },
    { signer: signers[5], label: 'BUYER2' },
  ];

  // Check status
  const status = await round.status();
  console.log(`Presale Status: ${status}`);

  if (status !== 4) {
    console.log('⚠️  Presale is not FINALIZED_FAILED. Cannot claim refunds.\n');
    console.log('  Status 4 = FINALIZED_FAILED (refunds enabled)\n');
    return;
  }

  console.log('✅ Refunds enabled!\n');

  // Test refunds
  console.log('💸 Processing Refunds:\n');

  for (const buyer of buyers) {
    const contrib = await round.contributions(buyer.signer.address);

    if (contrib === 0n) {
      console.log(`  ${buyer.label}: ❌ No contribution to refund\n`);
      continue;
    }

    console.log(`  ${buyer.label}: ${buyer.signer.address}`);
    console.log(`    Contribution: ${hre.ethers.formatEther(contrib)} BNB`);

    // Get balance before refund
    const balanceBefore = await hre.ethers.provider.getBalance(buyer.signer.address);
    console.log(`    Balance Before: ${hre.ethers.formatEther(balanceBefore)} BNB`);

    try {
      // Claim refund
      console.log(`    📤 Claiming refund...`);

      const tx = await round.connect(buyer.signer).claimRefund();
      const receipt = await tx.wait();

      // Calculate gas cost
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      // Get balance after
      const balanceAfter = await hre.ethers.provider.getBalance(buyer.signer.address);
      const netGain = balanceAfter - balanceBefore;

      console.log(`    ✅ Refunded! (tx: ${tx.hash.slice(0, 18)}...)`);
      console.log(`    Balance After: ${hre.ethers.formatEther(balanceAfter)} BNB`);
      console.log(`    Gas Cost: ${hre.ethers.formatEther(gasCost)} BNB`);
      console.log(`    Net Gain: ${hre.ethers.formatEther(netGain)} BNB`);
      console.log(`    Expected: ${hre.ethers.formatEther(contrib - gasCost)} BNB\n`);

      // Verify contribution is now 0
      const contribAfter = await round.contributions(buyer.signer.address);
      console.log(`    Contribution After: ${hre.ethers.formatEther(contribAfter)} BNB ✅\n`);
    } catch (error) {
      console.log(`    ❌ Refund failed: ${error.message}\n`);
    }
  }

  // Verify contract balance
  const contractBalance = await hre.ethers.provider.getBalance(roundAddr);
  console.log(`💰 Final Contract Balance: ${hre.ethers.formatEther(contractBalance)} BNB`);
  console.log(`   Expected: 0 BNB (all refunded) ${contractBalance === 0n ? '✅' : '⚠️'}\n`);

  console.log('✅ Refund testing complete!\n');
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
