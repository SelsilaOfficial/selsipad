/**
 * Server-Only Merkle Tree Generation
 *
 * CRITICAL SECURITY:
 * - This file MUST NEVER be imported by client components
 * - All merkle generation happens server-side only
 * - Leaf encoding MUST match on-chain format exactly
 * - Enforce 2+ leaves requirement (add dummy if needed)
 */

import { keccak256, encodePacked } from 'viem';
import { MerkleTree } from 'merkletreejs';

export interface Allocation {
  address: string;
  allocation: bigint;
}

export interface MerkleData {
  root: string;
  proofsByWallet: Record<string, string[]>;
  snapshotHash: string;
  totalAllocation: bigint;
}

/**
 * Generate merkle leaf matching on-chain format
 *
 * Solidity: keccak256(abi.encodePacked(vestingAddress, chainId, scheduleSalt, beneficiary, totalAllocation))
 */
export function encodeLeaf(
  vestingAddress: string,
  chainId: number,
  scheduleSalt: string,
  beneficiary: string,
  allocation: bigint
): string {
  return keccak256(
    encodePacked(
      ['address', 'uint256', 'bytes32', 'address', 'uint256'],
      [
        vestingAddress as `0x${string}`,
        BigInt(chainId),
        scheduleSalt as `0x${string}`,
        beneficiary as `0x${string}`,
        allocation,
      ]
    )
  );
}

/**
 * Generate merkle tree from allocations
 *
 * Security Requirements:
 * - MUST have 2+ leaves (enforced)
 * - Proofs length > 0 for all real users
 * - Snapshot hash for verification
 */
export function generateMerkleTree(
  allocations: Allocation[],
  vestingVault: string,
  chainId: number,
  scheduleSalt: string
): MerkleData {
  if (allocations.length === 0) {
    throw new Error('Cannot generate merkle tree with 0 allocations');
  }

  // SECURITY: Enforce 2+ leaves
  let leaves: string[] = [];
  let finalAllocations = [...allocations];

  if (allocations.length === 1) {
    // Add dummy leaf with 0 allocation
    const DUMMY_ADDRESS = '0x0000000000000000000000000000000000000001';
    finalAllocations.push({
      address: DUMMY_ADDRESS,
      allocation: 0n,
    });

    console.warn('⚠️  Only 1 allocation found. Adding dummy leaf for security.');
  }

  // Generate leaves
  leaves = finalAllocations.map((a) =>
    encodeLeaf(vestingVault, chainId, scheduleSalt, a.address, a.allocation)
  );

  // Build merkle tree
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getHexRoot();

  // Generate proofs for each allocation
  const proofsByWallet: Record<string, string[]> = {};

  allocations.forEach((a, index) => {
    const proof = tree.getHexProof(leaves[index]!);
    proofsByWallet[a.address.toLowerCase()] = proof;
  });

  // Calculate snapshot hash (for verification)
  const snapshotData = allocations
    .map((a) => `${a.address}:${a.allocation.toString()}`)
    .sort()
    .join('|');
  const snapshotHash = keccak256(encodePacked(['string'], [snapshotData]));

  // Calculate total allocation
  const totalAllocation = allocations.reduce((sum, a) => sum + a.allocation, 0n);

  return {
    root,
    proofsByWallet,
    snapshotHash,
    totalAllocation,
  };
}

/**
 * Verify that a proof is valid for given parameters
 */
export function verifyProof(
  proof: string[],
  root: string,
  vestingAddress: string,
  chainId: number,
  scheduleSalt: string,
  beneficiary: string,
  allocation: bigint
): boolean {
  const leaf = encodeLeaf(vestingAddress, chainId, scheduleSalt, beneficiary, allocation);
  const tree = new MerkleTree([], keccak256, { sortPairs: true });
  return tree.verify(proof, leaf, root);
}
