const ethers = require('ethers');

const provider = new ethers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545');
const contractAddress = '0x4dE0d3CbF18550300a43AF99FA0b7Ec62841b1A1';

const abi = [
  'function status() view returns (uint8)',
  'function isFinalized() view returns (bool)',
  'function isPaused() view returns (bool)',
  'function endTime() view returns (uint256)',
  'function totalRaised() view returns (uint256)',
  'function softcap() view returns (uint256)',
  'function lpLockerAddress() view returns (address)'
];

async function checkState() {
  const contract = new ethers.Contract(contractAddress, abi, provider);
  
  try {
    console.log('🔍 Checking Contract State...\n');
    
    const [status, isFinalized, isPaused, endTime, totalRaised, softcap, lpLocker] = await Promise.all([
      contract.status(),
      contract.isFinalized(),
      contract.isPaused(),
      contract.endTime(),
      contract.totalRaised(),
      contract.softcap(),
      contract.lpLockerAddress()
    ]);
    
    const now = Math.floor(Date.now() / 1000);
    const endTimeDate = new Date(Number(endTime) * 1000);
    
    console.log('Status:', status, '(0=PENDING, 1=ACTIVE, 2=ENDED, 3=FAILED)');
    console.log('Is Finalized:', isFinalized);
    console.log('Is Paused:', isPaused);
    console.log('End Time:', endTimeDate.toISOString());
    console.log('Current Time:', new Date(now * 1000).toISOString());
    console.log('Time until end:', (Number(endTime) - now), 'seconds');
    console.log('Total Raised:', ethers.formatEther(totalRaised), 'BNB');
    console.log('Softcap:', ethers.formatEther(softcap), 'BNB');
    console.log('Softcap Met:', totalRaised >= softcap);
    console.log('LP Locker:', lpLocker);
    
    console.log('\n❌ BLOCKING ISSUES:');
    if (isPaused) console.log('  - Contract is PAUSED');
    if (isFinalized) console.log('  - Already FINALIZED');
    if (status !== 2n) console.log('  - Status is NOT ENDED (current:', status, ')');
    if (Number(endTime) > now) console.log('  - End time NOT reached yet (', Math.floor((Number(endTime) - now) / 60), 'minutes remaining)');
    if (lpLocker === ethers.ZeroAddress) console.log('  - LP Locker NOT SET');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkState();
