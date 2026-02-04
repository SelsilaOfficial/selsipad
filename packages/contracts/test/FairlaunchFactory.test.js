const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("FairlaunchFactory", function () {
  let factory;
  let feeSplitter, token, paymentToken;
  let owner, treasury, admin, user;
  const deploymentFee = ethers.parseEther("0.1");

  beforeEach(async function () {
    [owner, treasury, admin, user] = await ethers.getSigners();

    // Deploy mock contracts
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("Sale Token", "SALE", ethers.parseEther("1000000"));
    paymentToken = await MockERC20.deploy("Payment", "USDT", ethers.parseEther("1000000"));

    const MockFeeSplitter = await ethers.getContractFactory("contracts/mocks/MockFeeSplitter.sol:MockFeeSplitter");
    feeSplitter = await MockFeeSplitter.deploy();

    // Deploy factory with correct 4 parameters
    const FairlaunchFactory = await ethers.getContractFactory("FairlaunchFactory");
    factory = await FairlaunchFactory.deploy(
      deploymentFee,                    // _deploymentFee
      await feeSplitter.getAddress(),   // _feeSplitter
      treasury.address,                 // _treasuryWallet
      admin.address                     // _adminExecutor
    );
  });

  describe("Deployment", function () {
    it("Should set correct initial parameters", async function () {
      expect(await factory.DEPLOYMENT_FEE()).to.equal(deploymentFee);
      expect(await factory.feeSplitter()).to.equal(await feeSplitter.getAddress());
      expect(await factory.treasuryWallet()).to.equal(treasury.address);
      expect(await factory.adminExecutor()).to.equal(admin.address);
      expect(await factory.fairlaunchCount()).to.equal(0);
    });

    it("Should grant admin roles to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await factory.DEFAULT_ADMIN_ROLE();
      const FACTORY_ADMIN_ROLE = await factory.FACTORY_ADMIN_ROLE();

      expect(await factory.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await factory.hasRole(FACTORY_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should revert with zero addresses", async function () {
      const FairlaunchFactory = await ethers.getContractFactory("FairlaunchFactory");

      await expect(
        FairlaunchFactory.deploy(deploymentFee, ethers.ZeroAddress, treasury.address, admin.address)
      ).to.be.revertedWithCustomError(FairlaunchFactory, "ZeroAddress");

      await expect(
        FairlaunchFactory.deploy(deploymentFee, await feeSplitter.getAddress(), ethers.ZeroAddress, admin.address)
      ).to.be.revertedWithCustomError(FairlaunchFactory, "ZeroAddress");

      await expect(
        FairlaunchFactory.deploy(deploymentFee, await feeSplitter.getAddress(), treasury.address, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(FairlaunchFactory, "ZeroAddress");
    });
  });

  describe("Fairlaunch Creation", function () {
    const getValidParams = async () => ({
      projectToken: await token.getAddress(),
      paymentToken: await paymentToken.getAddress(),
      softcap: ethers.parseEther("10"),
      tokensForSale: ethers.parseEther("100000"),
      minContribution: ethers.parseEther("0.1"),
      maxContribution: ethers.parseEther("5"),
      startTime: (await time.latest()) + 60,
      endTime: (await time.latest()) + 120,
      projectOwner: user.address,
      listingPremiumBps: 1000,
    });

    const getValidVestingParams = () => ({
      beneficiary: user.address,
      startTime: 0,
      durations: [],
      amounts: [],
    });

    const getValidLPPlan = () => ({
      lockMonths: 12,
      liquidityPercent: 7000,
      dexId: ethers.encodeBytes32String("pancakeswap"),
    });

    it("Should create fairlaunch without vesting", async function () {
      const params = await getValidParams();
      const vestingParams = getValidVestingParams();
      const lpPlan = getValidLPPlan();

      await expect(
        factory.createFairlaunch(params, vestingParams, lpPlan, { value: deploymentFee })
      ).to.emit(factory, "FairlaunchCreated");

      expect(await factory.fairlaunchCount()).to.equal(1);
      const fairlaunchAddr = await factory.fairlaunches(0);
      expect(fairlaunchAddr).to.not.equal(ethers.ZeroAddress);
    });

    it("Should create fairlaunch with vesting", async function () {
      const params = await getValidParams();
      const vestingParams = {
        beneficiary: user.address,
        startTime: (await time.latest()) + 200,
        durations: [30 * 24 * 3600, 30 * 24 * 3600], // 2 months
        amounts: [ethers.parseEther("5000"), ethers.parseEther("5000")],
      };
      const lpPlan = getValidLPPlan();

      const tx = await factory.createFairlaunch(params, vestingParams, lpPlan, { value: deploymentFee });
      const receipt = await tx.wait();

      expect(await factory.fairlaunchCount()).to.equal(1);
      const fairlaunchAddr = await factory.fairlaunches(0);
      const vestingAddr = await factory.fairlaunchToVesting(fairlaunchAddr);
      
      expect(vestingAddr).to.not.equal(ethers.ZeroAddress);
    });

    it("Should record LP lock plan", async function () {
      const params = await getValidParams();
      const vestingParams = getValidVestingParams();
      const lpPlan = {
        lockMonths: 18,
        liquidityPercent: 8000,
        dexId: ethers.encodeBytes32String("uniswap"),
      };

      await factory.createFairlaunch(params, vestingParams, lpPlan, { value: deploymentFee });

      const fairlaunchAddr = await factory.fairlaunches(0);
      const recordedPlan = await factory.fairlaunchToLPPlan(fairlaunchAddr);

      expect(recordedPlan.lockMonths).to.equal(18);
      expect(recordedPlan.liquidityPercent).to.equal(8000);
      expect(recordedPlan.dexId).to.equal(lpPlan.dexId);
    });

    it("Should transfer deployment fee to treasury", async function () {
      const params = await getValidParams();
      const vestingParams = getValidVestingParams();
      const lpPlan = getValidLPPlan();

      const balanceBefore = await ethers.provider.getBalance(treasury.address);

      await factory.createFairlaunch(params, vestingParams, lpPlan, { value: deploymentFee });

      const balanceAfter = await ethers.provider.getBalance(treasury.address);
      expect(balanceAfter).to.equal(balanceBefore + deploymentFee);
    });

    it("Should revert with insufficient deployment fee", async function () {
      const params = await getValidParams();
      const vestingParams = getValidVestingParams();
      const lpPlan = getValidLPPlan();

      const insufficientFee = deploymentFee / 2n;

      await expect(
        factory.createFairlaunch(params, vestingParams, lpPlan, { value: insufficientFee })
      ).to.be.revertedWithCustomError(factory, "InsufficientDeploymentFee");
    });
  });

  describe("Parameter Validation", function () {
    const getValidParams = async () => ({
      projectToken: await token.getAddress(),
      paymentToken: await paymentToken.getAddress(),
      softcap: ethers.parseEther("10"),
      tokensForSale: ethers.parseEther("100000"),
      minContribution: ethers.parseEther("0.1"),
      maxContribution: ethers.parseEther("5"),
      startTime: (await time.latest()) + 60,
      endTime: (await time.latest()) + 120,
      projectOwner: user.address,
      listingPremiumBps: 1000,
    });

    const getValidVestingParams = () => ({
      beneficiary: user.address,
      startTime: 0,
      durations: [],
      amounts: [],
    });

    const getValidLPPlan = () => ({
      lockMonths: 12,
      liquidityPercent: 7000,
      dexId: ethers.encodeBytes32String("pancakeswap"),
    });

    it("Should reject zero softcap", async function () {
      const params = await getValidParams();
      params.softcap = 0;
      const vestingParams = getValidVestingParams();
      const lpPlan = getValidLPPlan();

      await expect(
        factory.createFairlaunch(params, vestingParams, lpPlan, { value: deploymentFee })
      ).to.be.revertedWithCustomError(factory, "InvalidSoftcap");
    });

    it("Should reject start time >= end time", async function () {
      const params = await getValidParams();
      params.endTime = params.startTime;
      const vestingParams = getValidVestingParams();
      const lpPlan = getValidLPPlan();

      await expect(
        factory.createFairlaunch(params, vestingParams, lpPlan, { value: deploymentFee })
      ).to.be.revertedWithCustomError(factory, "InvalidTimeRange");
    });

    it("Should reject min contribution > max contribution", async function () {
      const params = await getValidParams();
      params.minContribution = ethers.parseEther("10");
      params.maxContribution = ethers.parseEther("5");
      const vestingParams = getValidVestingParams();
      const lpPlan = getValidLPPlan();

      await expect(
        factory.createFairlaunch(params, vestingParams, lpPlan, { value: deploymentFee })
      ).to.be.revertedWithCustomError(factory, "InvalidContributionRange");
    });

    it("Should reject LP lock < 12 months", async function () {
      const params = await getValidParams();
      const vestingParams = getValidVestingParams();
      const lpPlan = getValidLPPlan();
      lpPlan.lockMonths = 11;

      await expect(
        factory.createFairlaunch(params, vestingParams, lpPlan, { value: deploymentFee })
      ).to.be.revertedWithCustomError(factory, "InsufficientLPLockDuration");
    });

    it("Should reject liquidity percent < 70%", async function () {
      const params = await getValidParams();
      const vestingParams = getValidVestingParams();
      const lpPlan = getValidLPPlan();
      lpPlan.liquidityPercent = 6900;

      await expect(
        factory.createFairlaunch(params, vestingParams, lpPlan, { value: deploymentFee })
      ).to.be.revertedWithCustomError(factory, "InsufficientLiquidityPercent");
    });

    it("Should reject zero project token address", async function () {
      const params = await getValidParams();
      params.projectToken = ethers.ZeroAddress;
      const vestingParams = getValidVestingParams();
      const lpPlan = getValidLPPlan();

      await expect(
        factory.createFairlaunch(params, vestingParams, lpPlan, { value: deploymentFee })
      ).to.be.revertedWithCustomError(factory, "ZeroAddress");
    });

    it("Should reject zero project owner address", async function () {
      const params = await getValidParams();
      params.projectOwner = ethers.ZeroAddress;
      const vestingParams = getValidVestingParams();
      const lpPlan = getValidLPPlan();

      await expect(
        factory.createFairlaunch(params, vestingParams, lpPlan, { value: deploymentFee })
      ).to.be.revertedWithCustomError(factory, "ZeroAddress");
    });
  });

  describe("View Functions", function () {
    it("Should return correct fairlaunch count", async function () {
      expect(await factory.fairlaunchCount()).to.equal(0);

      const params = await (async () => ({
        projectToken: await token.getAddress(),
        paymentToken: await paymentToken.getAddress(),
        softcap: ethers.parseEther("10"),
        tokensForSale: ethers.parseEther("100000"),
        minContribution: ethers.parseEther("0.1"),
        maxContribution: ethers.parseEther("5"),
        startTime: (await time.latest()) + 60,
        endTime: (await time.latest()) + 120,
        projectOwner: user.address,
        listingPremiumBps: 1000,
      }))();

      const vestingParams = {
        beneficiary: user.address,
        startTime: 0,
        durations: [],
        amounts: [],
      };

      const lpPlan = {
        lockMonths: 12,
        liquidityPercent: 7000,
        dexId: ethers.encodeBytes32String("pancakeswap"),
      };

      await factory.createFairlaunch(params, vestingParams, lpPlan, { value: deploymentFee });
      expect(await factory.fairlaunchCount()).to.equal(1);

      await factory.createFairlaunch(params, vestingParams, lpPlan, { value: deploymentFee });
      expect(await factory.fairlaunchCount()).to.equal(2);
    });
  });

  describe("Gas Optimization", function () {
    it("Factory deployment should use reasonable gas", async function () {
      const FairlaunchFactory = await ethers.getContractFactory("FairlaunchFactory");
      const tx = await FairlaunchFactory.deploy(
        deploymentFee,
        await feeSplitter.getAddress(),
        treasury.address,
        admin.address
      );
      const receipt = await tx.deploymentTransaction().wait();

      // Factory deployment includes Fairlaunch + TeamVesting bytecode - should be under 5M gas
      expect(receipt.gasUsed).to.be.lt(5000000);
    });
  });
});
