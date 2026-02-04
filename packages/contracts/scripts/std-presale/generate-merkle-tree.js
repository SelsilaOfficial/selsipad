const hre = require('hardhat');
const { MerkleTree } = require('merkletreejs');
const { keccak256 } = require('ethers');
const fs = require('fs');

/**
 * Generate Merkle Tree for Token Allocations
 *
 * Allocation Formula:
 * - tokenAllocation = (contribution / totalRaised) * tokenSupplyForPresale
 * - For testing: use 1,000,000 tokens total
 */

async function main() {
  console.log('\n🌳 GENERATING MERKLE TREE\n');

  // Load deployment and contributions
  const deployment = JSON.parse(fs.readFileSync('deployment-vesting-test.json', 'utf8'));
  const roundAddr = deployment.presaleRound;
  const vestingVaultAddr = deployment.vestingVault;

  console.log(`PresaleRound: ${roundAddr}`);
  console.log(`VestingVault: ${vestingVaultAddr}\n`);

  const round = await hre.ethers.getContractAt('PresaleRound', roundAddr);
  const vesting = await hre.ethers.getContractAt('MerkleVesting', vestingVaultAddr);

  // Get contributions from contract
  const signers = await hre.ethers.getSigners();
  const buyers = [signers[4], signers[5]]; // BUYER1, BUYER2

  const contributions = [];
  let totalRaised = 0n;

  console.log('📊 Buyer Contributions:\n');

  for (let i = 0; i < buyers.length; i++) {
    const contrib = await round.contributions(buyers[i].address);
    if (contrib > 0n) {
      contributions.push({
        address: buyers[i].address,
        contribution: contrib,
        label: `BUYER${i + 1}`,
      });
      totalRaised += contrib;
      console.log(`  BUYER${i + 1}: ${hre.ethers.formatEther(contrib)} BNB`);
    }
  }

  console.log(`\n  Total: ${hre.ethers.formatEther(totalRaised)} BNB\n`);

  if (contributions.length === 0) {
    console.log('❌ No contributions found!\n');
    return;
  }

  // Calculate token allocations
  const TOKEN_SUPPLY = hre.ethers.parseEther('1000000'); // 1M tokens for presale

  console.log('💰 Token Allocations:\n');
  console.log(`  Total Token Supply: ${hre.ethers.formatEther(TOKEN_SUPPLY)} tokens\n`);

  const allocations = contributions.map((c) => {
    const allocation = (c.contribution * TOKEN_SUPPLY) / totalRaised;
    console.log(
      `  ${c.label}: ${hre.ethers.formatEther(allocation)} tokens (${
        Number((c.contribution * 10000n) / totalRaised) / 100
      }%)`
    );
    return {
      ...c,
      allocation,
    };
  });

  console.log('');

  // Get schedule salt and chain ID for leaf encoding
  const scheduleSalt = await vesting.scheduleSalt();
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;

  console.log(`Chain ID: ${chainId}`);
  console.log(`Schedule Salt: ${scheduleSalt}\n`);

  // Generate merkle leaves
  console.log('🌿 Generating Merkle Leaves:\n');

  const leaves = allocations.map((a) => {
    const leaf = keccak256(
      hre.ethers.solidityPacked(
        ['address', 'uint256', 'bytes32', 'address', 'uint256'],
        [vestingVaultAddr, chainId, scheduleSalt, a.address, a.allocation]
      )
    );
    console.log(`  ${a.label}: ${leaf.slice(0, 18)}...`);
    return leaf;
  });

  // Create Merkle tree
  console.log('\n🌳 Building Merkle Tree...\n');

  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const merkleRoot = tree.getHexRoot();
  const totalAllocation = allocations.reduce((sum, a) => sum + a.allocation, 0n);

  console.log(`  Merkle Root: ${merkleRoot}`);
  console.log(`  Total Allocation: ${hre.ethers.formatEther(totalAllocation)} tokens\n`);

  // Generate proofs for each buyer
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

  // Save merkle data
  const merkleData = {
    merkleRoot,
    totalAllocation: totalAllocation.toString(),
    allocations: proofs.map((p) => ({
      address: p.address,
      label: p.label,
      contribution: p.contribution.toString(),
      allocation: p.allocation.toString(),
      proof: p.proof,
    })),
    vestingVault: vestingVaultAddr,
    scheduleSalt,
    chainId: Number(chainId),
  };

  fs.writeFileSync('merkle-tree.json', JSON.stringify(merkleData, null, 2));

  console.log('💾 Merkle data saved to: merkle-tree.json\n');
  console.log('✅ Merkle tree generation complete!\n');
  console.log('📋 Next Steps:\n');
  console.log(`  1. Approve ${hre.ethers.formatEther(totalAllocation)} tokens from project owner`);
  console.log('  2. Run finalize script with merkle root');
  console.log('  3. Test claims\n');
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
