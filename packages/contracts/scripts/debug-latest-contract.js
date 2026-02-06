const hre = require('hardhat');

async function main() {
  const contractAddress = '0xa547bC5Ea05Daa1e13492887ebfc3768F1446500';

  const fullAbi = require('../artifacts/contracts/fairlaunch/Fairlaunch.sol/Fairlaunch.json').abi;
  const contract = new hre.ethers.Contract(contractAddress, fullAbi, hre.ethers.provider);

  console.log('🔍 Debugging Contract:', contractAddress);
  console.log('');

  try {
    // Check basic state
    const [status, dexRouter, lpLocker, totalRaised, softcap, endTime, startTime, isFinalized] =
      await Promise.all([
        contract.status(),
        contract.dexRouter(),
        contract.lpLockerAddress(),
        contract.totalRaised(),
        contract.softcap(),
        contract.endTime(),
        contract.startTime(),
        contract.isFinalized(),
      ]);

    console.log('Status:', status.toString(), '(1=LIVE, 2=ENDED, 3=SUCCESS, 5=CANCELLED)');
    console.log('DEX Router:', dexRouter);
    console.log('LP Locker:', lpLocker);
    console.log('Total Raised:', hre.ethers.formatEther(totalRaised), 'BNB');
    console.log('Softcap:', hre.ethers.formatEther(softcap), 'BNB');
    console.log('Softcap Met:', totalRaised >= softcap ? '✅' : '❌');
    console.log('Start Time:', new Date(Number(startTime) * 1000).toISOString());
    console.log('End Time:', new Date(Number(endTime) * 1000).toISOString());
    console.log('Now:', new Date().toISOString());
    console.log('Is Finalized:', isFinalized ? 'YES' : 'NO');
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

        // Try to decode custom error
        try {
          const iface = new hre.ethers.Interface(fullAbi);
          const decoded = iface.parseError(error.data);
          console.log('Decoded error:', decoded?.name);
          if (decoded?.args) {
            console.log('Error args:', decoded.args);
          }
        } catch (decodeErr) {
          console.log('Could not decode error');
        }
      }
    }
  } catch (err) {
    console.error('Error reading contract:', err.message);
  }
}

main().catch(console.error);
