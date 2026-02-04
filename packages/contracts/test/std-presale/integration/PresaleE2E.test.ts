import { expect } from 'chai';
import { ethers } from 'hardhat';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

function parseEvent(rc: any, iface: any, name: string) {
  for (const log of rc.logs) {
    try {
      const p = iface.parseLog(log);
      if (p && p.name === name) return p;
    } catch {}
  }
  return null;
}

async function setNextTimestamp(ts: number) {
  await ethers.provider.send('evm_setNextBlockTimestamp', [ts]);
  await ethers.provider.send('evm_mine', []);
}

function leaf(
  vestingAddr: string,
  chainId: bigint,
  salt: string,
  beneficiary: string,
  total: bigint
): Buffer {
  const packed = ethers.solidityPacked(
    ['address', 'uint256', 'bytes32', 'address', 'uint256'],
    [vestingAddr, chainId, salt, beneficiary, total]
  );
  const h = ethers.keccak256(packed);
  return Buffer.from(h.slice(2), 'hex');
}

function buildMerkle(
  vestingAddr: string,
  chainId: bigint,
  salt: string,
  entries: Array<{ who: string; total: bigint }>
) {
  const leaves = entries.map((e) => leaf(vestingAddr, chainId, salt, e.who, e.total));
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = '0x' + tree.getRoot().toString('hex');
  const proof = (who: string, total: bigint) =>
    tree
      .getProof(leaf(vestingAddr, chainId, salt, who, total))
      .map((p) => '0x' + p.data.toString('hex'));
  return { root, proof };
}

describe('Presale E2E via Factory', function () {
  async function fixture() {
    const [admin, timelock, ops, projectOwner, alice, bob, treasury, referral, sbt] =
      await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
    const payment = await ERC20Mock.deploy('USDC', 'USDC', 6);
    await payment.waitForDeployment();

    const token = await ERC20Mock.deploy('PRJ', 'PRJ', 18);
    await token.waitForDeployment();

    // fund users
    await payment.mint(alice.address, 1_000_000_000n);
    await payment.mint(bob.address, 1_000_000_000n);

    // fund project owner with tokens for vesting vault
    await token.mint(projectOwner.address, 10_000_000_000_000_000_000n);

    const FeeSplitter = await ethers.getContractFactory('FeeSplitter');
    const feeSplitter = await FeeSplitter.deploy(
      treasury.address,
      referral.address,
      sbt.address,
      admin.address
    );
    await feeSplitter.waitForDeployment();

    const Factory = await ethers.getContractFactory('PresaleFactory');
    const factory = await Factory.deploy(await feeSplitter.getAddress(), timelock.address);
    await factory.waitForDeployment();

    // Grant admin role to factory on FeeSplitter so it can grant PRESALE_ROLE
    await feeSplitter.grantRole(await feeSplitter.DEFAULT_ADMIN_ROLE(), await factory.getAddress());

    const FACTORY_ADMIN_ROLE = await factory.FACTORY_ADMIN_ROLE();
    await factory.grantRole(FACTORY_ADMIN_ROLE, ops.address);

    return {
      admin,
      timelock,
      ops,
      projectOwner,
      alice,
      bob,
      treasury,
      referral,
      sbt,
      payment,
      token,
      feeSplitter,
      factory,
    };
  }

  it('IT1 Happy path: create -> contribute -> finalizeSuccess -> setRoot -> claim', async () => {
    const { timelock, ops, projectOwner, alice, bob, payment, token, factory } = await fixture();
    const net = await ethers.provider.getNetwork();
    const chainId = net.chainId;

    const now = (await ethers.provider.getBlock('latest'))!.timestamp;
    const start = now + 60;
    const end = start + 3600;

    const params = {
      projectToken: await token.getAddress(),
      paymentToken: await payment.getAddress(),
      softCap: 1000n,
      hardCap: 5000n,
      minContribution: 10n,
      maxContribution: 3000n,
      startTime: start,
      endTime: end,
      projectOwner: projectOwner.address,
    };

    const vest = {
      tgeUnlockBps: 1000n,
      cliffDuration: 0n,
      vestingDuration: 1000n,
      scheduleSalt: ethers.ZeroHash,
    };
    const lp = {
      lockMonths: 12n,
      dexId: ethers.keccak256(ethers.toUtf8Bytes('UNISWAP_V2')),
      liquidityPercent: 7000n,
    };
    const complianceHash = ethers.keccak256(ethers.toUtf8Bytes('compliance'));

    const tx = await factory.connect(ops).createPresale(params, vest, lp, complianceHash);
    const rc = await tx.wait();
    const evt = parseEvent(rc, factory.interface, 'PresaleCreated')!;
    const roundAddr = evt.args.round as string;
    const vestingAddr = evt.args.vesting as string;
    const salt = evt.args.scheduleSalt as string;

    const round = await ethers.getContractAt('PresaleRound', roundAddr);
    const vestingC = await ethers.getContractAt('MerkleVesting', vestingAddr);

    // move to ACTIVE
    await setNextTimestamp(start + 1);

    // contributions
    await payment.connect(alice).approve(roundAddr, 1000n);
    await round.connect(alice).contribute(1000n, ethers.ZeroAddress);

    await payment.connect(bob).approve(roundAddr, 500n);
    await round.connect(bob).contribute(500n, ethers.ZeroAddress);

    // Grant ADMIN_ROLE to ops for finalizing (round deployed with timelock as admin)
    const ADMIN_ROLE = ethers.id('ADMIN_ROLE');
    await round.connect(timelock).grantRole(ADMIN_ROLE, ops.address);

    // end time
    await setNextTimestamp(end + 10);

    // build merkle with 2+ leaves
    const allocAlice = 1_000_000n;
    const allocBob = 500_000n;

    // Fund vesting vault first
    await token.connect(projectOwner).transfer(vestingAddr, allocAlice + allocBob);

    // Approve round to pull tokens for vesting funding during finalizeSuccess
    await token.connect(projectOwner).approve(roundAddr, allocAlice + allocBob);

    const { root, proof } = buildMerkle(vestingAddr, chainId, salt, [
      { who: alice.address, total: allocAlice },
      { who: bob.address, total: allocBob },
    ]);
    expect(proof(alice.address, allocAlice).length).to.be.greaterThan(0);

    // finalize success with merkle root and total allocated
    await round.connect(ops).finalizeSuccess(root, allocAlice + allocBob);

    // claim TGE
    const bal0 = await token.balanceOf(alice.address);
    await vestingC.connect(alice).claim(allocAlice, proof(alice.address, allocAlice));
    const bal1 = await token.balanceOf(alice.address);
    expect(bal1).to.be.greaterThan(bal0);

    // claim delta after time
    await ethers.provider.send('evm_increaseTime', [500]);
    await ethers.provider.send('evm_mine', []);
    await vestingC.connect(alice).claim(allocAlice, proof(alice.address, allocAlice));
    const bal2 = await token.balanceOf(alice.address);
    expect(bal2).to.be.greaterThan(bal1);
  });

  it('IT2 Fail path: finalizeFailed -> pause -> refund works', async () => {
    const { timelock, ops, alice, payment, token, factory } = await fixture();
    const now = (await ethers.provider.getBlock('latest'))!.timestamp;
    const start = now + 60;
    const end = start + 3600;

    const params = {
      projectToken: await token.getAddress(),
      paymentToken: await payment.getAddress(),
      softCap: 2000n,
      hardCap: 5000n,
      minContribution: 10n,
      maxContribution: 3000n,
      startTime: start,
      endTime: end,
      projectOwner: ops.address,
    };

    const vest = {
      tgeUnlockBps: 1000n,
      cliffDuration: 0n,
      vestingDuration: 1000n,
      scheduleSalt: ethers.ZeroHash,
    };
    const lp = {
      lockMonths: 12n,
      dexId: ethers.keccak256(ethers.toUtf8Bytes('UNISWAP_V2')),
      liquidityPercent: 7000n,
    };
    const complianceHash = ethers.keccak256(ethers.toUtf8Bytes('compliance'));

    const tx = await factory.connect(ops).createPresale(params, vest, lp, complianceHash);
    const rc = await tx.wait();
    const evt = parseEvent(rc, factory.interface, 'PresaleCreated')!;
    const roundAddr = evt.args.round as string;

    const round = await ethers.getContractAt('PresaleRound', roundAddr);

    await setNextTimestamp(start + 1);

    await payment.connect(alice).approve(roundAddr, 500n); // < softcap
    await round.connect(alice).contribute(500n, ethers.ZeroAddress);

    // Grant ADMIN_ROLE to ops
    const ADMIN_ROLE = ethers.id('ADMIN_ROLE');
    await round.connect(timelock).grantRole(ADMIN_ROLE, ops.address);

    await setNextTimestamp(end + 10);

    await round.connect(ops).finalizeFailed('Softcap not met');
    await round.connect(ops).pause();

    const bal0 = await payment.balanceOf(alice.address);
    await round.connect(alice).claimRefund();
    const bal1 = await payment.balanceOf(alice.address);
    expect(bal1 - bal0).to.equal(500n);
  });

  it('IT3 Merkle security: cross-round replay rejected', async () => {
    const { timelock, ops, alice, bob, token, payment, factory } = await fixture();
    const net = await ethers.provider.getNetwork();
    const chainId = net.chainId;
    const now = (await ethers.provider.getBlock('latest'))!.timestamp;

    async function makePresale(startOffset: number) {
      const start = now + startOffset;
      const end = start + 3600;

      const params = {
        projectToken: await token.getAddress(),
        paymentToken: await payment.getAddress(),
        softCap: 1000n,
        hardCap: 5000n,
        minContribution: 10n,
        maxContribution: 3000n,
        startTime: start,
        endTime: end,
        projectOwner: ops.address,
      };
      const vest = {
        tgeUnlockBps: 1000n,
        cliffDuration: 0n,
        vestingDuration: 1000n,
        scheduleSalt: ethers.ZeroHash,
      };
      const lp = {
        lockMonths: 12n,
        dexId: ethers.keccak256(ethers.toUtf8Bytes('UNISWAP_V2')),
        liquidityPercent: 7000n,
      };
      const complianceHash = ethers.keccak256(ethers.toUtf8Bytes('compliance'));

      const tx = await factory.connect(ops).createPresale(params, vest, lp, complianceHash);
      const rc = await tx.wait();
      const evt = parseEvent(rc, factory.interface, 'PresaleCreated')!;
      return { vestingAddr: evt.args.vesting as string, salt: evt.args.scheduleSalt as string };
    }

    const A = await makePresale(60);
    const B = await makePresale(120);

    const vestingA = await ethers.getContractAt('MerkleVesting', A.vestingAddr);
    const vestingB = await ethers.getContractAt('MerkleVesting', B.vestingAddr);

    // fund both vaults
    await token.mint(A.vestingAddr, 2_000_000n);
    await token.mint(B.vestingAddr, 2_000_000n);

    const allocAlice = 1_000_000n;
    const allocBob = 500_000n;

    const treeA = buildMerkle(A.vestingAddr, chainId, A.salt, [
      { who: alice.address, total: allocAlice },
      { who: bob.address, total: allocBob },
    ]);
    const treeB = buildMerkle(B.vestingAddr, chainId, B.salt, [
      { who: alice.address, total: allocAlice },
      { who: bob.address, total: allocBob },
    ]);

    const proofFromA = treeA.proof(alice.address, allocAlice);
    expect(proofFromA.length).to.be.greaterThan(0);

    await vestingA.connect(timelock).setMerkleRoot(treeA.root, allocAlice + allocBob);
    await vestingB.connect(timelock).setMerkleRoot(treeB.root, allocAlice + allocBob);

    // replay proof A on vesting B must fail
    await expect(vestingB.connect(alice).claim(allocAlice, proofFromA)).to.be.reverted;
  });
});
