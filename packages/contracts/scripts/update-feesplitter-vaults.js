/**
 * Update FeeSplitter Vault Addresses
 * Using admin private key to update vault addresses
 */

const hre = require('hardhat');

const FEESPLITTER_ADDRESS = '0x2672af17eA89bc5e46BB52385C45Cb42e5eC8C48';
const ADMIN_PRIVATE_KEY = '0x4f1b5464ce6ee389a732bc4accab10608536198800091f9768bf6fc86b7cb326';

// New wallet addresses
const NEW_TREASURY = '0xd7B3C25BA746627120b2386f6867df6573Db9791';
const NEW_REFERRAL_POOL = '0xAa94333C8F74E8fEA5a6FdC21c0f3925E183C37A';
const NEW_SBT_STAKING = '0xC57c15825eA3344E2323f6a66188cA775AEC3160';

async function main() {
  console.log('🔧 Updating FeeSplitter Vault Addresses...\n');

  // Create signer from private key
  const admin = new hre.ethers.Wallet(ADMIN_PRIVATE_KEY, hre.ethers.provider);
  console.log('Admin wallet:', admin.address);
  console.log('Balance:', hre.ethers.formatEther(await hre.ethers.provider.getBalance(admin.address)), 'BNB\n');

  // Load FeeSplitter contract
  const FeeSplitterABI = [
    'function treasuryVault() view returns (address)',
    'function referralPoolVault() view returns (address)',
    'function sbtStakingVault() view returns (address)',
    'function setTreasuryVault(address newVault) external',
    'function setReferralPoolVault(address newVault) external',
    'function setSbtStakingVault(address newVault) external',
  ];

  const feeSplitter = new hre.ethers.Contract(
    FEESPLITTER_ADDRESS,
    FeeSplitterABI,
    admin
  );

  // Check current addresses
  console.log('📋 Current Addresses:');
  console.log('Treasury:', await feeSplitter.treasuryVault());
  console.log('Referral Pool:', await feeSplitter.referralPoolVault());
  console.log('SBT Staking:', await feeSplitter.sbtStakingVault());
  console.log();

  // Update addresses
  console.log('🔄 Updating to new addresses...\n');

  console.log('1/3: Updating Treasury Vault...');
  const tx1 = await feeSplitter.setTreasuryVault(NEW_TREASURY);
  await tx1.wait();
  console.log('✅ Treasury updated. TX:', tx1.hash);

  console.log('\n2/3: Updating Referral Pool Vault...');
  const tx2 = await feeSplitter.setReferralPoolVault(NEW_REFERRAL_POOL);
  await tx2.wait();
  console.log('✅ Referral Pool updated. TX:', tx2.hash);

  console.log('\n3/3: Updating SBT Staking Vault...');
  const tx3 = await feeSplitter.setSbtStakingVault(NEW_SBT_STAKING);
  await tx3.wait();
  console.log('✅ SBT Staking updated. TX:', tx3.hash);

  // Verify new addresses
  console.log('\n✅ All vaults updated successfully!\n');
  console.log('📋 New Addresses:');
  console.log('Treasury:', await feeSplitter.treasuryVault());
  console.log('Referral Pool:', await feeSplitter.referralPoolVault());
  console.log('SBT Staking:', await feeSplitter.sbtStakingVault());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
