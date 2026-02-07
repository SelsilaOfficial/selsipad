const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('Fairlaunch Tax Token Recovery', function () {
  let fairlaunchFactory;
  let fairlaunch;
  let taxToken;
  let owner, user1, treasury, adminExecutor;
  let feeSplitter;

  before(async function () {
    [owner, user1, treasury, adminExecutor] = await ethers.getSigners();

    // Deploy FeeSplitter mock (using corrected fully qualified name)
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
    
    // Deploy UNIVERSAL ROUTER MOCK and set code at address
    const UniversalRouterMock = await ethers.getContractFactory("contracts/mocks/UniversalRouterMock.sol:UniversalRouterMock");
    const mockRouterCode = await ethers.provider.getCode(await UniversalRouterMock.deploy().then(c => c.getAddress()));
    
    // Uniswap V2 Router address used in Fairlaunch (assuming default or testnet)
    // In test environment (chainId 31337), Fairlaunch uses: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
    const routerAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
    await ethers.provider.send("hardhat_setCode", [
      routerAddress,
      mockRouterCode,
    ]);
    
    // Get handle to mock router
    const mockRouter = await ethers.getContractAt("UniversalRouterMock", routerAddress);
    
    // Set Router to FAIL initially
    await mockRouter.setFail(true);
  });

  it('Should fail finalization but allow manual recovery', async function () {
    const startTime = (await time.latest()) + 60;
    const endTime = startTime + 3600;

    // Approve Factory
    await taxToken.approve(await fairlaunchFactory.getAddress(), ethers.MaxUint256);

    // Create Fairlaunch
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
        listingPremiumBps: 2000,
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
    const fairlaunchAddress = events[0].args[1];

    fairlaunch = await ethers.getContractAt('Fairlaunch', fairlaunchAddress);

    // Participate
    await time.increaseTo(startTime);
    await fairlaunch.connect(user1).contribute({ value: ethers.parseEther('2') });

    // End
    await time.increaseTo(endTime);

    // Set LP Locker
    const MockLPLocker = await ethers.getContractFactory(
      'contracts/mocks/MockLPLocker.sol:MockLPLocker'
    );
    const lpLocker = await MockLPLocker.deploy();
    await fairlaunch.connect(adminExecutor).setLPLocker(await lpLocker.getAddress());

    // 1. Try Finalize (Should FAIL because router set to fail)
    try {
      await fairlaunch.finalize();
      expect.fail('Should have reverted');
    } catch (e) {
      // Check error message or custom error if possible
      // console.log("Finalize error:", e);
      expect(e.message).to.include('DexAddLiquidityCallFailed');
      console.log('Step 1: Atomic Finalize Failed as expected.');
    }

    // 2. Admin Step 1: Distribute Fees (Should SUCCESS)
    // adminExecutor MUST call implementation_plan says admin functions are protected by ADMIN_ROLE.
    await fairlaunch.connect(adminExecutor).adminDistributeFee();

    let step = await fairlaunch.finalizeStep();
    expect(step).to.equal(1n); // FEE_DISTRIBUTED
    console.log('Step 2: Fee Distributed manually.');

    // 3. Admin Step 2: Add Liquidity (Should FAIL initially because router set to fail)
    try {
      await fairlaunch.connect(adminExecutor).adminAddLiquidity();
      expect.fail('Should have reverted');
    } catch (e) {
      expect(e.message).to.include('DexAddLiquidityCallFailed');
      console.log('Step 3: Admin Add Liquidity Failed as expected.');
    }

    // 4. RECOVERY: Simulate Fixing the Issue (e.g. Top up or fix router issue)
    // Here we just toggle the Mock Router to succeed.
    // We also top up just to cover base (though router mock ignores balance).
    await taxToken.transfer(fairlaunchAddress, ethers.parseEther("5000")); 
    
    // Get handle to mock router again (at address) just to be sure
    const mockRouter = await ethers.getContractAt("UniversalRouterMock", "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
    await mockRouter.setFail(false);
    console.log("Step 4: Issue Resolved (Mock Router set to succeed).");

    // 5. Retry Admin Step 2: Add Liquidity (Should SUCCESS)
    await fairlaunch.connect(adminExecutor).adminAddLiquidity();
    step = await fairlaunch.finalizeStep();
    expect(step).to.equal(2n); // LIQUIDITY_ADDED
    console.log('Step 5: Liquidity Added manually.');

    // 6. Admin Step 3: Lock LP
    await fairlaunch.connect(adminExecutor).adminLockLP();
    step = await fairlaunch.finalizeStep();
    expect(step).to.equal(3n); // LP_LOCKED
    console.log('Step 6: LP Locked manually.');

    // 7. Admin Step 4: Distribute Funds
    await fairlaunch.connect(adminExecutor).adminDistributeFunds();
    step = await fairlaunch.finalizeStep();
    expect(step).to.equal(4n); // FUNDS_DISTRIBUTED
    console.log('Step 7: Funds Distributed manually.');

    // Check final status
    const status = await fairlaunch.status();
    // 61: SUCCESS,
    // Status.SUCCESS is index 3.
    expect(status).to.equal(3n);

    const isFinalized = await fairlaunch.isFinalized();
    expect(isFinalized).to.be.true;
    console.log('Finalization Complete!');
  });
});
