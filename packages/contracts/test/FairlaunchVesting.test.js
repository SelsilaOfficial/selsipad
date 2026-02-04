const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Fairlaunch Team Vesting Integration", function () {
  let factory, fairlaunch, vesting;
  let token, paymentToken;
  let owner, user1, treasury, feeSplitter, timelock;
  let creationFee = ethers.parseEther("0.1");

  before(async function () {
    [owner, user, treasury, feeSplitter, timelock] = await ethers.getSigners();

    // 3. Deploy Mocks and Factory
    const MockToken = await ethers.getContractFactory("ERC20Mock");
    token = await MockToken.deploy("Sale Token", "SALE", 18);
    paymentToken = await MockToken.deploy("Payment Token", "USDT", 18);

    const MockFeeSplitter = await ethers.getContractFactory("MockFeeSplitter");
    feeSplitter = await MockFeeSplitter.deploy();

    const FairlaunchFactory = await ethers.getContractFactory("FairlaunchFactory");
    factory = await FairlaunchFactory.deploy(
      await feeSplitter.getAddress(),
      await treasury.getAddress(),
      await owner.getAddress(), // timelockExecutor
      creationFee
    );
  });

  it("Should create Fairlaunch with Team Vesting", async function () {
    const totalVesting = ethers.parseEther("1000");
    const tokenForSaleParam = ethers.parseEther("100000"); // 100k
    const totalRequired = tokenForSaleParam + totalVesting;

    // Mint tokens to owner
    await token.mint(owner.address, totalRequired);

    // Approve Factory
    await token.approve(await factory.getAddress(), totalRequired);

    // Create Fairlaunch
    const params = {
      saleToken: await token.getAddress(),
      paymentToken: await paymentToken.getAddress(),
      tokenForSale: tokenForSaleParam,
      softCap: ethers.parseEther("1"),
      minContribution: ethers.parseEther("0.1"),
      maxContribution: ethers.parseEther("10"),
      startTime: Math.floor(Date.now() / 1000) + 3600,
      endTime: Math.floor(Date.now() / 1000) + 7200,
      listingPremiumBps: 0,
      projectOwner: await owner.getAddress()
    };

    const lpPlan = {
      lockMonths: 12,
      dexId: ethers.encodeBytes32String("pancakeswap"),
      liquidityPercent: 7000
    };
    
    // Vesting Schedule (1 month cliff)
    const schedule = [
        { duration: 30*24*3600, amount: totalVesting }, 
    ];
    
    const vestingParams = {
        durations: schedule.map(s => s.duration),
        amounts: schedule.map(s => s.amount)
    };

    const complianceHash = ethers.ZeroHash;

    await expect(factory.createFairlaunch(params, lpPlan, vestingParams, complianceHash, { value: creationFee }))
      .to.emit(factory, "FairlaunchCreated");

    // Verify Mappings
    const fairlaunchAddr = await factory.fairlaunches(0);
    expect(fairlaunchAddr).to.not.equal(ethers.ZeroAddress);

    const vestingAddr = await factory.fairlaunchToVesting(fairlaunchAddr);
    expect(vestingAddr).to.not.equal(ethers.ZeroAddress);

    // Verify Balances
    const vestingBalance = await token.balanceOf(vestingAddr);
    expect(vestingBalance).to.equal(totalVesting);

    const fairlaunchBalance = await token.balanceOf(fairlaunchAddr);
    expect(fairlaunchBalance).to.equal(tokenForSaleParam);
    
    // Check Status of Fairlaunch (should be UPCOMING/PENDING)
    // We can't easily check status enum without ABI but we can check if tokens deposited
    // Fairlaunch emits 'TokensDeposited'? We can check that event in the tx receipt if we captured it.
  });
});
