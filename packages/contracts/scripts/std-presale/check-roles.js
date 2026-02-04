const hre = require('hardhat');

async function main() {
  const roundAddr = '0x4ACE2f1826aA7c70De67E2855eDd98151A2E9Eb1';
  const round = await hre.ethers.getContractAt('PresaleRound', roundAddr);

  const ADMIN_ROLE = await round.ADMIN_ROLE();
  const DEFAULT_ADMIN_ROLE = await round.DEFAULT_ADMIN_ROLE();

  const signers = await hre.ethers.getSigners();

  console.log('\n🔍 Checking who has ADMIN_ROLE on Round...\n');

  for (let i = 0; i < Math.min(signers.length, 5); i++) {
    const signer = signers[i];
    const hasAdmin = await round.hasRole(ADMIN_ROLE, signer.address);
    const hasDefaultAdmin = await round.hasRole(DEFAULT_ADMIN_ROLE, signer.address);

    console.log(`${i}. ${signer.address}`);
    console.log(`   ADMIN_ROLE: ${hasAdmin ? '✅' : '❌'}`);
    console.log(`   DEFAULT_ADMIN_ROLE: ${hasDefaultAdmin ? '✅' : '❌'}\n`);
  }

  // Check timelock from factory
  const timelockAddr = '0xdce552fa663879e2453f2259ced9f06a0c4a6a2d';
  const hasTimelockAdmin = await round.hasRole(ADMIN_ROLE, timelockAddr);
  const hasTimelockDefault = await round.hasRole(DEFAULT_ADMIN_ROLE, timelockAddr);

  console.log(`Timelock: ${timelockAddr}`);
  console.log(`   ADMIN_ROLE: ${hasTimelockAdmin ? '✅' : '❌'}`);
  console.log(`   DEFAULT_ADMIN_ROLE: ${hasTimelockDefault ? '✅' : '❌'}\n`);
}

main().catch(console.error);
