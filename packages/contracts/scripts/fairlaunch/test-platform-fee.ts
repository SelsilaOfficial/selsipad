/**
 * Test platform fee calculation
 */

import { ethers } from 'hardhat';

async function main() {
  const FAIRLAUNCH_ADDRESS = '0xD8f2728fc23f008A89e203547e563A7F7DB0A3Dc';

  console.log('\n💰 Platform Fee Calculation Test\n');

  const fairlaunch = await ethers.getContractAt('Fairlaunch', FAIRLAUNCH_ADDRESS);

  const totalRaised = await fairlaunch.totalRaised();
  const PLATFORM_FEE_BPS = 500; // 5%
  const BPS_BASE = 10000;

  const платformFee = (totalRaised * BigInt(PLATFORM_FEE_BPS)) / BigInt(BPS_BASE);

  console.log(`Total Raised: ${ethers.formatEther(totalRaised)} BNB`);
  console.log(`Platform Fee (5%): ${ethers.formatEther(платformFee)} BNB`);
  console.log(`Platform Fee Wei: ${платformFee.toString()}`);
  console.log(`Is Zero?: ${платformFee === BigInt(0) ? 'YES ❌' : 'NO ✅'}`);

  // Check contract constants
  try {
    const contractFeeBps = await fairlaunch.PLATFORM_FEE_BPS();
    const contractBpsBase = 10000; // Standard constant

    console.log(`\nContract PLATFORM_FEE_BPS: ${contractFeeBps}`);

    const actualFee = (totalRaised * contractFeeBps) / BigInt(contractBpsBase);
    console.log(`Actual fee from contract: ${ethers.formatEther(actualFee)} BNB`);
  } catch (e: any) {
    console.error(`Error reading contract fee: ${e.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
