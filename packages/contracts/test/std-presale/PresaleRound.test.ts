import { expect } from 'chai';
import { ethers } from 'hardhat';
import { increaseTime, now, setNextTimestamp } from './helpers/time';
import { buildMerkle } from './helpers/merkle';

describe('PresaleRound v2.1', function () {
  async function deployFixture() {
    const [admin, projectOwner, alice, bob, treasury, referral, sbt] = await ethers.getSigners();

    // Mock ERC20 tokens
    const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
    const paymentToken = await ERC20Mock.deploy('USD Coin', 'USDC', 6);
    await paymentToken.waitForDeployment();

    const projectToken = await ERC20Mock.deploy('Project', 'PRJ', 18);
    await projectToken.waitForDeployment();

    // Mint payment tokens to users (1000 USDC each with proper decimals)
    await paymentToken.mint(alice.address, 10_000n * 1_000_000n);
    await paymentToken.mint(bob.address, 10_000n * 1_000_000n);

    // Mint project tokens to owner (for vesting funding)
    await projectToken.mint(projectOwner.address, 1_000_000_000_000_000_000_000n);

    // Deploy FeeSplitter
    const FeeSplitter = await ethers.getContractFactory('FeeSplitter');
    const feeSplitter = await FeeSplitter.deploy(
      treasury.address,
      referral.address,
      sbt.address,
      admin.address
    );
    await feeSplitter.waitForDeployment();

    // Deploy MerkleVesting for investors
    const MerkleVesting = await ethers.getContractFactory('MerkleVesting');
    const salt = ethers.id('test-round-1');
    const vestingVault = await MerkleVesting.deploy(
      await projectToken.getAddress(),
      1000n, // 10% TGE
      0n, // no cliff
      180n * 24n * 3600n, // 180 days vesting
      salt,
      admin.address
    );
    await vestingVault.waitForDeployment();

    const t = await now();
    const start = t + 60;
    const end = start + 3600;

    // Deploy PresaleRound
    const PresaleRound = await ethers.getContractFactory('PresaleRound');
    const round = await PresaleRound.deploy(
      await projectToken.getAddress(),
      await paymentToken.getAddress(),
      1000n * 1_000_000n, // softCap: 1000 USDC
      5000n * 1_000_000n, // hardCap: 5000 USDC
      100n * 1_000_000n, // min: 100 USDC
      2000n * 1_000_000n, // max: 2000 USDC
      start,
      end,
      await feeSplitter.getAddress(),
      await vestingVault.getAddress(),
      projectOwner.address,
      admin.address
    );
    await round.waitForDeployment();

    // Grant presale role to round
    await feeSplitter.connect(admin).grantPresaleRole(await round.getAddress());

    // Grant ADMIN_ROLE to round on vesting vault (so it can call setMerkleRoot)
    const ADMIN_ROLE = ethers.id('ADMIN_ROLE');
    await vestingVault.connect(admin).grantRole(ADMIN_ROLE, await round.getAddress());

    return {
      admin,
      projectOwner,
      alice,
      bob,
      treasury,
      referral,
      sbt,
      paymentToken,
      projectToken,
      feeSplitter,
      vestingVault,
      round,
      start,
      end,
      salt,
    };
  }

  it('P0: should lock setFeeConfig after startTime / after any contribution', async () => {
    const { admin, round, start } = await deployFixture();

    // before start -> allowed (if status UPCOMING and totalRaised==0)
    const newCfg = { totalBps: 500, treasuryBps: 250, referralPoolBps: 200, sbtStakingBps: 50 };
    await expect(round.connect(admin).setFeeConfig(newCfg)).to.not.be.reverted;

    // after start -> revert
    await setNextTimestamp(start + 1);
    await expect(round.connect(admin).setFeeConfig(newCfg)).to.be.revertedWithCustomError(
      round,
      'ConfigLocked'
    );
  });

  it('P0: should not deduct fee during contribute (escrow full amount)', async () => {
    const { alice, paymentToken, round, start } = await deployFixture();
    await setNextTimestamp(start + 1);

    const amount = 500n * 1_000_000n; // 500 USDC
    await paymentToken.connect(alice).approve(await round.getAddress(), amount);

    const balBefore = await paymentToken.balanceOf(await round.getAddress());
    await round.connect(alice).contribute(amount, ethers.ZeroAddress);
    const balAfter = await paymentToken.balanceOf(await round.getAddress());

    expect(balAfter - balBefore).to.equal(amount);
  });

  it('P0: finalize does not deadlock if no tx after endTime (status sync in finalize)', async () => {
    const {
      admin,
      alice,
      projectOwner,
      paymentToken,
      projectToken,
      vestingVault,
      round,
      start,
      end,
      salt,
    } = await deployFixture();
    await setNextTimestamp(start + 1);

    const amount = 1500n * 1_000_000n; // >= softcap
    await paymentToken.connect(alice).approve(await round.getAddress(), amount);
    await round.connect(alice).contribute(amount, ethers.ZeroAddress);

    // Jump beyond endTime WITHOUT any more tx
    await setNextTimestamp(end + 10);

    // Build merkle tree
    const net = await ethers.provider.getNetwork();
    const { root } = buildMerkle(await vestingVault.getAddress(), net.chainId, salt, [
      { beneficiary: alice.address, totalAllocation: 1_000_000_000_000_000_000_000n },
    ]);

    // Fund vesting vault
    const totalVestingAlloc = 1_000_000_000_000_000_000_000n;
    await projectToken.connect(projectOwner).approve(await round.getAddress(), totalVestingAlloc);

    await expect(round.connect(admin).finalizeSuccess(root, totalVestingAlloc)).to.not.be.reverted;
  });

  it('P0: refunds accessible even when paused (FAILED path)', async () => {
    const { admin, alice, paymentToken, round, start, end } = await deployFixture();
    await setNextTimestamp(start + 1);

    const amount = 500n * 1_000_000n; // < softcap to force fail
    await paymentToken.connect(alice).approve(await round.getAddress(), amount);
    await round.connect(alice).contribute(amount, ethers.ZeroAddress);

    await setNextTimestamp(end + 10);

    await round.connect(admin).finalizeFailed('Softcap not met');
    await round.connect(admin).pause();

    const userBalBefore = await paymentToken.balanceOf(alice.address);
    await expect(round.connect(alice).claimRefund()).to.not.be.reverted;
    const userBalAfter = await paymentToken.balanceOf(alice.address);

    expect(userBalAfter - userBalBefore).to.equal(amount);
  });

  it('P0: fee only moves at finalizeSuccess and is split via FeeSplitter', async () => {
    const {
      admin,
      alice,
      projectOwner,
      paymentToken,
      projectToken,
      feeSplitter,
      vestingVault,
      treasury,
      referral,
      sbt,
      round,
      start,
      end,
      salt,
    } = await deployFixture();

    await setNextTimestamp(start + 1);

    const amount = 2000n * 1_000_000n;
    await paymentToken.connect(alice).approve(await round.getAddress(), amount);
    await round.connect(alice).contribute(amount, ethers.ZeroAddress);

    await setNextTimestamp(end + 10);

    const t0 = await paymentToken.balanceOf(treasury.address);
    const r0 = await paymentToken.balanceOf(referral.address);
    const s0 = await paymentToken.balanceOf(sbt.address);

    // Build merkle and fund vesting
    const net = await ethers.provider.getNetwork();
    const totalVesting = 1_000_000_000_000_000_000_000n;
    const { root } = buildMerkle(await vestingVault.getAddress(), net.chainId, salt, [
      { beneficiary: alice.address, totalAllocation: totalVesting },
    ]);

    await projectToken.connect(projectOwner).approve(await round.getAddress(), totalVesting);

    await round.connect(admin).finalizeSuccess(root, totalVesting);

    const t1 = await paymentToken.balanceOf(treasury.address);
    const r1 = await paymentToken.balanceOf(referral.address);
    const s1 = await paymentToken.balanceOf(sbt.address);

    // Fee distributed
    expect(t1 + r1 + s1).to.be.greaterThan(t0 + r0 + s0);

    // Check approximate split (5% of 2000 = 100 USDC)
    const totalFee = (amount * 500n) / 10000n; // 5% = 100 USDC (100_000_000 with 6 decimals)

    // Treasury gets 2.5% of total = 250 BPS out of 10000
    expect(t1 - t0).to.be.closeTo((totalFee * 250n) / 500n, 100_000n); // 50% of fee
    // Or more precisely: (amount * 250) / 10000 = 2.5% of total
    expect(t1 - t0).to.equal((amount * 250n) / 10000n);
  });
});
