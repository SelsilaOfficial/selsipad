/**
 * Debug setLPLocker revert with static call
 */

import { ethers } from 'hardhat';

async function main() {
  const FAIRLAUNCH_ADDRESS = '0x612f1d8D7184EdcD7a017E5990B477498BCfbB0f';
  const LP_LOCKER_ADDRESS = '0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F';

  console.log('\n🐛 Debug setLPLocker Revert');
  console.log('=====================================');
  console.log(`Fairlaunch: ${FAIRLAUNCH_ADDRESS}`);
  console.log(`LP Locker: ${LP_LOCKER_ADDRESS}`);

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`\nSigner: ${signer.address}`);

  // Load contract
  const Fairlaunch = await ethers.getContractFactory('Fairlaunch');
  const fairlaunch = Fairlaunch.attach(FAIRLAUNCH_ADDRESS);

  try {
    console.log('\n🔍 Attempting static call first...');

    // Try static call to see the revert reason
    await fairlaunch.setLPLocker.staticCall(LP_LOCKER_ADDRESS);

    console.log('✅ Static call succeeded! Transaction should work.');

    console.log('\n🔄 Sending actual transaction...');
    const tx = await fairlaunch.setLPLocker(LP_LOCKER_ADDRESS);
    console.log(`Transaction sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log('\n✅ Success!');
    console.log(`Block: ${receipt!.blockNumber}`);
  } catch (error: any) {
    console.error('\n❌ Failed!');
    console.error(`Message: ${error.message}`);

    if (error.reason) {
      console.error(`Reason: ${error.reason}`);
    }

    if (error.data) {
      console.error(`Data: ${error.data}`);

      // Try to decode error
      try {
        const iface = fairlaunch.interface;
        const decodedError = iface.parseError(error.data);
        console.error(`Decoded Error: ${decodedError?.name}`);
      } catch (e) {
        console.error('Could not decode error');
      }
    }

    if (error.code) {
      console.error(`Error Code: ${error.code}`);
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
