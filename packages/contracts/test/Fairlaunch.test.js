const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Fairlaunch", function () {
  async function deployFairlaunchFixture() {
    const [owner, treasury, feeSplitter, timelock, user1, user2, user3] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const saleToken = await MockERC20.deploy("Sale Token", "SALE", ethers.parseEther("1000000"));
    const paymentToken = await MockERC20.deploy("Payment Token", "USDT", ethers.parseEther("1000000"));

    // Setup fairlaunch parameters
    const tokenForSale = ethers.parseEther("100000");
    const softCap = ethers.parseEther("10");
    const minContribution = ethers.parseEther("0.1");
    const maxContribution = ethers.parseEther("5");
    const startTime = await time.latest() + 3600; // 1 hour from now
    const endTime = startTime + 3600; // 2 hours total
    const listingPremiumBps = 1000; // 10%
    const liquidityPercent = 7000; // 70%
    const lpLockMonths = 12;
    const dexId = ethers.encodeBytes32String("pancakeswap");

    // Deploy Fairlaunch
    const Fairlaunch = await ethers.getContractFactory("Fairlaunch");
    const fairlaunch = await Fairlaunch.deploy(
      await saleToken.getAddress(),      // projectToken
      await paymentToken.getAddress(),   // paymentToken
      softCap,                            // softcap
      tokenForSale,                       // tokensForSale
      minContribution,                    // minContribution
      maxContribution,                    // maxContribution
      startTime,                          // startTime
      endTime,                            // endTime
      listingPremiumBps,                  // listingPremiumBps
      await feeSplitter.getAddress(),    // feeSplitter
      ethers.ZeroAddress,                 // teamVesting (none for basic tests)
      await owner.getAddress(),           // projectOwner
      await timelock.getAddress(),        // adminExecutor
      liquidityPercent,                   // liquidityPercent
      lpLockMonths,                       // lpLockMonths
      dexId                               // dexId
    );

    // Fund users with payment tokens
    await paymentToken.transfer(user1.address, ethers.parseEther("100"));
    await paymentToken.transfer(user2.address, ethers.parseEther("100"));
    await paymentToken.transfer(user3.address, ethers.parseEther("100"));

    // Approve fairlaunch from users
    await paymentToken.connect(user1).approve(await fairlaunch.getAddress(), ethers.MaxUint256);
    await paymentToken.connect(user2).approve(await fairlaunch.getAddress(), ethers.MaxUint256);
    await paymentToken.connect(user3).approve(await fairlaunch.getAddress(), ethers.MaxUint256);

    return {
      fairlaunch,
      saleToken,
      paymentToken,
      owner,
      treasury,
      feeSplitter,
      timelock,
      user1,
      user2,
      user3,
      tokenForSale,
      softCap,
      minContribution,
      maxContribution,
      startTime,
      endTime,
    };
  }

  describe("Deployment", function () {
    it("Should set the correct initial parameters", async function () {
      const { fairlaunch, saleToken, paymentToken, tokenForSale, softCap, minContribution, maxContribution } =
        await loadFixture(deployFairlaunchFixture);

      expect(await fairlaunch.saleToken()).to.equal(await saleToken.getAddress());
      expect(await fairlaunch.paymentToken()).to.equal(await paymentToken.getAddress());
      expect(await fairlaunch.tokenForSale()).to.equal(tokenForSale);
      expect(await fairlaunch.softCap()).to.equal(softCap);
      expect(await fairlaunch.minContribution()).to.equal(minContribution);
      expect(await fairlaunch.maxContribution()).to.equal(maxContribution);
    });

    it("Should start in PENDING status", async function () {
      const { fairlaunch } = await loadFixture(deployFairlaunchFixture);
      
      const status = await fairlaunch.status();
      expect(status).to.equal(0); // PENDING
    });

    it("Should grant roles correctly", async function () {
      const { fairlaunch, timelock, owner } = await loadFixture(deployFairlaunchFixture);

      const ADMIN_ROLE = await fairlaunch.ADMIN_ROLE();
      expect(await fairlaunch.hasRole(ADMIN_ROLE, timelock.address)).to.be.true;
      expect(await fairlaunch.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Funding", function () {
    it("Should allow owner to deposit sale tokens", async function () {
      const { fairlaunch, saleToken, owner, tokenForSale } = await loadFixture(deployFairlaunchFixture);

      await saleToken.approve(await fairlaunch.getAddress(), tokenForSale);
      await expect(fairlaunch.depositTokens())
        .to.emit(fairlaunch, "TransitionedToActive")
        .withArgs(await saleToken.getAddress(), tokenForSale);

      const status = await fairlaunch.status();
      expect(status).to.equal(2); // ACTIVE
    });

    it("Should revert if non-owner tries to deposit", async function () {
      const { fairlaunch, user1 } = await loadFixture(deployFairlaunchFixture);

      await expect(fairlaunch.connect(user1).depositTokens()).to.be.reverted;
    });

    it("Should revert if depositing in wrong status", async function () {
      const { fairlaunch, saleToken, tokenForSale } = await loadFixture(deployFairlaunchFixture);

      // Deposit once
      await saleToken.approve(await fairlaunch.getAddress(), tokenForSale);
      await fairlaunch.depositTokens();

      // Try to deposit again
      await saleToken.approve(await fairlaunch.getAddress(), tokenForSale);
      await expect(fairlaunch.depositTokens()).to.be.revertedWithCustomError(fairlaunch, "InvalidStatus");
    });
  });

  describe("Contributions", function () {
    async function setupActiveFairlaunch() {
      const fixture = await loadFixture(deployFairlaunchFixture);
      const { fairlaunch, saleToken, tokenForSale, startTime } = fixture;

      // Deposit tokens
      await saleToken.approve(await fairlaunch.getAddress(), tokenForSale);
      await fairlaunch.depositTokens();

      // Fast forward to start
      await time.increaseTo(startTime);

      return fixture;
    }

    it("Should allow contributions within limits", async function () {
      const { fairlaunch, user1, minContribution } = await setupActiveFairlaunch();

      await expect(fairlaunch.connect(user1).contribute(user1.address, minContribution))
        .to.emit(fairlaunch, "Contributed")
        .withArgs(user1.address, minContribution, user1.address);

      expect(await fairlaunch.contributions(user1.address)).to.equal(minContribution);
      expect(await fairlaunch.totalRaised()).to.equal(minContribution);
    });

    it("Should reject contributions below minimum", async function () {
      const { fairlaunch, user1, minContribution } = await setupActiveFairlaunch();

      const tooSmall = minContribution / 2n;
      await expect(fairlaunch.connect(user1).contribute(user1.address, tooSmall))
        .to.be.revertedWithCustomError(fairlaunch, "BelowMinContribution");
    });

    it("Should reject contributions above maximum", async function () {
      const { fairlaunch, user1, maxContribution } = await setupActiveFairlaunch();

      const tooLarge = maxContribution * 2n;
      await expect(fairlaunch.connect(user1).contribute(user1.address, tooLarge))
        .to.be.revertedWithCustomError(fairlaunch, "ExceedsMaxContribution");
    });

    it("Should track referrer correctly", async function () {
      const { fairlaunch, user1, user2, minContribution } = await setupActiveFairlaunch();

      await fairlaunch.connect(user1).contribute(user2.address, minContribution);
      
      const referrerAddr = await fairlaunch.referrers(user1.address);
      expect(referrerAddr).to.equal(user2.address);
    });

    it("Should reject contributions before start time", async function () {
      const fixture = await loadFixture(deployFairlaunchFixture);
      const { fairlaunch, saleToken, tokenForSale, user1, minContribution } = fixture;

      await saleToken.approve(await fairlaunch.getAddress(), tokenForSale);
      await fairlaunch.depositTokens();

      await expect(fairlaunch.connect(user1).contribute(user1.address, minContribution))
        .to.be.revertedWithCustomError(fairlaunch, "NotActiveYet");
    });

    it("Should reject contributions after end time", async function () {
      const { fairlaunch, user1, minContribution, endTime } = await setupActiveFairlaunch();

      await time.increaseTo(endTime + 1);

      await expect(fairlaunch.connect(user1).contribute(user1.address, minContribution))
        .to.be.revertedWithCustomError(fairlaunch, "SaleEnded");
    });
  });

  describe("Finalization", function () {
    async function setupSuccessfulSale() {
      const fixture = await setupActiveFairlaunch();
      const { fairlaunch, user1, user2, softCap } = fixture;

      // Contribute enough to reach softcap
      const contribution = softCap / 2n;
      await fairlaunch.connect(user1).contribute(user1.address, contribution);
      await fairlaunch.connect(user2).contribute(user2.address, contribution);

      return fixture;
    }

    async function setupActiveFairlaunch() {
      const fixture = await loadFixture(deployFairlaunchFixture);
      const { fairlaunch, saleToken, tokenForSale, startTime } = fixture;

      await saleToken.approve(await fairlaunch.getAddress(), tokenForSale);
      await fairlaunch.depositTokens();
      await time.increaseTo(startTime);

      return fixture;
    }

    it("Should finalize successful sale", async function () {
      const { fairlaunch, endTime } = await setupSuccessfulSale();

      await time.increaseTo(endTime + 1);

      await expect(fairlaunch.finalizeSuccess())
        .to.emit(fairlaunch, "FinalizedSuccess");

      const status = await fairlaunch.status();
      expect(status).to.equal(4); // SUCCESS
    });

    it("Should calculate tokens per payment correctly", async function () {
      const { fairlaunch, tokenForSale, softCap } = await setupSuccessfulSale();

      const totalRaised = await fairlaunch.totalRaised();
      const expectedPrice = (totalRaised * ethers.parseEther("1")) / tokenForSale;
      
      const actualPrice = await fairlaunch.initialPrice();
      expect(actualPrice).to.equal(expectedPrice);
    });

    it("Should reject finalization before end time", async function () {
      const { fairlaunch } = await setupSuccessfulSale();

      await expect(fairlaunch.finalizeSuccess())
        .to.be.revertedWithCustomError(fairlaunch, "SaleNotEnded");
    });

    it("Should reject finalization if softcap not reached", async function () {
      const { fairlaunch, endTime } = await setupActiveFairlaunch();

      await time.increaseTo(endTime + 1);

      await expect(fairlaunch.finalizeSuccess())
        .to.be.revertedWithCustomError(fairlaunch, "SoftCapNotReached");
    });
  });

  describe("Refunds", function () {
    async function setupFailedSale() {
      const fixture = await loadFixture(deployFairlaunchFixture);
      const { fairlaunch, saleToken, tokenForSale, startTime, user1, minContribution, endTime } = fixture;

      await saleToken.approve(await fairlaunch.getAddress(), tokenForSale);
      await fairlaunch.depositTokens();
      await time.increaseTo(startTime);

      // Contribute but not enough for softcap
      await fairlaunch.connect(user1).contribute(user1.address, minContribution);

      await time.increaseTo(endTime + 1);

      return fixture;
    }

    it("Should allow refund after failed sale", async function () {
      const { fairlaunch, user1, minContribution, paymentToken } = await setupFailedSale();

      const balanceBefore = await paymentToken.balanceOf(user1.address);

      await expect(fairlaunch.connect(user1).refund())
        .to.emit(fairlaunch, "Refunded")
        .withArgs(user1.address, minContribution);

      const balanceAfter = await paymentToken.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.equal(minContribution);
    });

    it("Should prevent double refund", async function () {
      const { fairlaunch, user1 } = await setupFailedSale();

      await fairlaunch.connect(user1).refund();
      
      await expect(fairlaunch.connect(user1).refund())
        .to.be.revertedWithCustomError(fairlaunch, "NoContributionFound");
    });

    it("Should prevent refund if sale was successful", async function () {
      const { fairlaunch, user1, user2, softCap, endTime } = await loadFixture(deployFairlaunchFixture);
      const { saleToken, tokenForSale, startTime } = await loadFixture(deployFairlaunchFixture);

      await saleToken.approve(await fairlaunch.getAddress(), tokenForSale);
      await fairlaunch.depositTokens();
      await time.increaseTo(startTime);

      const contribution = softCap / 2n;
      await fairlaunch.connect(user1).contribute(user1.address, contribution);
      await fairlaunch.connect(user2).contribute(user2.address, contribution);

      await time.increaseTo(endTime + 1);
      await fairlaunch.finalizeSuccess();

      await expect(fairlaunch.connect(user1).refund())
        .to.be.revertedWithCustomError(fairlaunch, "InvalidStatus");
    });
  });

  describe("Claiming", function () {
    async function setupClaimable() {
      const fixture = await loadFixture(deployFairlaunchFixture);
      const { fairlaunch, saleToken, tokenForSale, startTime, user1, user2, softCap, endTime } = fixture;

      await saleToken.approve(await fairlaunch.getAddress(), tokenForSale);
      await fairlaunch.depositTokens();
      await time.increaseTo(startTime);

      const contribution = softCap / 2n;
      await fairlaunch.connect(user1).contribute(user1.address, contribution);
      await fairlaunch.connect(user2).contribute(user2.address, contribution);

      await time.increaseTo(endTime + 1);
      await fairlaunch.finalizeSuccess();

      return fixture;
    }

    it("Should allow users to claim tokens", async function () {
      const { fairlaunch, user1, saleToken } = await setupClaimable();

      const claimable = await fairlaunch.getClaimableTokens(user1.address);
      expect(claimable).to.be.gt(0);

      const balanceBefore = await saleToken.balanceOf(user1.address);

      await expect(fairlaunch.connect(user1).claim())
        .to.emit(fairlaunch, "TokensClaimed");

      const balanceAfter = await saleToken.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.equal(claimable);
    });

    it("Should prevent claiming before finalization", async function () {
      const fixture = await loadFixture(deployFairlaunchFixture);
      const { fairlaunch, saleToken, tokenForSale, startTime, user1, minContribution } = fixture;

      await saleToken.approve(await fairlaunch.getAddress(), tokenForSale);
      await fairlaunch.depositTokens();
      await time.increaseTo(startTime);

      await fairlaunch.connect(user1).contribute(user1.address, minContribution);

      await expect(fairlaunch.connect(user1).claim())
        .to.be.revertedWithCustomError(fairlaunch, "InvalidStatus");
    });

    it("Should prevent double claiming", async function () {
      const { fairlaunch, user1 } = await setupClaimable();

      await fairlaunch.connect(user1).claim();

      await expect(fairlaunch.connect(user1).claim())
        .to.be.revertedWithCustomError(fairlaunch, "AlreadyClaimed");
    });
  });

  describe("Gas Optimization", function () {
    it("Should use reasonable gas for contribution", async function () {
      const fixture = await loadFixture(deployFairlaunchFixture);
      const { fairlaunch, saleToken, tokenForSale, startTime, user1, minContribution } = fixture;

      await saleToken.approve(await fairlaunch.getAddress(), tokenForSale);
      await fairlaunch.depositTokens();
      await time.increaseTo(startTime);

      const tx = await fairlaunch.connect(user1).contribute(user1.address, minContribution);
      const receipt = await tx.wait();

      // Gas should be under 150k for a contribution
      expect(receipt.gasUsed).to.be.lt(150000);
    });
  });
});
