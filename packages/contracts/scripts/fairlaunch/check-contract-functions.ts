/**
 * Check what functions Fairlaunch contract has
 */

import { ethers } from 'hardhat';

async function main() {
  const FAIRLAUNCH_ADDRESS = '0x612f1d8D7184EdcD7a017E5990B477498BCfbB0f';

  console.log('\n🔍 Checking Fairlaunch Contract Functions');
  console.log('=====================================');
  console.log(`Contract: ${FAIRLAUNCH_ADDRESS}`);

  // Load contract
  const Fairlaunch = await ethers.getContractFactory('Fairlaunch');
  const fairlaunch = Fairlaunch.attach(FAIRLAUNCH_ADDRESS);

  console.log('\n🧪 Testing function calls:');

  try {
    // Test basic view functions that should definitely exist
    console.log('\n1. Testing projectToken()...');
    const projectToken = await fairlaunch.projectToken();
    console.log(`   ✅ projectToken: ${projectToken}`);

    console.log('\n2. Testing status()...');
    const status = await fairlaunch.status();
    console.log(`   ✅ status: ${status}`);

    console.log('\n3. Testing isFinalized()...');
    const isFinalized = await fairlaunch.isFinalized();
    console.log(`   ✅ isFinalized: ${isFinalized}`);

    console.log('\n4. Testing lpLocker()...');
    try {
      const lpLocker = await fairlaunch.lpLocker();
      console.log(`   ✅ lpLocker: ${lpLocker}`);
    } catch (e: any) {
      console.log(`   ❌ lpLocker function doesn't exist!`);
      console.log(`   This contract version doesn't have lpLocker!`);
    }

    console.log('\n5. Testing setLPLocker() function selector...');
    const iface = fairlaunch.interface;
    const fragment = iface.getFunction('setLPLocker');
    console.log(`   Function selector: ${fragment?.selector}`);

    // Get contract code and check if selector exists
    const code = await ethers.provider.getCode(FAIRLAUNCH_ADDRESS);
    const selectorExists = code.includes(fragment!.selector.slice(2));
    console.log(`   Selector in bytecode?: ${selectorExists ? 'YES ✅' : 'NO ❌'}`);
  } catch (error: any) {
    console.error('\n❌ Error:');
    console.error(error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
