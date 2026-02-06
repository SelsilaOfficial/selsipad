const { ethers } = require('hardhat');

async function main() {
  const contractAddress = '0x4d5c75CC8fc541dfFb28300c40371bb2D38e4e57';

  // Minimal ABI to check state
  const abi = [
    'function endTime() view returns (uint256)',
    'function softCap() view returns (uint256)',
    'function totalRaised() view returns (uint256)',
    'function finalized() view returns (bool)',
    'function lpLockerAddress() view returns (address)',
    'function creator() view returns (address)',
    'function finalize() external',
  ];

  const contract = await ethers.getContractAt(abi, contractAddress);

  console.log('=== Contract State ===');
  console.log('End Time:', (await contract.endTime()).toString());
  console.log('Soft Cap:', ethers.formatEther(await contract.softCap()), 'BNB');
  console.log('Total Raised:', ethers.formatEther(await contract.totalRaised()), 'BNB');
  console.log('Finalized:', await contract.finalized());
  console.log('LP Locker:', await contract.lpLockerAddress());
  console.log('Creator:', await contract.creator());

  const now = Math.floor(Date.now() / 1000);
  const endTime = Number(await contract.endTime());
  console.log('\nTime Check:');
  console.log('Current Time:', now);
  console.log('End Time:', endTime);
  console.log('Has Ended:', now > endTime);

  // Try to estimate gas for finalize
  console.log('\n=== Testing Finalize ===');
  try {
    const adminSigner = await ethers.getSigner('0x178cf582e811B30205CBF4Bb7bE45A9dF31AaC4A');
    const gas = await contract.connect(adminSigner).finalize.estimateGas();
    console.log('✅ Finalize gas estimate:', gas.toString());
  } catch (error) {
    console.log('❌ Finalize failed:', error.message);

    // Try staticCall to see revert reason
    try {
      await contract.connect(adminSigner).finalize.staticCall();
    } catch (staticError) {
      console.log('Static call error:', staticError);
    }
  }
}

main().catch(console.error);
