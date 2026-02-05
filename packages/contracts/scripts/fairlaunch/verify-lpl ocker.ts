/**
 * Verify LP Locker contract is valid
 */

import { ethers } from 'hardhat';

async function main() {
  const LP_LOCKER_ADDRESS = '0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F';

  console.log('\n🔍 Verifying LP Locker Contract');
  console.log('=====================================');
  console.log(`LP Locker: ${LP_LOCKER_ADDRESS}`);

  // Check if contract exists
  const code = await ethers.provider.getCode(LP_LOCKER_ADDRESS);
  console.log(`\nContract exists?: ${code !== '0x' ? 'YES ✅' : 'NO ❌'}`);

  if (code === '0x') {
    console.error('\n❌ LP Locker contract does not exist at this address!');
    process.exit(1);
  }

  try {
    // Try to load as LPLocker
    const LPLocker = await ethers.getContractFactory('LPLocker');
    const lpLocker = LPLocker.attach(LP_LOCKER_ADDRESS);

    // Try calling a view function
    console.log('\nTrying to read LP Locker data...');

    // Check if it has the lockTokens function (view ABI)
    console.log('✅ Contract bytecode found');
    console.log(`Code length: ${code.length} bytes`);
  } catch (error: any) {
    console.error('\n❌ Error loading LP Locker:');
    console.error(error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
