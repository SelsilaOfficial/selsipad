const { ethers } = require('hardhat');

// Extract addresses from private keys in .env
async function main() {
  console.log('🔧 Converting private keys to addresses...\n');

  const treasuryKey = '0x4840164d7ff5673c8263a68072ad26a188479c636b85caa31d7c2b9205daf92c';
  const referralKey = '0x9b91827dafa9a88991a968b572f581515d8e65bb6f613ab98ea45f08ce291ae8';
  const sbtKey = '0x22f5e433d7768d1d16e36c7909d56c0ba437c15fdb4130ba49ad7d424f48dc9b';

  const treasuryWallet = new ethers.Wallet(treasuryKey);
  const referralWallet = new ethers.Wallet(referralKey);
  const sbtWallet = new ethers.Wallet(sbtKey);

  console.log('✅ Vault Addresses:');
  console.log(`TREASURY_VAULT_ADDRESS=${treasuryWallet.address}`);
  console.log(`REFERRAL_POOL_VAULT_ADDRESS=${referralWallet.address}`);
  console.log(`SBT_STAKING_VAULT_ADDRESS=${sbtWallet.address}`);
  console.log('\n📋 Copy these to your .env file!');
}

main().catch(console.error);
