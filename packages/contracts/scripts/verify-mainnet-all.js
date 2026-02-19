const hre = require('hardhat');

/**
 * Verify ALL 4 BSC Mainnet contracts on BscScan
 *
 * Usage:
 *   cd packages/contracts
 *   npx hardhat run scripts/verify-mainnet-all.js --network bsc
 */

// ─── Deployed Contract Addresses ───
const CONTRACTS = {
  feeSplitter: {
    address: '0x2Bf655410Cf6d7A88dc0d4D1f815546C8Eb2Ab52',
    constructorArgs: [
      '0x124D5b097838A2F15b08f83239961b5D5D825223', // treasury
      '0x7A5812758Cad9585b84c292bFeaD5f7929E40339', // referralPool
      '0x124D5b097838A2F15b08f83239961b5D5D825223', // sbtStaking
      '0x59788e689b3c1d36F9968c6CC78CC4Ce1b2Ecd4E', // admin (deployer)
    ],
    contract: 'contracts/std-presale/FeeSplitter.sol:FeeSplitter',
  },
  lpLocker: {
    address: '0x4c6bA7e2667EBa61c0E84694A4828D0b33ffAF85',
    constructorArgs: [],
    contract: 'contracts/shared/LPLocker.sol:LPLocker',
  },
  presaleFactory: {
    address: '0x0b3662a97C962bdAFC3e66dcE076A65De18C223d',
    constructorArgs: [
      '0x2Bf655410Cf6d7A88dc0d4D1f815546C8Eb2Ab52', // feeSplitter
      '0x59788e689b3c1d36F9968c6CC78CC4Ce1b2Ecd4E', // timelockExecutor (deployer)
      '0x10ED43C718714eb63d5aA57B78B54704E256024E', // dexRouter (PancakeSwap V2)
      '0x4c6bA7e2667EBa61c0E84694A4828D0b33ffAF85', // lpLocker
    ],
    contract: 'contracts/std-presale/PresaleFactory.sol:PresaleFactory',
  },
  blueCheckRegistry: {
    address: '0xC14CdFE71Ca04c26c969a1C8a6aA4b1192e6fC43',
    constructorArgs: [
      '0x124D5b097838A2F15b08f83239961b5D5D825223', // treasury
      '0x7A5812758Cad9585b84c292bFeaD5f7929E40339', // referralPool
      '600000000000000000000', // initialBNBPrice = 600 * 1e18
    ],
    contract: 'contracts/bluecheck/BlueCheckRegistry.sol:BlueCheckRegistry',
  },
};

async function verifyContract(name, info) {
  console.log(`\n🔍 Verifying ${name}...`);
  console.log(`   Address: ${info.address}`);
  console.log(`   Contract: ${info.contract}`);

  try {
    await hre.run('verify:verify', {
      address: info.address,
      constructorArguments: info.constructorArgs,
      contract: info.contract,
    });
    console.log(`   ✅ ${name} — VERIFIED!`);
    return true;
  } catch (error) {
    if (error.message.includes('Already Verified') || error.message.includes('already verified')) {
      console.log(`   ✅ ${name} — Already verified!`);
      return true;
    }
    console.error(`   ❌ ${name} — FAILED: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🔍 BscScan Verification — 4 SC BSC Mainnet');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Network: ${hre.network.name}`);

  if (hre.network.name !== 'bsc') {
    console.error('❌ This script is for BSC Mainnet only!');
    process.exit(1);
  }

  const results = {};

  for (const [name, info] of Object.entries(CONTRACTS)) {
    results[name] = await verifyContract(name, info);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('📋 RESULTS:');
  console.log('═══════════════════════════════════════════════════');

  for (const [name, success] of Object.entries(results)) {
    const icon = success ? '✅' : '❌';
    console.log(`   ${icon} ${name}: ${CONTRACTS[name].address}`);
  }

  const allVerified = Object.values(results).every(Boolean);
  if (allVerified) {
    console.log('\n🎉 ALL 4 CONTRACTS VERIFIED! Green checkmarks on BscScan!');
  } else {
    console.log('\n⚠️  Some contracts failed verification. Check errors above.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
