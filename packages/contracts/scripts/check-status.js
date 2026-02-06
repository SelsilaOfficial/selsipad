const hre = require('hardhat');

async function main() {
  const contractAddress = '0x4dE0d3CbF18550300a43AF99FA0b7Ec62841b1A1';

  // Try calling getStatus() - this is a view function that returns CALCULATED status
  const abi = [
    'function status() view returns (uint8)',
    'function getStatus() view returns (uint8)',
    'function endTime() view returns (uint256)',
    'function startTime() view returns (uint256)',
  ];

  const contract = new hre.ethers.Contract(contractAddress, abi, hre.ethers.provider);

  console.log('🔍 Status Comparison\n');

  const storedStatus = await contract.status();
  const calculatedStatus = await contract.getStatus();
  const startTime = await contract.startTime();
  const endTime = await contract.endTime();

  const now = Math.floor(Date.now() / 1000);

  console.log('Stored Status:', storedStatus.toString());
  console.log('Calculated Status (getStatus):', calculatedStatus.toString());
  console.log('Start Time:', new Date(Number(startTime) * 1000).toISOString());
  console.log('End Time:', new Date(Number(endTime) * 1000).toISOString());
  console.log('Now:', new Date().toISOString());
  console.log('\nTime checks:');
  console.log('  now >= startTime:', now >= Number(startTime));
  console.log('  now >= endTime:', now >= Number(endTime));

  console.log('\n💡 Expected behavior:');
  console.log('  If now >= endTime → Status should be ENDED (2)');
  console.log(
    '  Calculated status from getStatus():',
    calculatedStatus.toString() === '2' ? '✅ ENDED' : '❌ NOT ENDED'
  );

  if (storedStatus.toString() !== calculatedStatus.toString()) {
    console.log('\n⚠️ MISMATCH: Stored status !== Calculated status');
    console.log('This means _updateStatus() was not called yet');
  }
}

main().catch(console.error);
