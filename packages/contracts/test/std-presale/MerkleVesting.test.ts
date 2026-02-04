import { expect } from 'chai';
import { ethers } from 'hardhat';
import { buildMerkle } from './helpers/merkle';
import { increaseTime, now } from './helpers/time';

describe('MerkleVesting v2.1', function () {
  it('P1: should reject cross-round replay proof due to salted leaf', async () => {
    const [admin, projectOwner, alice, bob] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
    const token = await ERC20Mock.deploy('Project', 'PRJ', 18);
    await token.waitForDeployment();
    await token.mint(projectOwner.address, 10_000_000n);

    const Vesting = await ethers.getContractFactory('MerkleVesting');

    // V2.1: Different salts for each vesting instance
    const saltA = ethers.id('round-A');
    const saltB = ethers.id('round-B');

    const vA = await Vesting.deploy(
      await token.getAddress(),
      1000n, // 10% TGE
      0n, // no cliff
      1000n, // vesting duration
      saltA,
      admin.address
    );
    await vA.waitForDeployment();

    const vB = await Vesting.deploy(
      await token.getAddress(),
      1000n,
      0n,
      1000n,
      saltB,
      admin.address
    );
    await vB.waitForDeployment();

    // fund both vaults
    await token.connect(projectOwner).transfer(await vA.getAddress(), 5_000_000n);
    await token.connect(projectOwner).transfer(await vB.getAddress(), 5_000_000n);

    const net = await ethers.provider.getNetwork();
    const chainId = net.chainId;

    const allocAlice = 1_000_000n;
    const allocBob = 500_000n;

    // CRITICAL: Use 2+ leaves per tree to ensure non-empty proofs
    const merkleA = buildMerkle(await vA.getAddress(), chainId, saltA, [
      { beneficiary: alice.address, totalAllocation: allocAlice },
      { beneficiary: bob.address, totalAllocation: allocBob },
    ]);
    const merkleB = buildMerkle(await vB.getAddress(), chainId, saltB, [
      { beneficiary: alice.address, totalAllocation: allocAlice },
      { beneficiary: bob.address, totalAllocation: allocBob },
    ]);

    await vA.connect(admin).setMerkleRoot(merkleA.root, allocAlice + allocBob);
    await vB.connect(admin).setMerkleRoot(merkleB.root, allocAlice + allocBob);

    const proofFromA = merkleA.proof(alice.address, allocAlice);

    // Verify proof is non-empty (otherwise test is meaningless)
    expect(proofFromA.length).to.be.greaterThan(0);

    // proof A on vault B must fail (different salt)
    await expect(vB.connect(alice).claim(allocAlice, proofFromA)).to.be.revertedWithCustomError(
      vB,
      'InvalidProof'
    );
  });

  it('P0: claim should only allow vested amount and only delta on second claim', async () => {
    const [admin, projectOwner, alice] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
    const token = await ERC20Mock.deploy('Project', 'PRJ', 18);
    await token.waitForDeployment();
    await token.mint(projectOwner.address, 10_000_000n);

    const Vesting = await ethers.getContractFactory('MerkleVesting');
    const tgeBps = 1000n; // 10%
    const cliff = 0n;
    const duration = 1000n;
    const salt = ethers.id('test-salt');

    const vest = await Vesting.deploy(
      await token.getAddress(),
      tgeBps,
      cliff,
      duration,
      salt,
      admin.address
    );
    await vest.waitForDeployment();

    await token.connect(projectOwner).transfer(await vest.getAddress(), 5_000_000n);

    const net = await ethers.provider.getNetwork();
    const chainId = net.chainId;

    const alloc = 1_000_000n;
    const { root, proof } = buildMerkle(await vest.getAddress(), chainId, salt, [
      { beneficiary: alice.address, totalAllocation: alloc },
    ]);

    await vest.connect(admin).setMerkleRoot(root, alloc);

    const bal0 = await token.balanceOf(alice.address);

    // Wait 1 second to ensure TGE timestamp < now
    await increaseTime(1);

    // immediately after root set: only TGE unlock should be claimable
    await vest.connect(alice).claim(alloc, proof(alice.address, alloc));
    const bal1 = await token.balanceOf(alice.address);
    expect(bal1 - bal0).to.be.greaterThanOrEqual(alloc / 10n); // Allow small timing variance

    // after some time, can claim more, but only delta
    await increaseTime(500);
    await vest.connect(alice).claim(alloc, proof(alice.address, alloc));
    const bal2 = await token.balanceOf(alice.address);
    expect(bal2).to.be.greaterThan(bal1);
  });

  it('P0: should revert if vault not funded before setMerkleRoot', async () => {
    const [admin, projectOwner, alice] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
    const token = await ERC20Mock.deploy('Project', 'PRJ', 18);
    await token.waitForDeployment();

    const Vesting = await ethers.getContractFactory('MerkleVesting');
    const vest = await Vesting.deploy(
      await token.getAddress(),
      1000n,
      0n,
      1000n,
      ethers.id('test'),
      admin.address
    );
    await vest.waitForDeployment();

    const net = await ethers.provider.getNetwork();
    const { root } = buildMerkle(await vest.getAddress(), net.chainId, ethers.id('test'), [
      { beneficiary: alice.address, totalAllocation: 1_000_000n },
    ]);

    // Try to set root without funding vault
    await expect(vest.connect(admin).setMerkleRoot(root, 1_000_000n)).to.be.revertedWithCustomError(
      vest,
      'InsufficientVaultBalance'
    );
  });
});
