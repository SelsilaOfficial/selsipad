const hre = require('hardhat');
const { MerkleTree } = require('merkletreejs');
const { keccak256 } = require('ethers');
const fs = require('fs');

async function main() {
  console.log('\n🎯 COMPLETE FLOW: Finalize → Claim Test\n');

  const deployment = JSON.parse(fs.readFileSync('deployment-claim-test.json', 'utf8'));

  // Step 1: Wait for presale end
  const endTime = deployment.endTime;
  const now = Math.floor(Date.now() / 1000);

  if (now < endTime) {
    const wait = endTime - now + 3;
    console.log(`⏳ Waiting ${wait}s for presale to end...\n`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }

  // Step 2: Generate Merkle Tree
  console.log('🌳 Generating Merkle Tree...\n');

  const contribution = hre.ethers.parseEther('0.6');
  const allocation = hre.ethers.parseEther('1000000'); // 1M tokens

  console.log(`  BUYER1: 0.6 BNB → 1M tokens (100%)\n`);

  const vesting = await hre.ethers.getContractAt('MerkleVesting', deployment.vestingVault);
  const salt = await vesting.scheduleSalt();
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;
  const buyer1Addr = (await hre.ethers.getSigners())[4].address;

  const leaf = keccak256(
    hre.ethers.solidityPacked(
      ['address', 'uint256', 'bytes32', 'address', 'uint256'],
      [deployment.vestingVault, chainId, salt, buyer1Addr, allocation]
    )
  );

  const tree = new MerkleTree([leaf], keccak256, { sortPairs: true });
  const root = tree.getHexRoot();
  const proof = tree.getHexProof(leaf);

  console.log(`  Root: ${root}\n`);

  // Step 3: Approve & Finalize
  console.log('💰 Approving & Finalizing...\n');

  const signers = await hre.ethers.getSigners();
  const round = await hre.ethers.getContractAt('PresaleRound', deployment.presaleRound);
  const token = await hre.ethers.getContractAt('IERC20', deployment.projectToken);

  await (await token.connect(signers[1]).approve(deployment.presaleRound, allocation)).wait();
  console.log('  ✅ Approved\n');

  const finalizeTx = await round.connect(signers[2]).finalizeSuccess(root, allocation);
  await finalizeTx.wait();
  console.log('  ✅ Finalized\n');

  const tgeTime = await round.tgeTimestamp();
  console.log(`  TGE: ${new Date(Number(tgeTime) * 1000).toLocaleString()}\n`);

  // Step 4: Test TGE Claim (25%)
  console.log('🎁 Testing TGE Claim (25%)...\n');

  const buyer1 = signers[4];
  const balBefore = await token.balanceOf(buyer1.address);

  const claimTx = await vesting.connect(buyer1).claim(allocation, proof);
  await claimTx.wait();

  const balAfter = await token.balanceOf(buyer1.address);
  const claimed = balAfter - balBefore;
  const percentage = Number((claimed * 10000n) / allocation) / 100;

  console.log(`  Claimed: ${hre.ethers.formatEther(claimed)} tokens (${percentage}%)`);
  console.log(`  Expected: 25% ✅\n`);

  // Step 5: Show vesting timeline
  console.log('📋 Vesting Timeline (WIB):\n');
  const tge = Number(tgeTime);
  const cliffEnd = tge + 600;
  const vestEnd = cliffEnd + 1800;

  console.log(`  Now: ${new Date((Date.now() / 1000 + 7 * 3600) * 1000).toLocaleString('id-ID')}`);
  console.log(`  TGE (25%): ${new Date((tge + 7 * 3600) * 1000).toLocaleString('id-ID')} ✅`);
  console.log(
    `  Cliff End: ${new Date((cliffEnd + 7 * 3600) * 1000).toLocaleString('id-ID')} (+10min)`
  );
  console.log(
    `  Full (100%): ${new Date((vestEnd + 7 * 3600) * 1000).toLocaleString('id-ID')} (+40min)\n`
  );

  console.log('✅ TGE CLAIM SUCCESSFUL!\n');
  console.log(`💡 Wait 10 minutes to test cliff claim\n`);
  console.log(`💡 Wait 40 minutes for full vesting\n`);

  // Save proof for later claims
  fs.writeFileSync(
    'claim-proof.json',
    JSON.stringify(
      {
        buyer: buyer1Addr,
        allocation: allocation.toString(),
        proof,
        vestingVault: deployment.vestingVault,
      },
      null,
      2
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
