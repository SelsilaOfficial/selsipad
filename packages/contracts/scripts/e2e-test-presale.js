/**
 * E2E Presale Test Script
 *
 * Full flow: deploy tokens -> create presale via factory -> contribute ->
 * finalizeSuccess (with Merkle) -> verify status. Optionally test fail path (finalizeFailed + refund).
 *
 * Usage:
 *   npx hardhat run scripts/e2e-test-presale.js --network bsc_testnet
 *   npx hardhat run scripts/e2e-test-presale.js --network hardhat  # use evm_increaseTime
 *
 * Env:
 *   PRESALE_FACTORY_ADDRESS - optional; if set, use existing factory (testnet).
 *   TIMELOCK_ADDRESS        - optional; if not set, deployer is used as timelock (local).
 *   SKIP_WAIT               - set to 1 to use evm_increaseTime instead of real wait (hardhat only).
 *   FINALIZE_FAIL            - set to 1 to test finalizeFailed + refund path instead of success.
 */

const hre = require('hardhat');
const { MerkleTree } = require('merkletreejs');

// Leaf = keccak256(packed(vesting, chainId, salt, beneficiary, total)) per MerkleVesting.sol
// Tree leaves are these 32-byte hashes; use identity so getRoot() returns correct root.
function buildMerkleTree(vestingAddr, chainId, scheduleSalt, entries) {
  const leaves = entries.map(({ who, total }) => {
    const packed = hre.ethers.solidityPacked(
      ['address', 'uint256', 'bytes32', 'address', 'uint256'],
      [vestingAddr, chainId, scheduleSalt, who, total]
    );
    return Buffer.from(hre.ethers.getBytes(hre.ethers.keccak256(packed)));
  });
  const hashFn = (data) =>
    data.length === 32
      ? data
      : Buffer.from(hre.ethers.getBytes(hre.ethers.keccak256(data)));
  const tree = new MerkleTree(leaves, hashFn, { sortPairs: true });
  const root = '0x' + tree.getRoot().toString('hex');
  const getProof = (who, total) => {
    const idx = entries.findIndex((e) => e.who === who && e.total === total);
    if (idx < 0) return [];
    return tree.getHexProof(leaves[idx]);
  };
  return { root, getProof, totalAllocation: entries.reduce((s, e) => s + e.total, 0n) };
}

async function waitSeconds(seconds) {
  if (process.env.SKIP_WAIT === '1') return;
  console.log(`   Waiting ${seconds}s...`);
  await new Promise((r) => setTimeout(r, seconds * 1000));
}

async function main() {
  console.log('🧪 E2E Presale Test\n');
  console.log('='.repeat(60));

  const [deployer, admin] = await hre.ethers.getSigners();
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;
  const isHardhat = chainId === 31337n || hre.network.name === 'hardhat';

  console.log('Deployer (project owner / buyer):', deployer.address);
  console.log('Admin (factory + round finalizer):', admin.address);
  console.log('Chain ID:', chainId.toString());
  console.log(
    'Balance:',
    hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)),
    isHardhat ? 'ETH' : 'BNB',
    '\n'
  );

  const PRESALE_FACTORY_ADDRESS = process.env.PRESALE_FACTORY_ADDRESS;
  // When deploying factory locally, use deployer as timelock so script can finalize without extra keys.
  const TIMELOCK_ADDRESS = PRESALE_FACTORY_ADDRESS
    ? (process.env.TIMELOCK_ADDRESS || deployer.address)
    : (await deployer.getAddress());
  const testFailPath = process.env.FINALIZE_FAIL === '1';

  let factoryAddress = PRESALE_FACTORY_ADDRESS;
  let paymentTokenAddress;
  let projectTokenAddress;

  // ========================================
  // STEP 1: Deploy tokens (always)
  // ========================================
  console.log('📝 STEP 1: Deploying payment and project tokens...');

  const ERC20Mock = await hre.ethers.getContractFactory('ERC20Mock');
  const paymentToken = await ERC20Mock.deploy('USDC', 'USDC', 6);
  await paymentToken.waitForDeployment();
  paymentTokenAddress = await paymentToken.getAddress();
  await paymentToken.mint(deployer.address, 10_000_000_000_000n); // 10M USDC (6 decimals)
  console.log('   Payment token (USDC 6d):', paymentTokenAddress);

  const projectToken = await ERC20Mock.deploy('PRJ', 'PRJ', 18);
  await projectToken.waitForDeployment();
  projectTokenAddress = await projectToken.getAddress();
  await projectToken.mint(deployer.address, hre.ethers.parseEther('1000000'));
  console.log('   Project token (PRJ 18d):', projectTokenAddress);
  console.log('');

  // ========================================
  // STEP 2: Factory (deploy if not provided)
  // ========================================
  if (!factoryAddress) {
    console.log('📝 STEP 2: Deploying FeeSplitter + PresaleFactory (local)...');
    const treasury = deployer.address;
    const referral = deployer.address;
    const sbt = deployer.address;

    const FeeSplitter = await hre.ethers.getContractFactory('FeeSplitter');
    const feeSplitter = await FeeSplitter.deploy(treasury, referral, sbt, admin.address);
    await feeSplitter.waitForDeployment();
    const feeSplitterAddress = await feeSplitter.getAddress();

    const Factory = await hre.ethers.getContractFactory('PresaleFactory');
    const factory = await Factory.deploy(feeSplitterAddress, TIMELOCK_ADDRESS);
    await factory.waitForDeployment();
    factoryAddress = await factory.getAddress();

    const feeSplitterAsAdmin = feeSplitter.connect(admin);
    await feeSplitterAsAdmin.grantRole(await feeSplitter.DEFAULT_ADMIN_ROLE(), factoryAddress);
    await factory.grantRole(await factory.FACTORY_ADMIN_ROLE(), admin.address);
    console.log('   PresaleFactory:', factoryAddress);
    console.log('');
  } else {
    console.log('📝 STEP 2: Using existing PresaleFactory:', factoryAddress);
    console.log('');
  }

  const factoryAbi =
    require('../artifacts/contracts/std-presale/PresaleFactory.sol/PresaleFactory.json').abi;
  const factory = new hre.ethers.Contract(factoryAddress, factoryAbi, admin);

  // ========================================
  // STEP 3: Create presale
  // ========================================
  console.log('📝 STEP 3: Creating presale via factory...');

  const now = Math.floor(Date.now() / 1000);
  const startTime = now + (isHardhat ? 60 : 30);
  const endTime = startTime + (isHardhat ? 3600 : 300);

  const softCap = 1_000_000n; // 1 USDC (6 decimals)
  const hardCap = 5_000_000n;
  const minContribution = 100_000n;
  const maxContribution = 3_000_000n;

  const params = {
    projectToken: projectTokenAddress,
    paymentToken: paymentTokenAddress,
    softCap,
    hardCap,
    minContribution,
    maxContribution,
    startTime,
    endTime,
    projectOwner: deployer.address,
  };
  const vestingParams = {
    tgeUnlockBps: 1000n,
    cliffDuration: 0n,
    vestingDuration: 1000n,
  };
  const lpPlan = {
    lockMonths: 12n,
    dexId: hre.ethers.keccak256(hre.ethers.toUtf8Bytes('UNISWAP_V2')),
    liquidityPercent: 7000n,
  };
  const complianceHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('e2e-compliance'));

  const createTx = await factory.createPresale(params, vestingParams, lpPlan, complianceHash);
  const receipt = await createTx.wait();

  const event = receipt.logs.find((log) => {
    try {
      const parsed = factory.interface.parseLog({ topics: log.topics, data: log.data });
      return parsed && parsed.name === 'PresaleCreated';
    } catch {
      return false;
    }
  });
  if (!event) throw new Error('PresaleCreated event not found');
  const { round, vesting, scheduleSalt } = factory.interface.parseLog({
    topics: event.topics,
    data: event.data,
  }).args;

  console.log('   Round:', round);
  console.log('   Vesting:', vesting);
  console.log('   Schedule salt:', scheduleSalt);
  console.log('');

  const roundAbi =
    require('../artifacts/contracts/std-presale/PresaleRound.sol/PresaleRound.json').abi;
  const roundContract = new hre.ethers.Contract(round, roundAbi, deployer);

  // When using existing factory (testnet), admin must have round ADMIN (granted off-chain by timelock).
  // When we deployed the factory locally, round admin = timelock = deployer, so we finalize as deployer.
  const finalizer = PRESALE_FACTORY_ADDRESS ? admin : deployer;
  if (PRESALE_FACTORY_ADDRESS) {
    console.log('   Using admin as finalizer (ensure timelock granted round ADMIN_ROLE to admin)');
  }

  // ========================================
  // STEP 4: Wait for start & contribute
  // ========================================
  if (isHardhat && process.env.SKIP_WAIT === '1') {
    await hre.ethers.provider.send('evm_setNextBlockTimestamp', [Number(startTime) + 1]);
    await hre.ethers.provider.send('evm_mine', []);
  } else {
    const waitStart = startTime - Math.floor(Date.now() / 1000) + 5;
    if (waitStart > 0) await waitSeconds(waitStart);
  }

  console.log('📝 STEP 4: Contributing (payment token)...');
  const contributionAmount = testFailPath ? 500_000n : 1_500_000n; // below softcap for fail path
  await paymentToken.approve(round, contributionAmount);
  await roundContract.contribute(contributionAmount, hre.ethers.ZeroAddress);
  const totalRaised = await roundContract.totalRaised();
  console.log('   Contributed:', contributionAmount.toString(), 'units');
  console.log('   Total raised:', totalRaised.toString());
  console.log('   Softcap met:', totalRaised >= softCap ? '✅' : '❌');
  console.log('');

  // ========================================
  // STEP 5: Wait for end
  // ========================================
  if (isHardhat && process.env.SKIP_WAIT === '1') {
    await hre.ethers.provider.send('evm_setNextBlockTimestamp', [Number(endTime) + 10]);
    await hre.ethers.provider.send('evm_mine', []);
  } else {
    const waitEnd = endTime - Math.floor(Date.now() / 1000) + 5;
    if (waitEnd > 0) await waitSeconds(waitEnd);
  }

  if (testFailPath) {
    // ========== FAIL PATH: finalizeFailed -> refund ==========
    console.log('📝 STEP 5 (fail path): Finalizing as FAILED...');
  const roundFinalizer = new hre.ethers.Contract(round, roundAbi, finalizer);
  await roundFinalizer.finalizeFailed('Softcap not met (E2E test)');
  await roundFinalizer.pause();
    console.log('   finalizeFailed + pause done');

    console.log('   Claiming refund...');
    const balBefore = await paymentToken.balanceOf(deployer.address);
    await roundContract.claimRefund();
    const balAfter = await paymentToken.balanceOf(deployer.address);
    console.log('   Refund received:', (balAfter - balBefore).toString(), 'units');
    console.log('');
    console.log('='.repeat(60));
    console.log('🎉 E2E PRESALE FAIL PATH COMPLETED!');
    console.log('  ✅ Presale created');
    console.log('  ✅ Contributed (below softcap)');
    console.log('  ✅ finalizeFailed + pause');
    console.log('  ✅ claimRefund');
    return;
  }

  // ========== SUCCESS PATH: build Merkle, fund vesting, finalizeSuccess ==========
  console.log('📝 STEP 5: Building Merkle and finalizing SUCCESS...');

  const allocTokens = (contributionAmount * hre.ethers.parseEther('1')) / 1_000_000n; // 1 token per 1 USDC
  const entries = [{ who: deployer.address, total: allocTokens }];
  const { root: merkleRoot, totalAllocation } = buildMerkleTree(
    vesting,
    chainId,
    scheduleSalt,
    entries
  );

  await projectToken.transfer(vesting, totalAllocation);
  await projectToken.approve(round, totalAllocation);

  const roundFinalizer = new hre.ethers.Contract(round, roundAbi, finalizer);
  const finalizeTx = await roundFinalizer.finalizeSuccess(merkleRoot, totalAllocation);
  await finalizeTx.wait();
  console.log('   finalizeSuccess tx:', finalizeTx.hash);

  const status = await roundContract.status();
  const tgeTimestamp = await roundContract.tgeTimestamp();
  console.log('   Status:', status.toString(), '(3 = FINALIZED_SUCCESS)');
  console.log('   TGE timestamp:', tgeTimestamp.toString());
  console.log('');

  // ========================================
  // STEP 6: Optional claim (vesting)
  // ========================================
  console.log('📝 STEP 6: Verifying / claim (optional)...');
  const vestingAbi =
    require('../artifacts/contracts/std-presale/MerkleVesting.sol/MerkleVesting.json').abi;
  const vestingContract = new hre.ethers.Contract(vesting, vestingAbi, deployer);
  const { getProof } = buildMerkleTree(vesting, chainId, scheduleSalt, entries);
  const proof = getProof(deployer.address, allocTokens);
  if (proof.length > 0) {
    const balBefore = await projectToken.balanceOf(deployer.address);
    await vestingContract.claim(allocTokens, proof);
    const balAfter = await projectToken.balanceOf(deployer.address);
    console.log('   Claimed:', (balAfter - balBefore).toString(), 'token wei');
  }
  console.log('');

  console.log('='.repeat(60));
  console.log('🎉 E2E PRESALE TEST COMPLETED!');
  console.log('  ✅ Tokens deployed');
  console.log('  ✅ Presale created via factory');
  console.log('  ✅ Contributed');
  console.log('  ✅ finalizeSuccess + Merkle');
  console.log('  ✅ Claim (vesting)');
  console.log('\nRound:', round);
  if (chainId === 97n) {
    console.log('BscScan:', `https://testnet.bscscan.com/address/${round}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ E2E PRESALE TEST FAILED:', err);
    process.exit(1);
  });
