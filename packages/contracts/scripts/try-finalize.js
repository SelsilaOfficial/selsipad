const hre = require('hardhat');

async function main() {
  const contractAddress = '0x4dE0d3CbF18550300a43AF99FA0b7Ec62841b1A1';

  const fullAbi = require('../artifacts/contracts/fairlaunch/Fairlaunch.sol/Fairlaunch.json').abi;

  const [signer] = await hre.ethers.getSigners();
  console.log('Signer:', signer.address);

  const contract = new hre.ethers.Contract(contractAddress, fullAbi, signer);

  console.log('🔍 Pre-finalize State Check\n');

  const status = await contract.status();
  const endTime = await contract.endTime();
  const lpLocker = await contract.lpLockerAddress();
  const isFinalized = await contract.isFinalized();

  console.log('Status:', status.toString());
  console.log('End Time:', new Date(Number(endTime) * 1000).toISOString());
  console.log('LP Locker:', lpLocker);
  console.log('IsFinalized:', isFinalized);

  console.log('\n📞 Attempting finalize with explicit gas limit...\n');

  try {
    const tx = await contract.finalize({
      gasLimit: 5000000,
    });

    console.log('✅ TX Sent:', tx.hash);
    console.log('Waiting for confirmation...');

    const receipt = await tx.wait();
    console.log('✅ CONFIRMED in block:', receipt.blockNumber);
    console.log('Gas used:', receipt.gasUsed.toString());
  } catch (error) {
    console.log('❌ FAILED');
    console.log('Error:', error.shortMessage || error.message);

    if (error.data) {
      console.log('Revert data:', error.data);
    }

    // Try to decode custom error
    if (error.data && error.data !== '0x') {
      try {
        const errorSig = error.data.slice(0, 10);
        console.log('Error signature:', errorSig);

        // Common error signatures
        const errors = {
          '0x8baa579f': 'InvalidStatus()',
          '0x1cf99c7a': 'ContractPaused()',
        };

        if (errors[errorSig]) {
          console.log('Decoded error:', errors[errorSig]);
        }
      } catch (e) {
        // ignore
      }
    }
  }
}

main().catch(console.error);
