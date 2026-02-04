const hre = require('hardhat');
const { MerkleTree } = require('merkletreejs');
const { keccak256 } = require('ethers');
const fs = require('fs');

async function main() {
  console.log('\n🌳 GENERATING MERKLE TREE (FINAL)\n');

  const deployment = JSON.parse(fs.readFileSync('deployment-vesting-final.json', 'utf8'));

  // Hardcode contributions based on what we executed
  const contributions = [
    {
      address: '0xe677CB29436F0BE225B174D5434fB8a04231069E',
      amount: hre.ethers.parseEther('1.0'),
      label: 'BUYER1',
    },
    {
      address: '0x4E5a3ef17a67c7A7260cF2a01C9BD251be9653FF',
      amount: hre.ethers.parseEther('0.8'),
      label: 'BUYER2',
    },
  ];

  const totalRaised = contributions.reduce((sum, c) => sum + c.amount, 0n);
  const TOKEN_SUPPLY = hre.ethers.parseEther('1000000');

  console.log('📊 Contributions:\n');
  contributions.forEach((c) => {
    console.log(`  ${c.label}: ${hre.ethers.formatEther(c.amount)} BNB`);
  });
  console.log(`\n  Total: ${hre.ethers.formatEther(totalRaised)} BNB\n`);

  console.log('💰 Token Allocations:\n');

  const allocations = contributions.map((c) => {
    const allocation = (c.amount * TOKEN_SUPPLY) / totalRaised;
    const percentage = Number((c.amount * 10000n) / totalRaised) / 100;
    console.log(`  ${c.label}: ${hre.ethers.formatEther(allocation)} tokens (${percentage}%)`);
    return {
      ...c,
      allocation,
    };
  });

  console.log('');

  // Get vesting contract details
  const vesting = await hre.ethers.getContractAt('MerkleVesting', deployment.vestingVault);
  const scheduleSalt = await vesting.scheduleSalt();
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;

  console.log(`Chain ID: ${chainId}`);
  console.log(`Schedule Salt: ${scheduleSalt}\n`);

  // Generate leaves
  console.log('🌿 Generating Merkle Leaves:\n');

  const leaves = allocations.map((a) => {
    const leaf = keccak256(
      hre.ethers.solidityPacked(
        ['address', 'uint256', 'bytes32', 'address', 'uint256'],
        [deployment.vestingVault, chainId, scheduleSalt, a.address, a.allocation]
      )
    );
    console.log(`  ${a.label}: ${leaf.slice(0, 18)}...`);
    return leaf;
  });

  // Create tree
  console.log('\n🌳 Building Merkle Tree...\n');

  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const merkleRoot = tree.getHexRoot();
  const totalAllocation = allocations.reduce((sum, a) => sum + a.allocation, 0n);

  console.log(`  Merkle Root: ${merkleRoot}`);
  console.log(`  Total Allocation: ${hre.ethers.formatEther(totalAllocation)} tokens\n`);

  // Generate proofs
  console.log('🔑 Generating Proofs:\n');

  const proofs = allocations.map((a, i) => {
    const proof = tree.getHexProof(leaves[i]);
    console.log(`  ${a.label}: ${proof.length} proof elements`);
    return {
      ...a,
      proof,
    };
  });

  console.log('');

  // Save data
  const merkleData = {
    merkleRoot,
    totalAllocation: totalAllocation.toString(),
    allocations: proofs.map((p) => ({
      address: p.address,
      label: p.label,
      contribution: p.amount.toString(),
      allocation: p.allocation.toString(),
      proof: p.proof,
    })),
    vestingVault: deployment.vestingVault,
    scheduleSalt,
    chainId: Number(chainId),
  };

  fs.writeFileSync('merkle-final.json', JSON.stringify(merkleData, null, 2));

  console.log('💾 Merkle data saved to: merkle-final.json\n');
  console.log('✅ Merkle tree generation complete!\n');
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
