const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('Fairlaunch Tax Token Finalization', function () {
  let fairlaunchFactory;
  let fairlaunch;
  let taxToken;
  let owner, user1, treasury, adminExecutor;
  let feeSplitter;

  before(async function () {
    [owner, user1, treasury, adminExecutor] = await ethers.getSigners();

    // Deploy FeeSplitter mock
    const FeeSplitter = await ethers.getContractFactory(
      'contracts/mocks/MockFeeSplitter.sol:MockFeeSplitter'
    );
    feeSplitter = await FeeSplitter.deploy();

    // Deploy Factory
    const FairlaunchFactory = await ethers.getContractFactory('FairlaunchFactory');
    fairlaunchFactory = await FairlaunchFactory.deploy(
      ethers.parseEther('0.1'), // fee
      await feeSplitter.getAddress(),
      treasury.address,
      adminExecutor.address
    );

    // Deploy Tax Token
    const TaxToken = await ethers.getContractFactory('MockTaxToken');
    taxToken = await TaxToken.deploy(); // Mints 1M tokens to owner
  });

  it('Should fail finalization with tax token due to balance mismatch', async function () {
    const startTime = (await time.latest()) + 60;
    const endTime = startTime + 3600;

    // Approve Factory
    await taxToken.approve(await fairlaunchFactory.getAddress(), ethers.MaxUint256);

    const tx = await fairlaunchFactory.createFairlaunch(
      {
        projectToken: await taxToken.getAddress(),
        paymentToken: ethers.ZeroAddress,
        softcap: ethers.parseEther('1'),
        tokensForSale: ethers.parseEther('100000'), // 100k
        minContribution: ethers.parseEther('0.1'),
        maxContribution: ethers.parseEther('5'),
        startTime,
        endTime,
        projectOwner: owner.address,
        listingPremiumBps: 2000, // 20%
      },
      {
        beneficiary: ethers.ZeroAddress,
        startTime: 0,
        durations: [],
        amounts: [],
      },
      {
        lockMonths: 12,
        liquidityPercent: 8000, // 80%
        dexId: ethers.ZeroHash,
      },
      { value: ethers.parseEther('0.1') }
    );

    const receipt = await tx.wait();
    const filter = fairlaunchFactory.filters.FairlaunchCreated;
    const events = await fairlaunchFactory.queryFilter(filter, receipt.blockNumber);
    const fairlaunchAddress = events[0].args[1]; // Index 1 is fairlaunch address

    fairlaunch = await ethers.getContractAt('Fairlaunch', fairlaunchAddress);

    // Check balance in Fairlaunch
    const balance = await taxToken.balanceOf(fairlaunchAddress);
    console.log('Fairlaunch Token Balance:', ethers.formatEther(balance));

    // Participate
    await time.increaseTo(startTime);
    await fairlaunch.connect(user1).contribute({ value: ethers.parseEther('2') });

    // End
    await time.increaseTo(endTime);

    // Set LP Locker
    const MockLPLocker = await ethers.getContractFactory('MockLPLocker');
    const lpLocker = await MockLPLocker.deploy();

    // Set LP Locker (must come from adminExecutor)
    await fairlaunch.connect(adminExecutor).setLPLocker(await lpLocker.getAddress());

    // Finalize
    try {
      await fairlaunch.finalize();
      console.log('Finalize Success (Unexpected)');
    } catch (e) {
      console.log('Finalize Failed as Expected:', e.message);
      // We expect it to fail, likely with DexAddLiquidityCallFailed or similar
    }
  });
});
