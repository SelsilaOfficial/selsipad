const hre = require('hardhat');

async function main() {
  const contractAddress = '0x4dE0d3CbF18550300a43AF99FA0b7Ec62841b1A1';

  const abi = [
    'function finalize() external',
    'function status() view returns (uint8)',
    'function endTime() view returns (uint256)',
  ];

  const [signer] = await hre.ethers.getSigners();
  const contract = new hre.ethers.Contract(contractAddress, abi, signer);

  console.log('Testing finalize with staticCall...\n');

  try {
    // Try staticCall to see exact revert reason
    await contract.finalize.staticCall();
    console.log('✅ staticCall SUCCESS - finalize should work!');
  } catch (error) {
    console.log('❌ staticCall FAILED');
    console.log('Error:', error.message);

    if (error.data) {
      console.log('Revert data:', error.data);
    }
  }

  const status = await contract.status();
  const endTime = await contract.endTime();
  const now = Math.floor(Date.now() / 1000);

  console.log('\nContract State:');
  console.log('Status:', status.toString(), '(1=LIVE, 2=ENDED)');
  console.log('End Time:', new Date(Number(endTime) * 1000).toISOString());
  console.log('Now:', new Date().toISOString());
  console.log('Should transition to ENDED:', now >= Number(endTime));
}

main().catch(console.error);
