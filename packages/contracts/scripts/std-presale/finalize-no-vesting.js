const hre = require('hardhat');
const { MerkleTree } = require('merkletreejs');
const { keccak256 } = require('ethers');

/**
 * @title Finalize Presale with No Vesting
 * @dev Special finalization for presales with 0 vesting allocation
 *
 * PROBLEM:
 * - Cannot pass bytes32(0) as merkle root (reverts with InvalidProof)
 * - Cannot pass 0 as totalAllocation (reverts with ZeroAllocation or InvalidProof)
 *
 * SOLUTION:
 * - Create a minimal valid Merkle tree with a single dummy leaf
 * - Use totalAlloc = 1 wei (minimal non-zero value)
 * - Approve 1 wei of tokens from project owner
 *
 * This satisfies contract validation while keeping actual vesting negligible.
 */

const Status = {
  0: 'UPCOMING',
  1: 'ACTIVE',
  2: 'ENDED',
  3: 'FINALIZED_SUCCESS',
  4: 'FINALIZED_FAILED',
  5: 'CANCELLED',
};

async function main() {
  console.log('\n🚀 FINALIZE PRESALE (NO VESTING)\n');

  const roundAddr = '0x4ACE2f1826aA7c70De67E2855eDd98151A2E9Eb1';
  const round = await hre.ethers.getContractAt('PresaleRound', roundAddr);

  // Get signers
  const signers = await hre.ethers.getSigners();
  const timelock = signers[2]; // Timelock (has ADMIN_ROLE)
  const projectOwner = signers[1]; // ADMIN wallet (owns project tokens)

  console.log(`Using admin: ${timelock.address}`);
  console.log(`Project owner (token holder): ${projectOwner.address}`);
  console.log(`PresaleRound: ${roundAddr}\n`);

  // ============================================
  // STEP 1: Check status
  // ============================================
  console.log('📊 Step 1: Checking presale state...');
  const statusBefore = await round.status();
  const totalRaised = await round.totalRaised();
  const softCap = await round.softCap();
  const projectToken = await round.projectToken();
  const vestingVault = await round.vestingVault();
  const actualProjectOwner = await round.projectOwner();

  console.log(`  Status: ${Status[statusBefore]}`);
  console.log(`  Total Raised: ${hre.ethers.formatEther(totalRaised)} BNB`);
  console.log(`  Softcap: ${hre.ethers.formatEther(softCap)} BNB`);
  console.log(`  Softcap Met: ${totalRaised >= softCap ? '✅' : '❌'}`);
  console.log(`  Project Token: ${projectToken}`);
  console.log(`  Vesting Vault: ${vestingVault}`);
  console.log(`  Actual Project Owner: ${actualProjectOwner}\n`);

  // ============================================
  // STEP 2: Generate minimal Merkle tree
  // ============================================
  console.log('🌳 Step 2: Generating minimal Merkle tree...');

  // Strategy: Create a tree with a single dummy beneficiary
  // Use 1 wei allocation to satisfy non-zero validation
  const dummyBeneficiary = '0x0000000000000000000000000000000000000001';
  const dummyAllocation = 1n; // 1 wei

  // Get vesting vault contract to check salt
  const vestingContract = await hre.ethers.getContractAt('MerkleVesting', vestingVault);
  const scheduleSalt = await vestingContract.scheduleSalt();
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;

  console.log(`  Schedule Salt: ${scheduleSalt}`);
  console.log(`  Chain ID: ${chainId}`);

  // Encode leaf exactly as contract expects
  const leaf = keccak256(
    hre.ethers.solidityPacked(
      ['address', 'uint256', 'bytes32', 'address', 'uint256'],
      [vestingVault, chainId, scheduleSalt, dummyBeneficiary, dummyAllocation]
    )
  );

  console.log(`  Dummy Leaf: ${leaf}`);

  // Create Merkle tree
  const tree = new MerkleTree([leaf], keccak256, { sortPairs: true });
  const merkleRoot = tree.getHexRoot();

  console.log(`  Merkle Root: ${merkleRoot}`);
  console.log(`  Total Allocation: ${dummyAllocation} wei (negligible)\n`);

  // ============================================
  // STEP 3: Approve tokens
  // ============================================
  console.log('💰 Step 3: Approving tokens...');

  const tokenContract = await hre.ethers.getContractAt('IERC20', projectToken);
  const ownerBalance = await tokenContract.balanceOf(actualProjectOwner);

  console.log(`  Project Owner Balance: ${hre.ethers.formatEther(ownerBalance)} tokens`);

  if (ownerBalance < dummyAllocation) {
    console.log(`  ❌ Project owner doesn't have enough tokens!`);
    console.log(`  Required: ${dummyAllocation} wei`);
    console.log(`  Actual: ${ownerBalance}\n`);
    return;
  }

  // Approve from project owner
  console.log(`  Approving ${dummyAllocation} wei to vesting vault...`);
  const approveTx = await tokenContract.connect(projectOwner).approve(roundAddr, dummyAllocation);
  await approveTx.wait();
  console.log(`  ✅ Approval confirmed\n`);

  // ============================================
  // STEP 4: Execute finalization
  // ============================================
  console.log('🎯 Step 4: Executing finalizeSuccess...');

  try {
    // Estimate gas
    console.log('  📊 Estimating gas...');
    const gasEstimate = await round
      .connect(timelock)
      .finalizeSuccess.estimateGas(merkleRoot, dummyAllocation);
    console.log(`  Gas Estimate: ${gasEstimate.toString()}\n`);

    // Execute
    console.log('  📤 Sending transaction...');
    const tx = await round.connect(timelock).finalizeSuccess(merkleRoot, dummyAllocation, {
      gasLimit: (gasEstimate * 120n) / 100n,
    });

    console.log(`  Transaction Hash: ${tx.hash}`);
    console.log('  ⏳ Waiting for confirmation...\n');

    const receipt = await tx.wait();
    console.log(`  ✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`  Gas Used: ${receipt.gasUsed.toString()}\n`);

    // ============================================
    // STEP 5: Verify
    // ============================================
    console.log('✅ Step 5: Verification...');
    const statusAfter = await round.status();
    const tgeTimestamp = await round.tgeTimestamp();
    const contractBalance = await hre.ethers.provider.getBalance(roundAddr);

    console.log(`  Status: ${Status[statusAfter]}`);
    console.log(`  TGE Timestamp: ${new Date(Number(tgeTimestamp) * 1000).toLocaleString()}`);
    console.log(`  Contract Balance: ${hre.ethers.formatEther(contractBalance)} BNB`);
    console.log(`  Expected: 0 BNB (all distributed)\n`);

    // Parse events
    console.log('📜 Events:');
    for (const log of receipt.logs) {
      try {
        const parsed = round.interface.parseLog({
          topics: log.topics,
          data: log.data,
        });
        if (parsed && parsed.name === 'FinalizedSuccess') {
          console.log(`  ✅ FinalizedSuccess:`);
          console.log(`     Total Raised: ${hre.ethers.formatEther(parsed.args.totalRaised)} BNB`);
          console.log(`     Fee Amount: ${hre.ethers.formatEther(parsed.args.feeAmount)} BNB`);
          console.log(
            `     TGE: ${new Date(Number(parsed.args.tgeTimestamp) * 1000).toLocaleString()}`
          );
        }
      } catch (e) {
        // Skip
      }
    }

    console.log('\n✅ FINALIZATION SUCCESSFUL!\n');
  } catch (error) {
    console.log('\n❌ FINALIZATION FAILED\n');
    console.log(`Error: ${error.message}\n`);

    if (error.data) {
      console.log(`Error Data: ${error.data}`);
      try {
        const iface = round.interface;
        const decoded = iface.parseError(error.data);
        if (decoded) {
          console.log(`Decoded: ${decoded.name}(${decoded.args.join(', ')})\n`);
        }
      } catch (e) {
        // Ignore
      }
    }

    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
