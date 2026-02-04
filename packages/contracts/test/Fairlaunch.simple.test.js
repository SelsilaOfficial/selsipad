const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Fairlaunch - Basic Tests", function () {
  let fairlaunch, token, paymentToken;
  let owner, user1, user2;
  let feeSplitter;

  beforeEach(async function () {
    [owner, user1, user2, feeSplitter] = await ethers.getSigners();

    // Deploy tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("Sale", "SALE", ethers.parseEther("1000000"));
    paymentToken = await MockERC20.deploy("USDT", "USDT", ethers.parseEther("1000000"));

    // Fairlaunch params
    const startTime = (await time.latest()) + 3600;
    const endTime = startTime + 3600;

    // Deploy Fairlaunch
    const Fairlaunch = await ethers.getContractFactory("Fairlaunch");
    fairlaunch = await Fairlaunch.deploy(
      await token.getAddress(),          // projectToken
      await paymentToken.getAddress(),   // paymentToken
      ethers.parseEther("10"),           // softcap
      ethers.parseEther("100000"),       // tokensForSale
      ethers.parseEther("0.1"),          // minContribution
      ethers.parseEther("5"),            // maxContribution
      startTime,
      endTime,
      1000,                              // listingPremiumBps
      await feeSplitter.getAddress(),    // feeSplitter
      ethers.ZeroAddress,                // teamVesting
      owner.address,                     // projectOwner
      owner.address,                     // adminExecutor
      7000,                              // liquidityPercent
      12,                                // lpLockMonths
      ethers.encodeBytes32String("pancakeswap")  // dexId
    );

    // Fund users
    await paymentToken.transfer(user1.address, ethers.parseEther("100"));
    await paymentToken.transfer(user2.address, ethers.parseEther("100"));
    await paymentToken.connect(user1).approve(await fairlaunch.getAddress(), ethers.MaxUint256);
    await paymentToken.connect(user2).approve(await fairlaunch.getAddress(), ethers.MaxUint256);
  });

  it("Should deploy with correct parameters", async function () {
    expect(await fairlaunch.projectToken()).to.equal(await token.getAddress());
    expect(await fairlaunch.paymentToken()).to.equal(await paymentToken.getAddress());
    expect(await fairlaunch.softcap()).to.equal(ethers.parseEther("10"));
  });

  it("Should start in UPCOMING status", async function () {
    const status = await fairlaunch.getStatus();
    expect(status).to.equal(0); // UPCOMING
  });

  it("Should allow contributions during live period", async function () {
    // Fast forward to start
    const startTime = await fairlaunch.startTime();
    await time.increaseTo(startTime);

    const contribution = ethers.parseEther("1");
    await expect(fairlaunch.connect(user1).contributeERC20(contribution))
      .to.emit(fairlaunch, "Contributed")
      .withArgs(user1.address, contribution, contribution);

    expect(await fairlaunch.contributions(user1.address)).to.equal(contribution);
  });

  it("Should reject contributions below minimum", async function () {
    const startTime = await fairlaunch.startTime();
    await time.increaseTo(startTime);

    const tooSmall = ethers.parseEther("0.01");
    await expect(fairlaunch.connect(user1).contributeERC20(tooSmall))
      .to.be.revertedWithCustomError(fairlaunch, "ContributionTooLow");
  });

  it("Should reject contributions above maximum", async function () {
    const startTime = await fairlaunch.startTime();
    await time.increaseTo(startTime);

    const tooLarge = ethers.parseEther("10");
    await expect(fairlaunch.connect(user1).contributeERC20(tooLarge))
      .to.be.revertedWithCustomError(fairlaunch, "ContributionTooHigh");
  });

  it("Should allow refund on failed sale", async function () {
    const startTime = await fairlaunch.startTime();
    const endTime = await fairlaunch.endTime();
    
    await time.increaseTo(startTime);
    
    // Contribute less than softcap
    const contribution = ethers.parseEther("1");
    await fairlaunch.connect(user1).contributeERC20(contribution);

    // Wait for end
    await time.increaseTo(Number(endTime) + 1);

    // Finalize (will fail due to softcap not met)
    await fairlaunch.finalize();

    // Refund
    const balanceBefore = await paymentToken.balanceOf(user1.address);
    await fairlaunch.connect(user1).refund();
    const balanceAfter = await paymentToken.balanceOf(user1.address);

    expect(balanceAfter).to.equal(balanceBefore + contribution);
  });
});
