import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import { ethers } from 'ethers';

export function leafFor(
  vestingAddress: string,
  chainId: bigint,
  scheduleSalt: string, // bytes32 as hex string
  beneficiary: string,
  totalAllocation: bigint
): Buffer {
  const packed = ethers.solidityPacked(
    ['address', 'uint256', 'bytes32', 'address', 'uint256'],
    [vestingAddress, chainId, scheduleSalt, beneficiary, totalAllocation]
  );
  const hash = ethers.keccak256(packed);
  return Buffer.from(hash.slice(2), 'hex');
}

export function buildMerkle(
  vestingAddress: string,
  chainId: bigint,
  scheduleSalt: string, // bytes32 as hex
  entries: Array<{ beneficiary: string; totalAllocation: bigint }>
) {
  const leaves = entries.map((e) =>
    leafFor(vestingAddress, chainId, scheduleSalt, e.beneficiary, e.totalAllocation)
  );
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = '0x' + tree.getRoot().toString('hex');

  function proof(beneficiary: string, totalAllocation: bigint): string[] {
    const leaf = leafFor(vestingAddress, chainId, scheduleSalt, beneficiary, totalAllocation);
    return tree.getProof(leaf).map((p) => '0x' + p.data.toString('hex'));
  }

  return { tree, root, proof };
}
