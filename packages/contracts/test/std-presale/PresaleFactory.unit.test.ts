import { expect } from 'chai';
import { ethers } from 'hardhat';

function parseEvent(rc: any, iface: any, name: string) {
  for (const log of rc.logs) {
    try {
      const p = iface.parseLog(log);
      if (p && p.name === name) return p;
    } catch {}
  }
  return null;
}

describe('PresaleFactory (unit)', function () {
  async function fixture() {
    const [admin, timelock, ops, alice, treasury, referral, sbt] = await ethers.getSigners();

    const FeeSplitter = await ethers.getContractFactory('FeeSplitter');
    const feeSplitter = await FeeSplitter.deploy(
      treasury.address,
      referral.address,
      sbt.address,
      admin.address // Admin for FeeSplitter
    );
    await feeSplitter.waitForDeployment();

    const Factory = await ethers.getContractFactory('PresaleFactory');
    // sesuaikan constructor argumen kalau ada parameter admin
    const factory = await Factory.deploy(await feeSplitter.getAddress(), timelock.address);
    await factory.waitForDeployment();

    // Grant admin role to factory on FeeSplitter so it can grant PRESALE_ROLE
    await feeSplitter.grantRole(await feeSplitter.DEFAULT_ADMIN_ROLE(), await factory.getAddress());

    const FACTORY_ADMIN_ROLE = await factory.FACTORY_ADMIN_ROLE();
    await factory.grantRole(FACTORY_ADMIN_ROLE, ops.address);

    const ERC20Mock = await ethers.getContractFactory('ERC20Mock');
    const payment = await ERC20Mock.deploy('USDC', 'USDC', 6);
    await payment.waitForDeployment();

    const token = await ERC20Mock.deploy('PRJ', 'PRJ', 18);
    await token.waitForDeployment();

    return { admin, timelock, ops, alice, feeSplitter, factory, payment, token };
  }

  function mkParams(
    token: string,
    payment: string,
    start: number,
    end: number,
    projectOwner: string
  ) {
    return {
      projectToken: token,
      paymentToken: payment,
      softCap: 1000n,
      hardCap: 2000n,
      minContribution: 10n,
      maxContribution: 100n,
      startTime: start,
      endTime: end,
      projectOwner,
    };
  }

  it('only FACTORY_ADMIN_ROLE can createPresale()', async () => {
    const { factory, alice, payment, token } = await fixture();
    const now = (await ethers.provider.getBlock('latest'))!.timestamp;

    const params = mkParams(
      await token.getAddress(),
      await payment.getAddress(),
      now + 60,
      now + 3600,
      alice.address
    );
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

    await expect(factory.connect(alice).createPresale(params, vest, lp, complianceHash)).to.be
      .reverted;
  });

  it('validates LP lock months >= 12', async () => {
    const { factory, ops, payment, token } = await fixture();
    const now = (await ethers.provider.getBlock('latest'))!.timestamp;

    const params = mkParams(
      await token.getAddress(),
      await payment.getAddress(),
      now + 60,
      now + 3600,
      ops.address
    );
    const vest = {
      tgeUnlockBps: 1000n,
      cliffDuration: 0n,
      vestingDuration: 1000n,
      scheduleSalt: ethers.ZeroHash,
    };
    const lpBad = {
      lockMonths: 11n,
      dexId: ethers.keccak256(ethers.toUtf8Bytes('UNISWAP_V2')),
      liquidityPercent: 7000n,
    };
    const complianceHash = ethers.keccak256(ethers.toUtf8Bytes('compliance'));

    await expect(factory.connect(ops).createPresale(params, vest, lpBad, complianceHash)).to.be
      .reverted;
  });

  it('records presale + getPresaleDetails/getVestingForRound work', async () => {
    const { factory, ops, payment, token } = await fixture();
    const now = (await ethers.provider.getBlock('latest'))!.timestamp;

    const params = mkParams(
      await token.getAddress(),
      await payment.getAddress(),
      now + 60,
      now + 3600,
      ops.address
    );
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

    const evt = parseEvent(rc, factory.interface, 'PresaleCreated');
    expect(evt).to.not.equal(null);

    const presaleId = evt!.args.presaleId as bigint;
    const round = evt!.args.round as string;
    const vesting = evt!.args.vesting as string;
    const salt = evt!.args.scheduleSalt as string;

    expect(round).to.properAddress;
    expect(vesting).to.properAddress;
    expect(salt).to.not.equal(ethers.ZeroHash);

    const v2 = await factory.getVestingForRound(round);
    expect(v2).to.equal(vesting);

    const details = await factory.getPresaleDetails(presaleId);
    // NOTE: sesuaikan field akses sesuai return struct/tuple kamu
    // Minimal assert round & vesting match:
    expect(details.round).to.equal(round);
    expect(details.vesting).to.equal(vesting);
  });

  it('auto-generates unique scheduleSalt per presale when scheduleSalt=0x0', async () => {
    const { factory, ops, payment, token } = await fixture();
    const now = (await ethers.provider.getBlock('latest'))!.timestamp;

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

    const tx1 = await factory
      .connect(ops)
      .createPresale(
        mkParams(
          await token.getAddress(),
          await payment.getAddress(),
          now + 60,
          now + 3600,
          ops.address
        ),
        vest,
        lp,
        complianceHash
      );
    const rc1 = await tx1.wait();
    const s1 = parseEvent(rc1, factory.interface, 'PresaleCreated')!.args.scheduleSalt as string;

    const tx2 = await factory
      .connect(ops)
      .createPresale(
        mkParams(
          await token.getAddress(),
          await payment.getAddress(),
          now + 120,
          now + 7200,
          ops.address
        ),
        vest,
        lp,
        complianceHash
      );
    const rc2 = await tx2.wait();
    const s2 = parseEvent(rc2, factory.interface, 'PresaleCreated')!.args.scheduleSalt as string;

    expect(s1).to.not.equal(s2);
  });
});
