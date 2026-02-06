const hre = require('hardhat');

async function main() {
  const contractAddress = '0xd1c2361712cAC445b880332D2E86997d4f9c2436';

  console.log('🔍 Fairlaunch Finalize Debug (DEPLOYER WALLET)');
  console.log('Contract:', contractAddress);
  console.log('='.repeat(60));

  // Use DEPLOYER_PRIVATE_KEY from env
  const provider = new hre.ethers.JsonRpcProvider(
    process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545'
  );

  const adminWallet = new hre.ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  console.log('Admin Wallet:', adminWallet.address);

  // Minimal ABI for finalize debugging
  const fairlaunchABI = [
    'function finalize() external',
    'function isFinalized() view returns (bool)',
    'function status() view returns (uint8)',
    'function getStatus() view returns (uint8)',
    'function startTime() view returns (uint256)',
    'function endTime() view returns (uint256)',
    'function totalRaised() view returns (uint256)',
    'function softcap() view returns (uint256)',
    'function token() view returns (address)',
    'function lpLocker() view returns (address)',
    'function hasRole(bytes32 role, address account) view returns (bool)',
  ];

  const contract = new hre.ethers.Contract(contractAddress, fairlaunchABI, adminWallet);

  try {
    console.log('\n📊 Contract State:');

    const [
      isFinalized,
      status,
      startTime,
      endTime,
      currentBlock,
      totalRaised,
      softcap,
      token,
      lpLocker,
    ] = await Promise.all([
      contract.isFinalized(),
      contract.status(),
      contract.startTime(),
      contract.endTime(),
      provider.getBlock('latest'),
      contract.totalRaised(),
      contract.softcap(),
      contract.token(),
      contract.lpLocker(),
    ]);

    console.log('  Finalized:', isFinalized);
    console.log('  Status:', Number(status), getStatusName(status));
    console.log('  Total Raised:', hre.ethers.formatEther(totalRaised), 'BNB');
    console.log('  Softcap:', hre.ethers.formatEther(softcap), 'BNB');
    console.log('  Softcap Met:', totalRaised >= softcap);
    console.log('  Token:', token);
    console.log('  LP Locker:', lpLocker);

    const blockTime = currentBlock.timestamp;
    const startNum = Number(startTime);
    const endNum = Number(endTime);

    console.log('\n⏰ Timing:');
    console.log('  Current Block Time:', blockTime, new Date(blockTime * 1000).toISOString());
    console.log('  Start Time:', startNum, new Date(startNum * 1000).toISOString());
    console.log('  End Time:', endNum, new Date(endNum * 1000).toISOString());
    console.log('  Started:', blockTime >= startNum);
    console.log('  Ended:', blockTime >= endNum);

    // Check ADMIN role
    const ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const hasAdmin = await contract.hasRole(ADMIN_ROLE, adminWallet.address);
    console.log('\n🔑 Admin has ADMIN role:', hasAdmin);

    // Check calculated status
    const calculatedStatus = await contract.getStatus();
    console.log(
      '\n🔄 Calculated Status:',
      Number(calculatedStatus),
      getStatusName(calculatedStatus)
    );

    // Try to call finalize
    console.log('\n🧪 Testing finalize() call...');
    try {
      // Estimate gas
      const gasEstimate = await contract.finalize.estimateGas();
      console.log('✅ Gas estimate:', gasEstimate.toString());
      console.log('✅ finalize() SHOULD SUCCEED with gas:', gasEstimate);
    } catch (error) {
      console.log('❌ finalize() WILL REVERT:');
      console.log('  Error:', error.shortMessage || error.message);

      // Try to decode error
      if (error.data) {
        console.log('  Error Data:', error.data);
        try {
          const errorInterface = new hre.ethers.Interface([
            'error InvalidStatus()',
            'error Unauthorized()',
            'error FeeSplitterCallFailed(bytes reason)',
            'error LPLockerCallFailed(bytes reason)',
            'error DexAddLiquidityCallFailed(bytes reason)',
          ]);
          const decoded = errorInterface.parseError(error.data);
          console.log('  Decoded Error:', decoded?.name, decoded?.args);
        } catch (e) {
          console.log('  Unable to decode custom error');
        }
      }

      console.log('\n🔍 Diagnostics:');
      console.log('  - Already Finalized?', isFinalized);
      console.log('  - Stored Status:', Number(status), getStatusName(status));
      console.log(
        '  - Calculated Status:',
        Number(calculatedStatus),
        getStatusName(calculatedStatus)
      );
      console.log('  - Has ended?', blockTime >= endNum);
      console.log('  - Softcap met?', totalRaised >= softcap);
      console.log('  - LP Locker set?', lpLocker !== '0x0000000000000000000000000000000000000000');
      console.log('  - Has ADMIN role?', hasAdmin);
    }
  } catch (error) {
    console.error('\n❌ Error reading contract:', error.message);
  }
}

function getStatusName(status) {
  const names = ['PENDING', 'ACTIVE', 'ENDED', 'FAILED', 'CANCELLED'];
  return names[Number(status)] || 'UNKNOWN';
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
