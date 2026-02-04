const hre = require('hardhat');
const fs = require('fs');

async function main() {
  console.log('\n🎯 FINALIZING PRESALE (FINAL)\n');

  const deployment = JSON.parse(fs.readFileSync('deployment-vesting-final.json', 'utf8'));
  const merkleData = JSON.parse(fs.readFileSync('merkle-final.json', 'utf8'));

  const roundAddr = deployment.presaleRound;
  const merkleRoot = merkleData.merkleRoot;
  const totalAllocation = BigInt(merkleData.totalAllocation);

  console.log(`PresaleRound: ${roundAddr}`);
  console.log(`Merkle Root: ${merkleRoot}`);
  console.log(`Total Allocation: ${hre.ethers.formatEther(totalAllocation)} tokens\n`);

  const round = await hre.ethers.getContractAt('PresaleRound', roundAddr);
  const signers = await hre.ethers.getSigners();
  const timelock = signers[2];
  const projectOwner = signers[1];

  // Wait for presale to end
  const endTime = deployment.endTime;
  const now = Math.floor(Date.now() / 1000);

  console.log(`End Time: ${new Date(endTime * 1000).toLocaleString()}`);
  console.log(`Current: ${new Date(now * 1000).toLocaleString()}\n`);

  if (now < endTime) {
    const waitTime = endTime - now + 2;
    console.log(`⏳ Waiting ${waitTime} seconds for presale to end...\n`);
    await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
  }

  // Approve tokens
  console.log('💰 Approving tokens...\n');

  const projectToken = await round.projectToken();
  const tokenContract = await hre.ethers.getContractAt('IERC20', projectToken);

  console.log(`  Approving ${hre.ethers.formatEther(totalAllocation)} tokens...\n`);

  const approveTx = await tokenContract.connect(projectOwner).approve(roundAddr, totalAllocation);
  await approveTx.wait();
  console.log(`  ✅ Approved\n`);

  // Finalize
  console.log('🎯 Finalizing...\n');

  const tx = await round.connect(timelock).finalizeSuccess(merkleRoot, totalAllocation);

  console.log(`  TX: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`  ✅ Block ${receipt.blockNumber}\n`);

  // Verify
  const status = await round.status();
  const tgeTimestamp = await round.tgeTimestamp();

  console.log('✅ FINALIZATION SUCCESSFUL!\n');
  console.log(`  Status: ${status} (3 = FINALIZED_SUCCESS)`);
  console.log(`  TGE: ${new Date(Number(tgeTimestamp) * 1000).toLocaleString()}\n`);

  console.log('📋 Vesting Schedule (WIB):\n');
  const tge = Number(tgeTimestamp);
  const cliffEnd = tge + 1800; // 30 min
  const vestingEnd = cliffEnd + 7200; // 2 hours

  console.log(
    `  TGE (25%): ${new Date((tge + 7 * 3600) * 1000).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
    })}`
  );
  console.log(
    `  Cliff End: ${new Date((cliffEnd + 7 * 3600) * 1000).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
    })}`
  );
  console.log(
    `  Full (100%): ${new Date((vestingEnd + 7 * 3600) * 1000).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
    })}\n`
  );

  console.log('🎁 Buyers can now claim their TGE allocation (25%)!\n');
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
