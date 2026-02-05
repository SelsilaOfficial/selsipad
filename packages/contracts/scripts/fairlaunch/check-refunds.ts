/**
 * Check refund status for all contributors
 * Lists who has and hasn't claimed refunds yet
 */

import { ethers } from 'hardhat';

async function main() {
  const FAIRLAUNCH_ADDRESS = '0x612f1d8D7184EdcD7a017E5990B477498BCfbB0f';

  console.log('\n📊 Checking Refund Status');
  console.log('=====================================');
  console.log(`Contract: ${FAIRLAUNCH_ADDRESS}`);

  // Load contract
  const Fairlaunch = await ethers.getContractFactory('Fairlaunch');
  const fairlaunch = Fairlaunch.attach(FAIRLAUNCH_ADDRESS);

  try {
    // Check status
    const status = await fairlaunch.status();
    const statusNames = ['UPCOMING', 'LIVE', 'ENDED', 'SUCCESS', 'FAILED', 'CANCELLED'];
    console.log(`\nStatus: ${statusNames[status]} (${status})`);

    if (status !== 5 && status !== 4) {
      console.log('\n⚠️  Refunds not available - status must be FAILED or CANCELLED');
      return;
    }

    // Get contract balance
    const contractBalance = await ethers.provider.getBalance(FAIRLAUNCH_ADDRESS);
    const totalRaised = await fairlaunch.totalRaised();
    const participantCount = await fairlaunch.participantCount();

    console.log(`\n💰 Totals:`);
    console.log(`Total Raised: ${ethers.formatEther(totalRaised)} BNB`);
    console.log(`Current Contract Balance: ${ethers.formatEther(contractBalance)} BNB`);
    console.log(`Participants: ${participantCount}`);
    console.log(`Remaining to Refund: ${ethers.formatEther(contractBalance)} BNB`);

    // Known contributors (from database/events - hardcoded for now)
    const knownContributors = [
      '0xAe6655E1c047a5860Edd643897D313edAA2b9f41', // Buyer 1
      '0x95D94D86CfC550897d2b80672a3c94c12429a90D', // Buyer 2 (or admin test)
      '0x178cf582e811b30205cbf4bb7be45a9df31aac4a', // Buyer 3 (if exists)
    ];

    console.log(`\n📋 Contributor Refund Status:`);

    let totalRefunded = BigInt(0);
    let refundCount = 0;

    for (const address of knownContributors) {
      try {
        const contribution = await fairlaunch.contributions(address);

        if (contribution > 0) {
          console.log(`\n${address}:`);
          console.log(`  Contribution: ${ethers.formatEther(contribution)} BNB`);
          console.log(`  Refund Status: ⏳ PENDING - needs to call refund()`);
        } else {
          refundCount++;
          console.log(`\n${address}: ✅ Already refunded or never contributed`);
        }
      } catch (e) {
        console.log(`\n${address}: ❓ Could not check`);
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`Refunded: ${refundCount} / ${participantCount}`);
    console.log(`Pending: ${Number(participantCount) - refundCount} contributors`);

    if (contractBalance === BigInt(0)) {
      console.log(`\n✅ All refunds completed! Safe to redeploy.`);
    } else {
      console.log(`\n⏳ Waiting for ${ethers.formatEther(contractBalance)} BNB to be refunded`);
      console.log(`\n📝 Contributors need to call refund() to get their BNB back`);
    }
  } catch (error: any) {
    console.error('\n❌ Error:');
    console.error(error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
