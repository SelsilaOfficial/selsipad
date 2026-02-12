const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

/**
 * Helper: Assert a transaction reverts
 */
async function expectRevert(promise) {
  try {
    await promise;
    expect.fail('Expected transaction to revert');
  } catch (err) {
    // If it's our own expect.fail, re-throw
    if (err.message === 'Expected transaction to revert') throw err;
    // Otherwise it reverted as expected — pass
  }
}

describe('LPLocker (Unified)', function () {
  let locker;
  let mockLP;
  let deployer, beneficiary, other;

  const ONE_YEAR = 365 * 24 * 60 * 60;
  const AMOUNT = ethers.parseEther('100');

  beforeEach(async function () {
    [deployer, beneficiary, other] = await ethers.getSigners();

    // Deploy mock LP token (name, symbol, decimals)
    const MockERC20 = await ethers.getContractFactory(
      'contracts/std-presale/mocks/ERC20Mock.sol:ERC20Mock'
    );
    mockLP = await MockERC20.deploy('LP Token', 'LP', 18);
    await mockLP.waitForDeployment();

    // Mint tokens to deployer
    await mockLP.mint(deployer.address, ethers.parseEther('1000000'));

    // Deploy LPLocker
    const LPLocker = await ethers.getContractFactory('contracts/shared/LPLocker.sol:LPLocker');
    locker = await LPLocker.deploy();
    await locker.waitForDeployment();

    // Approve locker to spend LP tokens
    await mockLP.approve(await locker.getAddress(), ethers.MaxUint256);
  });

  // ═══════════════════════════════════════════
  //              LOCK TOKENS
  // ═══════════════════════════════════════════

  describe('lockTokens', function () {
    it('should lock LP tokens successfully', async function () {
      const unlockTime = (await time.latest()) + ONE_YEAR;

      await locker.lockTokens(await mockLP.getAddress(), AMOUNT, unlockTime, beneficiary.address);

      const lock = await locker.getLock(0);
      expect(lock.lpToken).to.equal(await mockLP.getAddress());
      expect(lock.owner).to.equal(deployer.address);
      expect(lock.beneficiary).to.equal(beneficiary.address);
      expect(lock.amount).to.equal(AMOUNT);
      expect(lock.unlockTime).to.equal(BigInt(unlockTime));
      expect(lock.withdrawn).to.be.false;
    });

    it('should increment lock count', async function () {
      const unlockTime = (await time.latest()) + ONE_YEAR;
      expect(await locker.totalLockCount()).to.equal(0n);

      await locker.lockTokens(await mockLP.getAddress(), AMOUNT, unlockTime, beneficiary.address);
      expect(await locker.totalLockCount()).to.equal(1n);

      await locker.lockTokens(await mockLP.getAddress(), AMOUNT, unlockTime, beneficiary.address);
      expect(await locker.totalLockCount()).to.equal(2n);
    });

    it('should transfer LP tokens to locker', async function () {
      const unlockTime = (await time.latest()) + ONE_YEAR;
      const lockerAddr = await locker.getAddress();

      const balBefore = await mockLP.balanceOf(lockerAddr);
      await locker.lockTokens(await mockLP.getAddress(), AMOUNT, unlockTime, beneficiary.address);
      const balAfter = await mockLP.balanceOf(lockerAddr);

      expect(balAfter - balBefore).to.equal(AMOUNT);
    });

    it('should revert with zero amount', async function () {
      const unlockTime = (await time.latest()) + ONE_YEAR;
      await expectRevert(
        locker.lockTokens(await mockLP.getAddress(), 0, unlockTime, beneficiary.address)
      );
    });

    it('should revert with past unlock time', async function () {
      const pastTime = (await time.latest()) - 100;
      await expectRevert(
        locker.lockTokens(await mockLP.getAddress(), AMOUNT, pastTime, beneficiary.address)
      );
    });

    it('should revert with zero beneficiary', async function () {
      const unlockTime = (await time.latest()) + ONE_YEAR;
      await expectRevert(
        locker.lockTokens(await mockLP.getAddress(), AMOUNT, unlockTime, ethers.ZeroAddress)
      );
    });

    it('should index by beneficiary', async function () {
      const unlockTime = (await time.latest()) + ONE_YEAR;

      await locker.lockTokens(await mockLP.getAddress(), AMOUNT, unlockTime, beneficiary.address);
      await locker.lockTokens(await mockLP.getAddress(), AMOUNT, unlockTime, beneficiary.address);
      await locker.lockTokens(await mockLP.getAddress(), AMOUNT, unlockTime, other.address);

      const benefLocks = await locker.getLocksByBeneficiary(beneficiary.address);
      expect(benefLocks.length).to.equal(2);
      expect(benefLocks[0]).to.equal(0n);
      expect(benefLocks[1]).to.equal(1n);

      const otherLocks = await locker.getLocksByBeneficiary(other.address);
      expect(otherLocks.length).to.equal(1);
      expect(otherLocks[0]).to.equal(2n);
    });

    it('should index by token', async function () {
      const unlockTime = (await time.latest()) + ONE_YEAR;
      await locker.lockTokens(await mockLP.getAddress(), AMOUNT, unlockTime, beneficiary.address);

      const tokenLocks = await locker.getLocksByToken(await mockLP.getAddress());
      expect(tokenLocks.length).to.equal(1);
    });
  });

  // ═══════════════════════════════════════════
  //              WITHDRAW
  // ═══════════════════════════════════════════

  describe('withdrawTokens', function () {
    let unlockTime;

    beforeEach(async function () {
      unlockTime = (await time.latest()) + ONE_YEAR;
      await locker.lockTokens(await mockLP.getAddress(), AMOUNT, unlockTime, beneficiary.address);
    });

    it('should allow beneficiary to withdraw after unlock', async function () {
      await time.increaseTo(unlockTime + 1);

      const balBefore = await mockLP.balanceOf(beneficiary.address);
      await locker.connect(beneficiary).withdrawTokens(0);
      const balAfter = await mockLP.balanceOf(beneficiary.address);

      expect(balAfter - balBefore).to.equal(AMOUNT);

      const lock = await locker.getLock(0);
      expect(lock.withdrawn).to.be.true;
    });

    it('should revert if still locked', async function () {
      await expectRevert(locker.connect(beneficiary).withdrawTokens(0));
    });

    it('should revert if not beneficiary', async function () {
      await time.increaseTo(unlockTime + 1);
      await expectRevert(locker.connect(other).withdrawTokens(0));
    });

    it('should revert if already withdrawn', async function () {
      await time.increaseTo(unlockTime + 1);
      await locker.connect(beneficiary).withdrawTokens(0);
      await expectRevert(locker.connect(beneficiary).withdrawTokens(0));
    });
  });

  // ═══════════════════════════════════════════
  //              EXTEND LOCK
  // ═══════════════════════════════════════════

  describe('extendLock', function () {
    let unlockTime;

    beforeEach(async function () {
      unlockTime = (await time.latest()) + ONE_YEAR;
      await locker.lockTokens(await mockLP.getAddress(), AMOUNT, unlockTime, beneficiary.address);
    });

    it('should extend lock duration', async function () {
      const newUnlock = unlockTime + ONE_YEAR;
      await locker.connect(beneficiary).extendLock(0, newUnlock);

      const lock = await locker.getLock(0);
      expect(lock.unlockTime).to.equal(BigInt(newUnlock));
    });

    it('should revert if not beneficiary', async function () {
      const newUnlock = unlockTime + ONE_YEAR;
      await expectRevert(locker.connect(other).extendLock(0, newUnlock));
    });

    it('should revert if new time is not later', async function () {
      await expectRevert(locker.connect(beneficiary).extendLock(0, unlockTime - 100));
    });

    it('should revert if already withdrawn', async function () {
      await time.increaseTo(unlockTime + 1);
      await locker.connect(beneficiary).withdrawTokens(0);
      await expectRevert(locker.connect(beneficiary).extendLock(0, unlockTime + ONE_YEAR));
    });
  });

  // ═══════════════════════════════════════════
  //              TRANSFER BENEFICIARY
  // ═══════════════════════════════════════════

  describe('transferBeneficiary', function () {
    beforeEach(async function () {
      const unlockTime = (await time.latest()) + ONE_YEAR;
      await locker.lockTokens(await mockLP.getAddress(), AMOUNT, unlockTime, beneficiary.address);
    });

    it('should allow owner to transfer beneficiary', async function () {
      await locker.connect(deployer).transferBeneficiary(0, other.address);

      const lock = await locker.getLock(0);
      expect(lock.beneficiary).to.equal(other.address);
    });

    it('should revert if not owner', async function () {
      await expectRevert(locker.connect(beneficiary).transferBeneficiary(0, other.address));
    });
  });

  // ═══════════════════════════════════════════
  //              VIEW FUNCTIONS
  // ═══════════════════════════════════════════

  describe('View Functions', function () {
    let unlockTime;

    beforeEach(async function () {
      unlockTime = (await time.latest()) + ONE_YEAR;
      await locker.lockTokens(await mockLP.getAddress(), AMOUNT, unlockTime, beneficiary.address);
    });

    it('isLocked returns true when still locked', async function () {
      expect(await locker.isLocked(0)).to.be.true;
    });

    it('isLocked returns false after unlock time', async function () {
      await time.increaseTo(unlockTime + 1);
      expect(await locker.isLocked(0)).to.be.false;
    });

    it('isLocked returns false after withdrawal', async function () {
      await time.increaseTo(unlockTime + 1);
      await locker.connect(beneficiary).withdrawTokens(0);
      expect(await locker.isLocked(0)).to.be.false;
    });

    it('getTimeUntilUnlock returns value > 0 when locked', async function () {
      const remaining = await locker.getTimeUntilUnlock(0);
      expect(remaining > 0n).to.be.true;
    });

    it('getTimeUntilUnlock returns 0 after expiry', async function () {
      await time.increaseTo(unlockTime + 1);
      expect(await locker.getTimeUntilUnlock(0)).to.equal(0n);
    });

    it('getLocksMulti returns batch data', async function () {
      await locker.lockTokens(await mockLP.getAddress(), AMOUNT, unlockTime, other.address);

      const locks = await locker.getLocksMulti([0, 1]);
      expect(locks.length).to.equal(2);
      expect(locks[0].beneficiary).to.equal(beneficiary.address);
      expect(locks[1].beneficiary).to.equal(other.address);
    });
  });
});
