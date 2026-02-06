const hre = require('hardhat');

async function main() {
  const contractAddress = '0xa547bC5Ea05Daa1e13492887ebfc3768F1446500';

  const fullAbi = require('../artifacts/contracts/fairlaunch/Fairlaunch.sol/Fairlaunch.json').abi;
  const [signer] = await hre.ethers.getSigners();
  const contract = new hre.ethers.Contract(contractAddress, fullAbi, signer);

  console.log('🔍 Deep Debug - Finalize Revert Analysis');
  console.log('Contract:', contractAddress);
  console.log('Caller:', signer.address);
  console.log('');

  // Get current state
  const [status, endTime, isFinalized, totalRaised, softcap] = await Promise.all([
    contract.status(),
    contract.endTime(),
    contract.isFinalized(),
    contract.totalRaised(),
    contract.softcap(),
  ]);

  const latestBlock = await hre.ethers.provider.getBlock('latest');
  const blockTime = latestBlock.timestamp;

  console.log('📊 Pre-Call State:');
  console.log('  status:', status.toString(), '(1=LIVE, 2=ENDED)');
  console.log(
    '  endTime:',
    endTime.toString(),
    '=',
    new Date(Number(endTime) * 1000).toISOString()
  );
  console.log(
    '  block.timestamp:',
    blockTime.toString(),
    '=',
    new Date(Number(blockTime) * 1000).toISOString()
  );
  console.log('  block.timestamp >= endTime:', blockTime >= endTime ? '✅ YES' : '❌ NO');
  console.log('  isFinalized:', isFinalized);
  console.log('  totalRaised:', hre.ethers.formatEther(totalRaised));
  console.log('  softcap:', hre.ethers.formatEther(softcap));
  console.log('');

  // Simulate what _updateStatus() SHOULD do
  console.log('🧪 Simulating _updateStatus() logic:');
  if (status === 1n && blockTime >= endTime) {
    console.log('  ✅ Condition MET: status==LIVE && timestamp>=endTime');
    console.log('  ✅ SHOULD update status to ENDED (2)');
  } else {
    console.log('  ❌ Condition NOT MET');
    console.log('    status == LIVE:', status === 1n ? 'YES' : 'NO');
    console.log('    timestamp >= endTime:', blockTime >= endTime ? 'YES' : 'NO');
  }
  console.log('');

  // Try finalize staticCall
  console.log('🎯 Calling finalize.staticCall()...');
  try {
    await contract.finalize.staticCall();
    console.log('✅ SUCCESS - finalize should work on actual call!');
  } catch (error) {
    console.log('❌ FAILED - finalize will revert');
    console.log('');
    console.log('Error message:', error.message);

    if (error.data) {
      console.log('Revert data:', error.data);

      // Try decode
      try {
        const iface = new hre.ethers.Interface(fullAbi);
        const decoded = iface.parseError(error.data);
        console.log('');
        console.log('🔍 Decoded Error:');
        console.log('  Name:', decoded?.name);
        if (decoded?.args && decoded.args.length > 0) {
          console.log('  Args:', decoded.args);
        }
      } catch (e) {
        // Silence decode errors
      }
    }

    // Additional diagnostics
    console.log('');
    console.log('💡 Diagnostic Analysis:');
    console.log('  Most likely revert reason:');

    if (status !== 2n) {
      console.log('  ⚠️  status != ENDED after _updateStatus() call');
      console.log('  ⚠️  This means _updateStatus() did NOT update status!');
      console.log('  ⚠️  Possible causes:');
      console.log('      1. Logic bug in _updateStatus()');
      console.log('      2. Timestamp check failing (unlikely - we checked above)');
      console.log('      3. Some other state mutation preventing update');
    }

    if (isFinalized) {
      console.log('  ⚠️  isFinalized == true (already finalized)');
    }
  }
}

main().catch(console.error);
