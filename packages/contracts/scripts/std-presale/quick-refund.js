const hre = require('hardhat');

async function main() {
  console.log('\n💸 Quick Refund Test\n');

  const round = await hre.ethers.getContractAt(
    'PresaleRound',
    '0x4cCe04D6425c850C150a75765b3E90a1c716f21A'
  );

  const signers = await hre.ethers.getSigners();
  const buyer1 = signers[4];

  console.log('BUYER1:', buyer1.address);

  const contrib = await round.contributions(buyer1.address);
  console.log('Contribution:', hre.ethers.formatEther(contrib), 'BNB\n');

  if (contrib === 0n) {
    console.log('✅ Already refunded or no contribution\n');
    return;
  }

  const balBefore = await hre.ethers.provider.getBalance(buyer1.address);
  console.log('Balance before:', hre.ethers.formatEther(balBefore), 'BNB\n');

  console.log('📤 Claiming refund...');
  const tx = await round.connect(buyer1).claimRefund();
  console.log('TX Hash:', tx.hash);

  const receipt = await tx.wait();
  console.log('✅ Confirmed in block', receipt.blockNumber, '\n');

  const balAfter = await hre.ethers.provider.getBalance(buyer1.address);
  const gasCost = receipt.gasUsed * receipt.gasPrice;

  console.log('Balance after:', hre.ethers.formatEther(balAfter), 'BNB');
  console.log('Gas cost:', hre.ethers.formatEther(gasCost), 'BNB');
  console.log('Net gain:', hre.ethers.formatEther(balAfter - balBefore), 'BNB\n');

  const contribAfter = await round.contributions(buyer1.address);
  console.log('Contribution now:', hre.ethers.formatEther(contribAfter), 'BNB ✅\n');
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
