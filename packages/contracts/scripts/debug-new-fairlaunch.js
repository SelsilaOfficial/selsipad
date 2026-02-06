const hre = require('hardhat');

async function main() {
  const contractAddress = '0xDFdD5776678723aBe96651A83Fcb0F93d632Ff3D';

  const fullAbi = require('../artifacts/contracts/fairlaunch/Fairlaunch.sol/Fairlaunch.json').abi;
  const contract = new hre.ethers.Contract(contractAddress, fullAbi, hre.ethers.provider);

  console.log('🔍 Debugging New Contract:', contractAddress);
  console.log('');

  // Check basic state
  const [status, dexRouter, lpLocker, totalRaised, softcap, endTime] = await Promise.all([
    contract.status(),
    contract.dexRouter(),
    contract.lpLockerAddress(),
    contract.totalRaised(),
    contract.softcap(),
    contract.endTime(),
  ]);

  console.log('Status:', status.toString(), '(1=LIVE, 2=ENDED, 3=SUCCESS)');
  console.log('DEX Router:', dexRouter);
  console.log('LP Locker:', lpLocker);
  console.log('Total Raised:', hre.ethers.formatEther(totalRaised), 'BNB');
  console.log('Softcap:', hre.ethers.formatEther(softcap), 'BNB');
  console.log('End Time:', new Date(Number(endTime) * 1000).toISOString());
  console.log('Now:', new Date().toISOString());
  console.log('');

  // Check router
  const expectedRouter = '0xD99D1c33F9fC3444f8101754aBC46c52416550D1';
  console.log('Router Check:');
  console.log('  Expected (Testnet V2):', expectedRouter);
  console.log('  Actual:', dexRouter);
  console.log('  Match:', dexRouter.toLowerCase() === expectedRouter.toLowerCase() ? '✅' : '❌');
  console.log('');

  // Try staticCall finalize to get exact revert
  console.log('Testing finalize with staticCall...');
  try {
    await contract.finalize.staticCall();
    console.log('✅ staticCall SUCCESS - finalize should work!');
  } catch (error) {
    console.log('❌ staticCall FAILED');
    console.log('Error:', error.message);
    if (error.data) {
      console.log('Revert data:', error.data);
    }
  }
}

main().catch(console.error);
