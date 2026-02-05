/**
 * Cancel old LAMPUNG Fairlaunch contract
 * Enables refunds for all contributors
 */

import { ethers } from 'hardhat';

async function main() {
  const FAIRLAUNCH_ADDRESS = '0x612f1d8D7184EdcD7a017E5990B477498BCfbB0f';

  console.log('\n🔴 Cancelling Fairlaunch Contract');
  console.log('=====================================');
  console.log(`Contract: ${FAIRLAUNCH_ADDRESS}`);

  // Get signer (admin wallet)
  const [admin] = await ethers.getSigners();
  console.log(`\nAdmin: ${admin.address}`);
  console.log(
    `Balance: ${ethers.formatEther(await ethers.provider.getBalance(admin.address))} BNB`
  );

  // Load contract
  const Fairlaunch = await ethers.getContractFactory('Fairlaunch');
  const fairlaunch = Fairlaunch.attach(FAIRLAUNCH_ADDRESS);

  try {
    // Check current status
    const currentStatus = await fairlaunch.status();
    const statusNames = ['UPCOMING', 'LIVE', 'ENDED', 'SUCCESS', 'FAILED', 'CANCELLED'];
    console.log(`\nCurrent Status: ${statusNames[currentStatus]} (${currentStatus})`);

    if (currentStatus === 5) {
      console.log('\n✅ Contract already cancelled!');
      return;
    }

    if (currentStatus === 3) {
      console.log('\n❌ Cannot cancel - already SUCCESS!');
      return;
    }

    // Get contribution info before cancelling
    const totalRaised = await fairlaunch.totalRaised();
    const participantCount = await fairlaunch.participantCount();

    console.log(`\n📊 Current State:`);
    console.log(`Total Raised: ${ethers.formatEther(totalRaised)} BNB`);
    console.log(`Participants: ${participantCount}`);

    // Confirm cancellation
    console.log(`\n⚠️  About to CANCEL fairlaunch!`);
    console.log(`This will enable refunds for all contributors.`);

    // Call cancel()
    console.log('\n🔄 Calling cancel()...');
    const tx = await fairlaunch.cancel();
    console.log(`Transaction sent: ${tx.hash}`);

    console.log('⏳ Waiting for confirmation...');
    const receipt = await tx.wait();

    console.log('\n✅ Cancellation Successful!');
    console.log('=====================================');
    console.log(`Gas used: ${receipt!.gasUsed.toString()}`);
    console.log(`Block: ${receipt!.blockNumber}`);
    console.log(`Tx: https://testnet.bscscan.com/tx/${receipt!.hash}`);

    // Verify new status
    const newStatus = await fairlaunch.status();
    console.log(`\nNew Status: ${statusNames[newStatus]} (${newStatus})`);

    if (newStatus === 5) {
      console.log('\n✅ Status confirmed as CANCELLED');
      console.log('\n📝 Next Steps:');
      console.log('1. Contributors can now call refund() to get their BNB back');
      console.log('2. After all refunds, deploy new fairlaunch contract');
    } else {
      console.log('\n⚠️  Warning: Status not CANCELLED!');
    }
  } catch (error: any) {
    console.error('\n❌ Cancellation Failed!');
    console.error(error.message);

    if (error.reason) {
      console.error(`Reason: ${error.reason}`);
    }

    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
