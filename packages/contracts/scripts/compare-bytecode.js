const hre = require('hardhat');
const fs = require('fs');

async function main() {
  console.log('🔍 Bytecode Analysis - Factory vs Compiled\n');
  console.log('='.repeat(70));

  // Contracts to check
  const deployedContract = '0xa547bC5Ea05Daa1e13492887ebfc3768F1446500';
  const factory = '0x12c426d52B936c799ea3b1c28d0979d4CDbCB05E';

  console.log('Deployed Fairlaunch:', deployedContract);
  console.log('Factory:', factory);
  console.log('');

  // Get bytecode from blockchain
  console.log('📡 Fetching on-chain bytecode...');
  const deployedBytecode = await hre.ethers.provider.getCode(deployedContract);
  const factoryBytecode = await hre.ethers.provider.getCode(factory);

  console.log('Deployed contract bytecode length:', deployedBytecode.length);
  console.log('Factory bytecode length:', factoryBytecode.length);
  console.log('');

  // Load compiled artifact
  console.log('📁 Loading compiled artifact...');
  const artifactPath = './artifacts/contracts/fairlaunch/Fairlaunch.sol/Fairlaunch.json';

  if (!fs.existsSync(artifactPath)) {
    console.error('❌ Artifact not found! Please compile first.');
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const compiledBytecode = artifact.deployedBytecode;

  console.log('Compiled bytecode length:', compiledBytecode.length);
  console.log('');

  // Compare bytecodes
  console.log('🔬 Bytecode Comparison:');
  console.log('='.repeat(70));

  // Remove metadata hash from comparison (last 53 bytes for swarm hash)
  // Deployed bytecode from chain already doesn't have constructor args
  const deployed = deployedBytecode.slice(0, -106); // Remove metadata
  const compiled = compiledBytecode.slice(0, -106);

  console.log('Deployed (no metadata):', deployed.length, 'chars');
  console.log('Compiled (no metadata):', compiled.length, 'chars');
  console.log('');

  if (deployed === compiled) {
    console.log('✅ BYTECODE MATCH!');
    console.log('   Contract uses LATEST compiled code');
    console.log('   Problem is NOT stale bytecode');
  } else {
    console.log('❌ BYTECODE MISMATCH!');
    console.log('   Contract uses OLD/DIFFERENT compiled code');
    console.log('   Factory deployed stale/cached bytecode!');
    console.log('');

    // Find first difference
    const minLen = Math.min(deployed.length, compiled.length);
    let firstDiff = -1;
    for (let i = 0; i < minLen; i++) {
      if (deployed[i] !== compiled[i]) {
        firstDiff = i;
        break;
      }
    }

    if (firstDiff !== -1) {
      console.log('   First difference at position:', firstDiff);
      console.log('   Deployed:', deployed.slice(Math.max(0, firstDiff - 20), firstDiff + 20));
      console.log('   Compiled:', compiled.slice(Math.max(0, firstDiff - 20), firstDiff + 20));
    }

    if (deployed.length !== compiled.length) {
      console.log('   Length difference:', deployed.length - compiled.length, 'chars');
    }
  }

  console.log('');
  console.log('='.repeat(70));

  // Check for _updateStatus function
  console.log('');
  console.log('🔍 Checking for _updateStatus() function signature...');

  // Function selector for _updateStatus() would be in bytecode
  // Let's search for the status update pattern
  const statusUpdatePattern = '6002'; // Status.ENDED = 2

  if (deployedBytecode.includes(statusUpdatePattern)) {
    console.log('✅ Found status enum value (2) in bytecode');
  } else {
    console.log('⚠️  Status enum value (2) not found - suspicious!');
  }

  // Check router addresses in bytecode
  console.log('');
  console.log('🔍 Checking DEX router addresses in bytecode...');

  const testnetRouter = '0xD99D1c33F9fC3444f8101754aBC46c52416550D1'.toLowerCase().slice(2);
  const mainnetRouter = '0x10ED43C718714eb63d5aA57B78B54704E256024E'.toLowerCase().slice(2);

  const deployedLower = deployedBytecode.toLowerCase();

  if (deployedLower.includes(testnetRouter)) {
    console.log('✅ Found TESTNET router (0xD99D1c33...) in bytecode');
  } else {
    console.log('❌ TESTNET router (0xD99D1c33...) NOT found');
  }

  if (deployedLower.includes(mainnetRouter)) {
    console.log('⚠️  Found MAINNET router (0x10ED43C...) in bytecode - SHOULD NOT BE HERE!');
  } else {
    console.log('✅ MAINNET router (0x10ED43C...) NOT found (good)');
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('');

  // Final recommendation
  if (deployed !== compiled) {
    console.log('🎯 RECOMMENDATION:');
    console.log('   1. Hard clean: npx hardhat clean');
    console.log('   2. Recompile: npx hardhat compile');
    console.log('   3. Redeploy factory with fresh bytecode');
    console.log('   4. Test with new deployment');
  } else {
    console.log('🎯 RECOMMENDATION:');
    console.log('   Bytecode is correct. Problem is elsewhere:');
    console.log('   - Check _updateStatus() logic bug');
    console.log('   - Check gas issues during state update');
    console.log('   - Check for view/pure modifier issues');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
