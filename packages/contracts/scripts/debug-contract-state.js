const hre = require('hardhat');

async function main() {
  const contractAddress = '0x4dE0d3CbF18550300a43AF99FA0b7Ec62841b1A1';

  const abi = [
    'function status() view returns (uint8)',
    'function isFinalized() view returns (bool)',
    'function isPaused() view returns (bool)',
    'function endTime() view returns (uint256)',
    'function totalRaised() view returns (uint256)',
    'function softcap() view returns (uint256)',
    'function lpLockerAddress() view returns (address)',
  ];

  const contract = new hre.ethers.Contract(contractAddress, abi, hre.ethers.provider);

  console.log('🔍 Contract State Check\n');

  const [status, isFinalized, isPaused, endTime, totalRaised, softcap, lpLocker] =
    await Promise.all([
      contract.status(),
      contract.isFinalized(),
      contract.isPaused(),
      contract.endTime(),
      contract.totalRaised(),
      contract.softcap(),
      contract.lpLockerAddress(),
    ]);

  const now = Math.floor(Date.now() / 1000);

  console.log('Status:', status.toString(), '(0=PENDING, 1=ACTIVE, 2=ENDED, 3=FAILED)');
  console.log('Finalized:', isFinalized);
  console.log('Paused:', isPaused);
  console.log('End Time:', new Date(Number(endTime) * 1000).toISOString());
  console.log('Now:', new Date().toISOString());
  console.log('Seconds until end:', Number(endTime) - now);
  console.log('Total Raised:', hre.ethers.formatEther(totalRaised), 'BNB');
  console.log('Softcap:', hre.ethers.formatEther(softcap), 'BNB');
  console.log('LP Locker:', lpLocker);

  console.log('\n🚨 BLOCKING ISSUES:');
  if (isPaused) console.log('❌ Contract PAUSED');
  if (isFinalized) console.log('❌ Already FINALIZED');
  if (status !== 2n) console.log('❌ Status NOT ENDED (current:', status.toString(), ')');
  if (Number(endTime) > now)
    console.log('❌ End time not reached (', Math.floor((Number(endTime) - now) / 60), 'min left)');
  if (lpLocker === hre.ethers.ZeroAddress) console.log('❌ LP Locker NOT SET');
  if (totalRaised < softcap) console.log('❌ Softcap NOT MET');
}

main().catch(console.error);
