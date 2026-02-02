const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EscrowVault", function () {
  let escrowVault;
  let token;
  let owner;
  let admin;
  let user;
  let deployer;

  const PROJECT_ID = ethers.keccak256(ethers.toUtf8Bytes("project-1"));
  const ESCROW_AMOUNT = ethers.parseEther("1000");

  beforeEach(async function () {
    [owner, admin, user, deployer] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const Token = await ethers.getContractFactory("MockERC20");
    token = await Token.deploy("Test Token", "TEST", ethers.parseEther("1000000"));
    await token.waitForDeployment();

    // Deploy EscrowVault
    const EscrowVault = await ethers.getContractFactory("EscrowVault");
    escrowVault = await EscrowVault.deploy();
    await escrowVault.waitForDeployment();

    // Grant admin role
    const ADMIN_ROLE = await escrowVault.ADMIN_ROLE();
    await escrowVault.grantRole(ADMIN_ROLE, admin.address);

    // Fund user with tokens
    await token.transfer(user.address, ESCROW_AMOUNT);
  });

  describe("Deposit", function () {
    it("Should allow user to deposit tokens", async function () {
      await token.connect(user).approve(await escrowVault.getAddress(), ESCROW_AMOUNT);

      await expect(
        escrowVault.connect(user).deposit(PROJECT_ID, await token.getAddress(), ESCROW_AMOUNT)
      )
        .to.emit(escrowVault, "Deposited")
        .withArgs(PROJECT_ID, await token.getAddress(), ESCROW_AMOUNT, user.address);

      const deposit = await escrowVault.getDeposit(PROJECT_ID);
      expect(deposit.amount).to.equal(ESCROW_AMOUNT);
      expect(deposit.depositor).to.equal(user.address);
      expect(deposit.released).to.be.false;
      expect(deposit.refunded).to.be.false;
    });

    it("Should reject deposit with zero amount", async function () {
      await expect(
        escrowVault.connect(user).deposit(PROJECT_ID, await token.getAddress(), 0)
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("Should reject duplicate deposits for same project", async function () {
      await token.connect(user).approve(await escrowVault.getAddress(), ESCROW_AMOUNT * 2n);
      await escrowVault.connect(user).deposit(PROJECT_ID, await token.getAddress(), ESCROW_AMOUNT);

      await expect(
        escrowVault.connect(user).deposit(PROJECT_ID, await token.getAddress(), ESCROW_AMOUNT)
      ).to.be.revertedWith("Project already has deposit");
    });
  });

  describe("Release", function () {
    beforeEach(async function () {
      await token.connect(user).approve(await escrowVault.getAddress(), ESCROW_AMOUNT);
      await escrowVault.connect(user).deposit(PROJECT_ID, await token.getAddress(), ESCROW_AMOUNT);
    });

    it("Should allow admin to release tokens to contract", async function () {
      await expect(
        escrowVault.connect(admin).release(PROJECT_ID, deployer.address)
      )
        .to.emit(escrowVault, "Released")
        .withArgs(PROJECT_ID, deployer.address, ESCROW_AMOUNT);

      const balance = await token.balanceOf(deployer.address);
      expect(balance).to.equal(ESCROW_AMOUNT);

      const deposit = await escrowVault.getDeposit(PROJECT_ID);
      expect(deposit.released).to.be.true;
    });

    it("Should reject release from non-admin", async function () {
      await expect(
        escrowVault.connect(user).release(PROJECT_ID, deployer.address)
      ).to.be.reverted;
    });

    it("Should reject double release", async function () {
      await escrowVault.connect(admin).release(PROJECT_ID, deployer.address);

      await expect(
        escrowVault.connect(admin).release(PROJECT_ID, deployer.address)
      ).to.be.revertedWith("Already released");
    });
  });

  describe("Refund", function () {
    beforeEach(async function () {
      await token.connect(user).approve(await escrowVault.getAddress(), ESCROW_AMOUNT);
      await escrowVault.connect(user).deposit(PROJECT_ID, await token.getAddress(), ESCROW_AMOUNT);
    });

    it("Should allow admin to refund tokens to depositor", async function () {
      const userBalanceBefore = await token.balanceOf(user.address);

      await expect(escrowVault.connect(admin).refund(PROJECT_ID))
        .to.emit(escrowVault, "Refunded")
        .withArgs(PROJECT_ID, user.address, ESCROW_AMOUNT);

      const userBalanceAfter = await token.balanceOf(user.address);
      expect(userBalanceAfter - userBalanceBefore).to.equal(ESCROW_AMOUNT);

      const deposit = await escrowVault.getDeposit(PROJECT_ID);
      expect(deposit.refunded).to.be.true;
    });

    it("Should reject refund after release", async function () {
      await escrowVault.connect(admin).release(PROJECT_ID, deployer.address);

      await expect(
        escrowVault.connect(admin).refund(PROJECT_ID)
      ).to.be.revertedWith("Already released");
    });
  });

  describe("View Functions", function () {
    it("Should return correct balance", async function () {
      await token.connect(user).approve(await escrowVault.getAddress(), ESCROW_AMOUNT);
      await escrowVault.connect(user).deposit(PROJECT_ID, await token.getAddress(), ESCROW_AMOUNT);

      const balance = await escrowVault.getBalance(PROJECT_ID);
      expect(balance).to.equal(ESCROW_AMOUNT);
    });

    it("Should return zero balance after release", async function () {
      await token.connect(user).approve(await escrowVault.getAddress(), ESCROW_AMOUNT);
      await escrowVault.connect(user).deposit(PROJECT_ID, await token.getAddress(), ESCROW_AMOUNT);
      await escrowVault.connect(admin).release(PROJECT_ID, deployer.address);

      const balance = await escrowVault.getBalance(PROJECT_ID);
      expect(balance).to.equal(0);
    });

    it("Should correctly report pending status", async function () {
      expect(await escrowVault.isPending(PROJECT_ID)).to.be.false;

      await token.connect(user).approve(await escrowVault.getAddress(), ESCROW_AMOUNT);
      await escrowVault.connect(user).deposit(PROJECT_ID, await token.getAddress(), ESCROW_AMOUNT);

      expect(await escrowVault.isPending(PROJECT_ID)).to.be.true;

      await escrowVault.connect(admin).release(PROJECT_ID, deployer.address);

      expect(await escrowVault.isPending(PROJECT_ID)).to.be.false;
    });
  });
});
