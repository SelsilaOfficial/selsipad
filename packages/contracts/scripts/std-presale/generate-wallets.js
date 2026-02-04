const { ethers } = require('hardhat');
const fs = require('fs');

/**
 * Generate fresh wallets for deployment
 * SECURITY: Save these keys securely and NEVER commit to git!
 */
async function main() {
  console.log('🔐 Generating Fresh Deployment Wallets...\n');

  // Generate deployer wallet
  const deployerWallet = ethers.Wallet.createRandom();
  console.log('1️⃣  DEPLOYER WALLET');
  console.log('   Address:', deployerWallet.address);
  console.log('   Private Key:', deployerWallet.privateKey);
  console.log('   ⚠️  Fund this address with gas tokens!\n');

  // Generate admin wallet
  const adminWallet = ethers.Wallet.createRandom();
  console.log('2️⃣  ADMIN WALLET');
  console.log('   Address:', adminWallet.address);
  console.log('   Private Key:', adminWallet.privateKey);
  console.log('   ℹ️  Gets DEFAULT_ADMIN_ROLE on contracts\n');

  // Generate timelock wallet (or use multisig address)
  const timelockWallet = ethers.Wallet.createRandom();
  console.log('3️⃣  TIMELOCK WALLET');
  console.log('   Address:', timelockWallet.address);
  console.log('   Private Key:', timelockWallet.privateKey);
  console.log('   🔒 Production: Replace with Gnosis Safe multisig!\n');

  // Generate vault addresses
  const treasuryWallet = ethers.Wallet.createRandom();
  const referralWallet = ethers.Wallet.createRandom();
  const sbtWallet = ethers.Wallet.createRandom();

  console.log('4️⃣  FEE VAULT ADDRESSES');
  console.log('   Treasury:', treasuryWallet.address);
  console.log('   Referral Pool:', referralWallet.address);
  console.log('   SBT Staking:', sbtWallet.address);
  console.log('');

  // Create .env template
  const envContent = `# ===========================================
# GENERATED DEPLOYMENT CONFIGURATION
# Generated: ${new Date().toISOString()}
# ===========================================
# ⚠️  CRITICAL: NEVER COMMIT THIS FILE TO GIT!

# ===========================================
# NETWORK RPC ENDPOINTS
# ===========================================
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545

# ===========================================
# WALLET PRIVATE KEYS
# ===========================================
DEPLOYER_PRIVATE_KEY=${deployerWallet.privateKey}
ADMIN_PRIVATE_KEY=${adminWallet.privateKey}
TIMELOCK_ADDRESS=${timelockWallet.address}

# ===========================================
# ETHERSCAN/BSCSCAN API KEYS
# ===========================================
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
BSCSCAN_API_KEY=YOUR_BSCSCAN_API_KEY

# ===========================================
# FEE CONFIGURATION (Total: 5%)
# ===========================================
FEE_TOTAL_BPS=500
FEE_TREASURY_BPS=250
FEE_REFERRAL_POOL_BPS=200
FEE_SBT_STAKING_BPS=50

# ===========================================
# FEE VAULT ADDRESSES
# ===========================================
TREASURY_VAULT_ADDRESS=${treasuryWallet.address}
REFERRAL_POOL_VAULT_ADDRESS=${referralWallet.address}
SBT_STAKING_VAULT_ADDRESS=${sbtWallet.address}

# ===========================================
# DEPLOYMENT OPTIONS
# ===========================================
VERIFY_CONTRACTS=true
CONFIRMATIONS=5
DEPLOYMENT_DELAY_MS=3000
DEBUG_MODE=true
SAVE_DEPLOYMENT_JSON=true
DEPLOYMENT_OUTPUT_DIR=./deployments
GAS_LIMIT_MULTIPLIER=1.2
`;

  // Save to .env.generated (user should review and rename to .env)
  const envPath = '.env.generated';
  fs.writeFileSync(envPath, envContent);

  console.log('✅ Configuration saved to:', envPath);
  console.log('');
  console.log('📋 NEXT STEPS:');
  console.log('1. Review the generated configuration');
  console.log('2. Add your Alchemy/Infura RPC URLs');
  console.log('3. Add Etherscan/BSCScan API keys (for verification)');
  console.log('4. Rename to .env: mv .env.generated .env');
  console.log('5. Fund deployer address with gas tokens:');
  console.log(`   - Sepolia: ${deployerWallet.address}`);
  console.log(`   - BSC Testnet: ${deployerWallet.address}`);
  console.log('');
  console.log('🔗 Faucets:');
  console.log('   - Sepolia ETH: https://sepoliafaucet.com');
  console.log('   - BSC Testnet BNB: https://testnet.binance.org/faucet-smart');
  console.log('');
  console.log('⚠️  SECURITY WARNING:');
  console.log('   - NEVER share your private keys');
  console.log('   - NEVER commit .env to git');
  console.log('   - For production, use hardware wallet or multisig');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
