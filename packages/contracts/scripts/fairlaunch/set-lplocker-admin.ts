/**
 * Set LP Locker using admin wallet
 * Uses DEFAULT_ADMIN_PRIVATE_KEY from .env
 */

import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const FAIRLAUNCH_ADDRESS = '0x612f1d8D7184EdcD7a017E5990B477498BCfbB0f';
  const LP_LOCKER_ADDRESS = '0x905A81F09c8ED76e71e82933f9b4978E41ac1b9F';
  const ADMIN_KEY = process.env.DEFAULT_ADMIN_PRIVATE_KEY!;

  console.log('\n🔧 Setting LP Locker (Admin Wallet)');
  console.log('=====================================');
  console.log(`Fairlaunch: ${FAIRLAUNCH_ADDRESS}`);
  console.log(`LP Locker: ${LP_LOCKER_ADDRESS}`);

  // Create wallet from admin private key
  const provider = ethers.provider;
  const adminWallet = new ethers.Wallet(ADMIN_KEY, provider);
  console.log(`\nAdmin Wallet: ${adminWallet.address}`);
  console.log(`Balance: ${ethers.formatEther(await provider.getBalance(adminWallet.address))} BNB`);

  // Load contract with admin wallet
  const Fairlaunch = await ethers.getContractFactory('Fairlaunch', adminWallet);
  const fairlaunch = Fairlaunch.attach(FAIRLAUNCH_ADDRESS);

  try {
    //  Check current LP Locker
    const currentLocker = await fairlaunch.lpLocker();
    console.log(`\nCurrent LP Locker: ${currentLocker}`);

    if (currentLocker !== ethers.ZeroAddress) {
      console.log('✅ LP Locker already set!');
      return;
    }

    console.log('\n🔄 Calling setLPLocker()...');
    const tx = await fairlaunch.setLPLocker(LP_LOCKER_ADDRESS);
    console.log(`Transaction sent: ${tx.hash}`);

    console.log('⏳ Waiting for confirmation...');
    const receipt = await tx.wait();

    console.log('\n✅ LP Locker Set Successfully!');
    console.log('=====================================');
    console.log(`Gas used: ${receipt!.gasUsed.toString()}`);
    console.log(`Block: ${receipt!.blockNumber}`);
    console.log(`Tx: https://testnet.bscscan.com/tx/${receipt!.hash}`);

    // Verify
    const newLocker = await fairlaunch.lpLocker();
    console.log(`\n Verified LP Locker: ${newLocker}`);
    console.log(`Match?: ${newLocker === LP_LOCKER_ADDRESS ? 'YES ✅' : 'NO ❌'}`);
  } catch (error: any) {
    console.error('\n❌ Failed!');
    console.error(error.message);
    if (error.reason) console.error(`Reason: ${error.reason}`);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
