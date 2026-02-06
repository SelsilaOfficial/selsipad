const hre = require('hardhat');
const { verifyFairlaunchContracts } = require('../services/verifyFairlaunchContracts');

/**
 * E2E Test: Fairlaunch with Auto-Verification
 *
 * Tests complete flow:
 * 1. Deploy test token
 * 2. Create Fairlaunch via Factory
 * 3. Configure LP Locker
 * 4. Contribute to meet softcap
 * 5. Finalize (test LP locking + fee distribution)
 * 6. AUTO-VERIFY ALL CONTRACTS on BSCScan
 */

async function main() {
  console.log('🧪 E2E Fairlaunch Test + Auto-Verification\n');
  console.log('='.repeat(70));

  // Get signers
  const [deployer, admin] = await hre.ethers.getSigners();
  console.log('Deployer/Buyer:', deployer.address);
  console.log('Admin Executor:', admin.address);
  console.log(
    'Balance:',
    hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)),
    'BNB\n'
  );

  // Config
  const FACTORY_ADDRESS =
    process.env.FAIRLAUNCH_FACTORY_ADDRESS || '0x12c426d52B936c799ea3b1c28d0979d4CDbCB05E';
  const LP_LOCKER_ADDRESS =
    process.env.LP_LOCKER_ADDRESS || '0xD492CbD76150C805bF6b6f6D674827e27981eD63';

  // Load ABIs
  const factoryAbi =
    require('../artifacts/contracts/fairlaunch/FairlaunchFactory.sol/FairlaunchFactory.json').abi;
  const fairlaunchAbi =
    require('../artifacts/contracts/fairlaunch/Fairlaunch.sol/Fairlaunch.json').abi;
  const erc20Abi = [
    'function balanceOf(address) view returns (uint256)',
    'function transfer(address, uint256) returns (bool)',
    'function approve(address, uint256) returns (bool)',
    'function totalSupply() view returns (uint256)',
  ];

  // ========================================
  // STEP 1: Deploy Test Token
  // ========================================
  console.log('📝 STEP 1: Deploying Test Token...');

  const TestToken = await hre.ethers.getContractFactory('SimpleToken');
  const token = await TestToken.deploy(
    'E2E VERIFY TEST',
    'E2ETEST',
    hre.ethers.parseEther('100000'), // 100k tokens
    18,
    deployer.address
  );
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  console.log('✅ Token deployed:', tokenAddress);
  console.log('   Supply:', hre.ethers.formatEther(await token.totalSupply()), 'E2ETEST\n');

  // ========================================
  // STEP 2: Create Fairlaunch
  // ========================================
  console.log('📝 STEP 2: Creating Fairlaunch via Factory...');

  const factory = new hre.ethers.Contract(FACTORY_ADDRESS, factoryAbi, deployer);

  const tokensForSale = hre.ethers.parseEther('50000'); // 50k for sale
  const softcap = hre.ethers.parseEther('0.1'); // 0.1 BNB softcap
  const minContribution = hre.ethers.parseEther('0.05');
  const maxContribution = hre.ethers.parseEther('1');

  const now = Math.floor(Date.now() / 1000);
  const startTime = now + 30; // Start in 30s
  const endTime = now + 300; // End in 5 minutes

  // Approve factory
  console.log('   Approving factory...');
  const liquidityPercent = 8000n; // 80%
  const liquidityTokens = (tokensForSale * liquidityPercent) / 10000n;
  const totalRequired = tokensForSale + liquidityTokens;
  const approveTx = await token.approve(FACTORY_ADDRESS, totalRequired);
  await approveTx.wait();

  // Create fairlaunch
  console.log('   Creating fairlaunch...');
  const createTx = await factory.createFairlaunch(
    {
      projectToken: tokenAddress,
      paymentToken: hre.ethers.ZeroAddress, // BNB
      softcap: softcap,
      tokensForSale: tokensForSale,
      minContribution: minContribution,
      maxContribution: maxContribution,
      startTime: startTime,
      endTime: endTime,
      listingPremiumBps: 0,
      projectOwner: deployer.address,
    },
    {
      beneficiary: deployer.address,
      startTime: endTime,
      durations: [],
      amounts: [],
    },
    {
      liquidityPercent: Number(liquidityPercent),
      lockMonths: 12,
      dexId: hre.ethers.ZeroHash,
    },
    { value: hre.ethers.parseEther('0.2') }
  );

  const receipt = await createTx.wait();

  // Get fairlaunch address from event
  const event = receipt.logs.find((log) => {
    try {
      const parsed = factory.interface.parseLog({ topics: log.topics, data: log.data });
      return parsed.name === 'FairlaunchCreated';
    } catch {
      return false;
    }
  });

  const fairlaunchAddress = event
    ? factory.interface.parseLog({ topics: event.topics, data: event.data }).args.fairlaunch
    : null;

  if (!fairlaunchAddress) {
    throw new Error('Failed to get fairlaunch address from event');
  }

  console.log('✅ Fairlaunch created:', fairlaunchAddress);
  console.log('   Softcap:', hre.ethers.formatEther(softcap), 'BNB');
  console.log('   Tokens for sale:', hre.ethers.formatEther(tokensForSale), 'E2ETEST\n');

  // ========================================
  // STEP 3: Set LP Locker
  // ========================================
  console.log('📝 STEP 3: Setting LP Locker...');

  const fairlaunch = new hre.ethers.Contract(fairlaunchAddress, fairlaunchAbi, deployer);
  const fairlaunchAdmin = fairlaunch.connect(admin);

  const setLockerTx = await fairlaunchAdmin.setLPLocker(LP_LOCKER_ADDRESS);
  await setLockerTx.wait();

  const configuredLocker = await fairlaunch.lpLockerAddress();
  console.log('✅ LP Locker configured:', configuredLocker);
  console.log('   Match:', configuredLocker === LP_LOCKER_ADDRESS ? '✅' : '❌', '\n');

  // ========================================
  // STEP 4: Wait for Start & Contribute
  // ========================================
  console.log('📝 STEP 4: Waiting for start time...');
  const waitTime = startTime - Math.floor(Date.now() / 1000) + 5;
  if (waitTime > 0) {
    console.log(`   Waiting ${waitTime}s...\n`);
    await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
  }

  console.log('📝 Making contribution to meet softcap...');
  const contributionAmount = hre.ethers.parseEther('0.15'); // Above softcap

  const contributeTx = await fairlaunch.contribute({ value: contributionAmount });
  await contributeTx.wait();

  const totalRaised = await fairlaunch.totalRaised();
  console.log('✅ Contribution successful!');
  console.log('   Amount:', hre.ethers.formatEther(contributionAmount), 'BNB');
  console.log('   Total raised:', hre.ethers.formatEther(totalRaised), 'BNB');
  console.log('   Softcap met:', totalRaised >= softcap ? '✅' : '❌', '\n');

  // ========================================
  // STEP 5: Wait for End & Finalize
  // ========================================
  console.log('📝 STEP 5: Waiting for end time...');
  const waitForEnd = endTime - Math.floor(Date.now() / 1000) + 5;
  if (waitForEnd > 0) {
    console.log(`   Waiting ${waitForEnd}s...\n`);
    await new Promise((resolve) => setTimeout(resolve, waitForEnd * 1000));
  }

  console.log('📝 Finalizing fairlaunch...');
  const finalizeTx = await fairlaunch.finalize({ gasLimit: 5000000 });
  console.log('   TX sent:', finalizeTx.hash);

  const finalizeReceipt = await finalizeTx.wait();
  console.log('✅ Finalize successful!');
  console.log('   Block:', finalizeReceipt.blockNumber);
  console.log('   Gas used:', finalizeReceipt.gasUsed.toString(), '\n');

  // ========================================
  // STEP 6: Verify Results
  // ========================================
  console.log('📝 STEP 6: Verifying Results...\n');

  const finalStatus = await fairlaunch.status();
  console.log('✅ Status Check:');
  console.log('   Final status:', finalStatus.toString(), '(3=SUCCESS)');
  console.log('   Expected SUCCESS:', finalStatus.toString() === '3' ? '✅' : '❌', '\n');

  // ========================================
  // STEP 7: AUTO-VERIFY CONTRACTS 🔥
  // ========================================
  console.log('📝 STEP 7: AUTO-VERIFYING ALL CONTRACTS ON BSCSCAN...\n');
  console.log('='.repeat(70));

  try {
    const verificationResults = await verifyFairlaunchContracts(
      fairlaunchAddress, // Fairlaunch contract
      tokenAddress, // Token contract (no vesting in this test)
      null // No vesting contract
    );

    console.log('\n📊 VERIFICATION RESULTS:\n');
    console.log('Fairlaunch:', fairlaunchAddress);
    console.log('  Status:', verificationResults.fairlaunch.success ? '✅ VERIFIED' : '❌ FAILED');
    if (verificationResults.fairlaunch.success) {
      console.log('  Link:', `https://testnet.bscscan.com/address/${fairlaunchAddress}#code`);
    } else {
      console.log('  Error:', verificationResults.fairlaunch.error);
    }

    console.log('\nToken:', tokenAddress);
    console.log('  Status:', verificationResults.token.success ? '✅ VERIFIED' : '❌ FAILED');
    if (verificationResults.token.success) {
      console.log('  Link:', `https://testnet.bscscan.com/address/${tokenAddress}#code`);
    } else {
      console.log('  Error:', verificationResults.token.error);
    }

    console.log('\n' + '='.repeat(70));

    const allVerified = verificationResults.fairlaunch.success && verificationResults.token.success;
    console.log(
      allVerified ? '🎉 ALL CONTRACTS VERIFIED!' : '⚠️ SOME CONTRACTS FAILED VERIFICATION'
    );
  } catch (verifyError) {
    console.log('❌ Verification process failed:');
    console.log(verifyError.message);
    console.log('\n⚠️ CONTRACTS DEPLOYED BUT NOT VERIFIED');
  }

  console.log('\n' + '='.repeat(70));
  console.log('🎉 E2E TEST COMPLETED!\n');
  console.log('Summary:');
  console.log('  ✅ Token deployed');
  console.log('  ✅ Fairlaunch created via factory');
  console.log('  ✅ LP Locker configured');
  console.log('  ✅ Contribution successful');
  console.log('  ✅ Finalize completed');
  console.log('  ✅ Contract verification attempted');
  console.log('\nFairlaunch Address:', fairlaunchAddress);
  console.log('Token Address:', tokenAddress);
  console.log('View on BscScan:', `https://testnet.bscscan.com/address/${fairlaunchAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ TEST FAILED:');
    console.error(error);
    process.exit(1);
  });
