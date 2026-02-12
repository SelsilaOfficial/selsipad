const { expect } = require('chai');
const { ethers, network } = require('hardhat');
const { MerkleTree } = require('merkletreejs');

// Load hardhat-chai-matchers for revertedWithCustomError
require('@nomicfoundation/hardhat-toolbox');

// ─── Helpers ───

function keccak256Fn(data) {
  return Buffer.from(ethers.keccak256(data).slice(2), 'hex');
}

async function nowTs() {
  const block = await network.provider.send('eth_getBlockByNumber', ['latest', false]);
  return parseInt(block.timestamp, 16);
}

async function setNextTimestamp(ts) {
  await network.provider.send('evm_setNextBlockTimestamp', [ts]);
  await network.provider.send('evm_mine');
}

function leafFor(vestingAddress, chainId, salt, beneficiary, totalAllocation) {
  const packed = ethers.solidityPacked(
    ['address', 'uint256', 'bytes32', 'address', 'uint256'],
    [vestingAddress, chainId, salt, beneficiary, totalAllocation]
  );
  return Buffer.from(ethers.keccak256(packed).slice(2), 'hex');
}

function buildMerkle(vestingAddress, chainId, salt, entries) {
  const leaves = entries.map((e) =>
    leafFor(vestingAddress, chainId, salt, e.beneficiary, e.totalAllocation)
  );
  const tree = new MerkleTree(leaves, keccak256Fn, { sortPairs: true });
  const root = '0x' + tree.getRoot().toString('hex');
  function proof(beneficiary, totalAllocation) {
    const leaf = leafFor(vestingAddress, chainId, salt, beneficiary, totalAllocation);
    return tree.getProof(leaf).map((p) => '0x' + p.data.toString('hex'));
  }
  return { root, proof };
}

// ═══════════════════════════════════════════════════════════════
describe('PresaleRound V2.4 – Phase-Based Finalization with LP', function () {
  async function deployV24Fixture() {
    const [admin, projectOwner, alice, bob, charlie, treasury, referralAddr, sbt] =
      await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
    const projectToken = await ERC20Mock.deploy('TestToken', 'TST', 18);
    await projectToken.waitForDeployment();
    await projectToken.mint(projectOwner.address, ethers.parseUnits('2000000', 18));

    const EscrowVault = await ethers.getContractFactory('EscrowVault');
    const escrow = await EscrowVault.deploy();
    await escrow.waitForDeployment();

    const FeeSplitter = await ethers.getContractFactory('FeeSplitter');
    const feeSplitter = await FeeSplitter.deploy(
      treasury.address,
      referralAddr.address,
      sbt.address,
      admin.address
    );
    await feeSplitter.waitForDeployment();

    const salt = ethers.id('v24-test-salt-1');
    const MerkleVesting = await ethers.getContractFactory('MerkleVesting');
    const vestingVault = await MerkleVesting.deploy(
      await projectToken.getAddress(),
      1000n,
      0n,
      180n * 24n * 3600n,
      salt,
      admin.address
    );
    await vestingVault.waitForDeployment();

    const RouterMock = await ethers.getContractFactory('UniversalRouterMock');
    const dexRouter = await RouterMock.deploy();
    await dexRouter.waitForDeployment();

    const LockerMock = await ethers.getContractFactory('MockLPLocker');
    const lpLocker = await LockerMock.deploy();
    await lpLocker.waitForDeployment();

    const t = await nowTs();
    const start = t + 60;
    const end = start + 3600;
    const LIQUIDITY_BPS = 6000n;
    const LOCK_DURATION = 365n * 24n * 3600n;

    const PresaleRound = await ethers.getContractFactory('PresaleRound');
    const round = await PresaleRound.deploy(
      await projectToken.getAddress(),
      ethers.ZeroAddress,
      ethers.parseEther('1'), // softCap
      ethers.parseEther('5'), // hardCap
      ethers.parseEther('0.1'), // min
      ethers.parseEther('3'), // max
      start,
      end,
      await feeSplitter.getAddress(),
      await vestingVault.getAddress(),
      projectOwner.address,
      admin.address,
      await dexRouter.getAddress(),
      await lpLocker.getAddress(),
      LIQUIDITY_BPS,
      LOCK_DURATION
    );
    await round.waitForDeployment();

    await feeSplitter.connect(admin).grantPresaleRole(await round.getAddress());
    const ADMIN_ROLE = ethers.id('ADMIN_ROLE');
    await vestingVault.connect(admin).grantRole(ADMIN_ROLE, await round.getAddress());
    await round.connect(admin).setFeeConfig({
      totalBps: 500,
      treasuryBps: 250,
      referralPoolBps: 200,
      sbtStakingBps: 50,
    });

    return {
      admin,
      projectOwner,
      alice,
      bob,
      charlie,
      treasury,
      referralAddr,
      sbt,
      projectToken,
      escrow,
      feeSplitter,
      vestingVault,
      dexRouter,
      lpLocker,
      round,
      start,
      end,
      salt,
      LIQUIDITY_BPS,
      LOCK_DURATION,
    };
  }

  async function setupForFinalization(fix) {
    const {
      admin,
      alice,
      bob,
      projectOwner,
      projectToken,
      escrow,
      round,
      start,
      end,
      salt,
      vestingVault,
    } = fix;

    const tokensForSale = ethers.parseUnits('500000', 18);
    const projectId = ethers.id('v24-project-1');
    await projectToken.connect(projectOwner).approve(await escrow.getAddress(), tokensForSale);
    await escrow
      .connect(projectOwner)
      .deposit(projectId, await projectToken.getAddress(), tokensForSale);

    await setNextTimestamp(start + 1);
    const aliceAmt = ethers.parseEther('1.5');
    const bobAmt = ethers.parseEther('1');
    await round.connect(alice).contribute(aliceAmt, ethers.ZeroAddress, { value: aliceAmt });
    await round.connect(bob).contribute(bobAmt, ethers.ZeroAddress, { value: bobAmt });
    await setNextTimestamp(end + 10);
    await escrow.connect(admin).release(projectId, await round.getAddress());

    const net = await ethers.provider.getNetwork();
    const aliceAlloc = ethers.parseUnits('120000', 18);
    const bobAlloc = ethers.parseUnits('80000', 18);
    const totalVestingAllocation = aliceAlloc + bobAlloc;

    const { root, proof } = buildMerkle(await vestingVault.getAddress(), net.chainId, salt, [
      { beneficiary: alice.address, totalAllocation: aliceAlloc },
      { beneficiary: bob.address, totalAllocation: bobAlloc },
    ]);

    const tokensForLP = ethers.parseUnits('50000', 18);
    const tokenMinLP = (tokensForLP * 9500n) / 10000n;
    const totalRaised = aliceAmt + bobAmt;
    const feeAmount = (totalRaised * 500n) / 10000n;
    const netAfterFee = totalRaised - feeAmount;
    const lpBnb = (netAfterFee * 6000n) / 10000n;
    const bnbMinLP = (lpBnb * 9500n) / 10000n;
    const unsoldToBurn = ethers.parseUnits('10000', 18);

    return {
      projectId,
      tokensForSale,
      totalVestingAllocation,
      root,
      proof,
      aliceAlloc,
      bobAlloc,
      tokensForLP,
      tokenMinLP,
      bnbMinLP,
      unsoldToBurn,
      totalRaised,
      feeAmount,
      netAfterFee,
      lpBnb,
    };
  }

  // ══ TEST 1: Happy path — full 7-phase flow ══
  it('should complete full 7-phase finalization with LP', async function () {
    const fix = await deployV24Fixture();
    const { admin, projectOwner, round, vestingVault, projectToken } = fix;
    const setup = await setupForFinalization(fix);

    const ownerBalBefore = await ethers.provider.getBalance(projectOwner.address);

    const tx = await round
      .connect(admin)
      .finalizeSuccessEscrow(
        setup.root,
        setup.totalVestingAllocation,
        setup.unsoldToBurn,
        setup.tokensForLP,
        setup.tokenMinLP,
        setup.bnbMinLP
      );
    await tx.wait();

    // Status = FINALIZED_SUCCESS (4)
    expect(await round.status()).to.equal(4n);

    // Phase flags all true
    expect(await round.vestingFunded()).to.be.true;
    expect(await round.feePaid()).to.be.true;
    expect(await round.lpCreated()).to.be.true;
    expect(await round.ownerPaid()).to.be.true;

    // Snapshot was taken
    const snap = await round.snap();
    expect(snap.taken).to.be.true;

    // Merkle root set
    expect(await vestingVault.merkleRoot()).to.equal(setup.root);

    // Burned amount matches
    expect(await round.burnedAmount()).to.equal(setup.unsoldToBurn);

    // Burn address got tokens
    const burnAddr = '0x000000000000000000000000000000000000dEaD';
    const burnBal = await projectToken.balanceOf(burnAddr);
    expect(burnBal).to.equal(setup.unsoldToBurn);

    // Owner received BNB
    const ownerBalAfter = await ethers.provider.getBalance(projectOwner.address);
    expect(ownerBalAfter > ownerBalBefore).to.be.true;

    // LP lock ID assigned
    const lockId = await round.lpLockId();
    expect(lockId >= 0n).to.be.true;

    // Round BNB should be 0 (all distributed)
    const roundBal = await ethers.provider.getBalance(await round.getAddress());
    expect(roundBal).to.equal(0n);
  });

  // ══ TEST 2: Double finalize reverts ══
  it('should revert on double finalization', async function () {
    const fix = await deployV24Fixture();
    const { admin, round } = fix;
    const setup = await setupForFinalization(fix);

    await round
      .connect(admin)
      .finalizeSuccessEscrow(
        setup.root,
        setup.totalVestingAllocation,
        setup.unsoldToBurn,
        setup.tokensForLP,
        setup.tokenMinLP,
        setup.bnbMinLP
      );

    let failed = false;
    try {
      await round
        .connect(admin)
        .finalizeSuccessEscrow(
          setup.root,
          setup.totalVestingAllocation,
          setup.unsoldToBurn,
          setup.tokensForLP,
          setup.tokenMinLP,
          setup.bnbMinLP
        );
    } catch (err) {
      failed = true;
      expect(err.message).to.include('AlreadyFinalized');
    }
    expect(failed).to.be.true;
  });

  // ══ TEST 3: External deposit does NOT inflate owner payout ══
  it('should not inflate owner payout from external deposits', async function () {
    const fix = await deployV24Fixture();
    const { admin, projectOwner, round, charlie } = fix;
    const setup = await setupForFinalization(fix);

    // External deposit of 10 ETH
    const externalDeposit = ethers.parseEther('10');
    await charlie.sendTransaction({ to: await round.getAddress(), value: externalDeposit });

    const ownerBefore = await ethers.provider.getBalance(projectOwner.address);

    await round
      .connect(admin)
      .finalizeSuccessEscrow(
        setup.root,
        setup.totalVestingAllocation,
        setup.unsoldToBurn,
        setup.tokensForLP,
        setup.tokenMinLP,
        setup.bnbMinLP
      );

    expect(await round.status()).to.equal(4n);

    // Owner payout based on 2.5 ETH (totalRaised), NOT 12.5 ETH (balance)
    const ownerAfter = await ethers.provider.getBalance(projectOwner.address);
    const ownerReceived = ownerAfter - ownerBefore;

    // Owner should receive < 3 ETH (ownerBnb ~ 0.95 ETH)
    expect(ownerReceived < ethers.parseEther('3')).to.be.true;

    // Excess 10 ETH stays in contract (sweepable)
    const roundBal = await ethers.provider.getBalance(await round.getAddress());
    expect(roundBal >= ethers.parseEther('9')).to.be.true;
  });

  // ══ TEST 4: sweepExcess after finalization ══
  it('should allow admin to sweep excess BNB after finalization', async function () {
    const fix = await deployV24Fixture();
    const { admin, round, charlie } = fix;
    const setup = await setupForFinalization(fix);

    await charlie.sendTransaction({ to: await round.getAddress(), value: ethers.parseEther('5') });

    await round
      .connect(admin)
      .finalizeSuccessEscrow(
        setup.root,
        setup.totalVestingAllocation,
        setup.unsoldToBurn,
        setup.tokensForLP,
        setup.tokenMinLP,
        setup.bnbMinLP
      );

    const roundBal = await ethers.provider.getBalance(await round.getAddress());
    expect(roundBal > 0n).to.be.true;

    await round.connect(admin).sweepExcess(admin.address);

    const roundBalAfter = await ethers.provider.getBalance(await round.getAddress());
    expect(roundBalAfter).to.equal(0n);
  });

  // ══ TEST 5: sweepExcess reverts before finalization ══
  it('should revert sweepExcess if not finalized', async function () {
    const fix = await deployV24Fixture();
    const { admin, round } = fix;
    await setupForFinalization(fix);

    let failed = false;
    try {
      await round.connect(admin).sweepExcess(admin.address);
    } catch (err) {
      failed = true;
      expect(err.message).to.include('InvalidStatus');
    }
    expect(failed).to.be.true;
  });

  // ══ TEST 6: Fee=0 auto-flags feePaid ══
  it('should auto-flag feePaid when feeAmount is 0', async function () {
    const fix = await deployV24Fixture();
    const { admin, round } = fix;

    await round.connect(admin).setFeeConfig({
      totalBps: 0,
      treasuryBps: 0,
      referralPoolBps: 0,
      sbtStakingBps: 0,
    });

    const setup = await setupForFinalization(fix);

    await round
      .connect(admin)
      .finalizeSuccessEscrow(
        setup.root,
        setup.totalVestingAllocation,
        setup.unsoldToBurn,
        setup.tokensForLP,
        setup.tokenMinLP,
        setup.bnbMinLP
      );

    expect(await round.status()).to.equal(4n);
    expect(await round.feePaid()).to.be.true;
    expect(await round.ownerPaid()).to.be.true;
  });

  // ══ TEST 7: InsufficientTokenBudget revert ══
  it('should revert with InsufficientTokenBudget if not enough tokens', async function () {
    const fix = await deployV24Fixture();
    const {
      admin,
      alice,
      bob,
      projectOwner,
      projectToken,
      escrow,
      round,
      start,
      end,
      salt,
      vestingVault,
    } = fix;

    const smallDeposit = ethers.parseUnits('100000', 18);
    const projectId = ethers.id('v24-insufficient');
    await projectToken.connect(projectOwner).approve(await escrow.getAddress(), smallDeposit);
    await escrow
      .connect(projectOwner)
      .deposit(projectId, await projectToken.getAddress(), smallDeposit);

    await setNextTimestamp(start + 1);
    const a = ethers.parseEther('1.5');
    const b = ethers.parseEther('1');
    await round.connect(alice).contribute(a, ethers.ZeroAddress, { value: a });
    await round.connect(bob).contribute(b, ethers.ZeroAddress, { value: b });
    await setNextTimestamp(end + 10);
    await escrow.connect(admin).release(projectId, await round.getAddress());

    const net = await ethers.provider.getNetwork();
    const aliceAlloc = ethers.parseUnits('120000', 18);
    const bobAlloc = ethers.parseUnits('80000', 18);
    const totalVesting = aliceAlloc + bobAlloc;
    const { root } = buildMerkle(await vestingVault.getAddress(), net.chainId, salt, [
      { beneficiary: alice.address, totalAllocation: aliceAlloc },
      { beneficiary: bob.address, totalAllocation: bobAlloc },
    ]);

    const tokensForLP = ethers.parseUnits('50000', 18);
    const unsoldToBurn = ethers.parseUnits('10000', 18);

    let failed = false;
    try {
      await round
        .connect(admin)
        .finalizeSuccessEscrow(root, totalVesting, unsoldToBurn, tokensForLP, 0n, 0n);
    } catch (err) {
      failed = true;
      expect(err.message).to.include('InsufficientTokenBudget');
    }
    expect(failed).to.be.true;
  });

  // ══ TEST 8: LP=0 (no LP configured at deployment) ══
  it('should finalize without LP when liquidityBps=0', async function () {
    // Deploy a separate round with liquidityBps=0
    const [admin, projectOwner, alice, bob, _c, treasury, refAddr, sbt] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
    const token = await ERC20Mock.deploy('NoLP', 'NLP', 18);
    await token.waitForDeployment();
    await token.mint(projectOwner.address, ethers.parseUnits('2000000', 18));

    const EscrowVault = await ethers.getContractFactory('EscrowVault');
    const escrow = await EscrowVault.deploy();
    await escrow.waitForDeployment();

    const FeeSplitter = await ethers.getContractFactory('FeeSplitter');
    const fs = await FeeSplitter.deploy(
      treasury.address,
      refAddr.address,
      sbt.address,
      admin.address
    );
    await fs.waitForDeployment();

    const salt = ethers.id('no-lp-test');
    const MerkleVesting = await ethers.getContractFactory('MerkleVesting');
    const vesting = await MerkleVesting.deploy(
      await token.getAddress(),
      1000n,
      0n,
      180n * 24n * 3600n,
      salt,
      admin.address
    );
    await vesting.waitForDeployment();

    const t = await nowTs();
    const start = t + 60;
    const end = start + 3600;

    const PresaleRound = await ethers.getContractFactory('PresaleRound');
    const round = await PresaleRound.deploy(
      await token.getAddress(),
      ethers.ZeroAddress,
      ethers.parseEther('1'),
      ethers.parseEther('5'),
      ethers.parseEther('0.1'),
      ethers.parseEther('3'),
      start,
      end,
      await fs.getAddress(),
      await vesting.getAddress(),
      projectOwner.address,
      admin.address,
      ethers.ZeroAddress, // dexRouter=0 (no LP)
      ethers.ZeroAddress, // lpLocker=0 (no LP)
      0n, // liquidityBps=0
      0n // lpLockDuration=0
    );
    await round.waitForDeployment();

    await fs.connect(admin).grantPresaleRole(await round.getAddress());
    const ADMIN_ROLE = ethers.id('ADMIN_ROLE');
    await vesting.connect(admin).grantRole(ADMIN_ROLE, await round.getAddress());
    await round.connect(admin).setFeeConfig({
      totalBps: 500,
      treasuryBps: 250,
      referralPoolBps: 200,
      sbtStakingBps: 50,
    });

    // Deposit tokens & contribute
    const tokensForSale = ethers.parseUnits('500000', 18);
    const projectId = ethers.id('no-lp-project');
    await token.connect(projectOwner).approve(await escrow.getAddress(), tokensForSale);
    await escrow.connect(projectOwner).deposit(projectId, await token.getAddress(), tokensForSale);

    await setNextTimestamp(start + 1);
    const a = ethers.parseEther('1.5');
    const b = ethers.parseEther('1');
    await round.connect(alice).contribute(a, ethers.ZeroAddress, { value: a });
    await round.connect(bob).contribute(b, ethers.ZeroAddress, { value: b });
    await setNextTimestamp(end + 10);
    await escrow.connect(admin).release(projectId, await round.getAddress());

    // Build merkle tree
    const net = await ethers.provider.getNetwork();
    const aliceAlloc = ethers.parseUnits('120000', 18);
    const bobAlloc = ethers.parseUnits('80000', 18);
    const totalVesting = aliceAlloc + bobAlloc;
    const { root } = buildMerkle(await vesting.getAddress(), net.chainId, salt, [
      { beneficiary: alice.address, totalAllocation: aliceAlloc },
      { beneficiary: bob.address, totalAllocation: bobAlloc },
    ]);

    const ownerBefore = await ethers.provider.getBalance(projectOwner.address);

    await round.connect(admin).finalizeSuccessEscrow(
      root,
      totalVesting,
      ethers.parseUnits('10000', 18),
      0n,
      0n,
      0n // No LP
    );

    expect(await round.status()).to.equal(4n);
    expect(await round.lpCreated()).to.be.false;
    expect(await round.ownerPaid()).to.be.true;

    const ownerAfter = await ethers.provider.getBalance(projectOwner.address);
    expect(ownerAfter > ownerBefore).to.be.true;
  });
});
