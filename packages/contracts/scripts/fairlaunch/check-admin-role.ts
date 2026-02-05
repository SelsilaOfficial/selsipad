/**
 * Check admin role on Fairlaunch contract
 */

import { ethers } from 'hardhat';

async function main() {
  const FAIRLAUNCH_ADDRESS = '0x612f1d8D7184EdcD7a017E5990B477498BCfbB0f';

  console.log('\n🔍 Checking Admin Role');
  console.log('=====================================');
  console.log(`Contract: ${FAIRLAUNCH_ADDRESS}`);

  // Load contract
  const Fairlaunch = await ethers.getContractFactory('Fairlaunch');
  const fairlaunch = Fairlaunch.attach(FAIRLAUNCH_ADDRESS);

  // Get role hashes
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
  const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('ADMIN_ROLE'));

  console.log(`\nDEFAULT_ADMIN_ROLE: ${DEFAULT_ADMIN_ROLE}`);
  console.log(`ADMIN_ROLE: ${ADMIN_ROLE}`);

  // Check wallets
  const walletsToCheck = [
    { name: 'DEPLOYER', address: '0x95D94D86CfC550897d2b80672a3c94c12429a90D' },
    { name: 'ADMIN_DEPLOYER', address: '0x178cf582e811b30205cbf4bb7be45a9df31aac4a' },
    { name: 'DEFAULT_ADMIN', address: '0x92222c5248FB6c78c3111AA1076C1eF41F44e394' },
  ];

  console.log('\n✅ Role Check:');
  for (const wallet of walletsToCheck) {
    const hasDefaultAdmin = await fairlaunch.hasRole(DEFAULT_ADMIN_ROLE, wallet.address);
    const hasAdminRole = await fairlaunch.hasRole(ADMIN_ROLE, wallet.address);
    console.log(`\n${wallet.name} (${wallet.address}):`);
    console.log(`  DEFAULT_ADMIN_ROLE: ${hasDefaultAdmin ? '✅' : '❌'}`);
    console.log(`  ADMIN_ROLE: ${hasAdminRole ? '✅' : '❌'}`);
  }

  // Get project owner
  const projectOwner = await fairlaunch.projectOwner();
  console.log(`\n📝 Project Owner: ${projectOwner}`);
  const ownerHasDefaultAdmin = await fairlaunch.hasRole(DEFAULT_ADMIN_ROLE, projectOwner);
  const ownerHasAdminRole = await fairlaunch.hasRole(ADMIN_ROLE, projectOwner);
  console.log(`  DEFAULT_ADMIN_ROLE: ${ownerHasDefaultAdmin ? '✅' : '❌'}`);
  console.log(`  ADMIN_ROLE: ${ownerHasAdminRole ? '✅' : '❌'}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
