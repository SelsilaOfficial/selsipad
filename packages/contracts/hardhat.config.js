require('@nomicfoundation/hardhat-toolbox');
require('@nomicfoundation/hardhat-verify');
require('dotenv').config();

const DEPLOYER_PRIVATE_KEY =
  process.env.DEPLOYER_PRIVATE_KEY ||
  '0x0000000000000000000000000000000000000000000000000000000000000000';
const ADMIN_PRIVATE_KEY =
  process.env.ADMIN_PRIVATE_KEY ||
  '0x0000000000000000000000000000000000000000000000000000000000000000';

// Filter valid keys only (must be 0x + 64 hex chars)
function getValidAccounts(...keys) {
  return keys.filter((k) => k && k.length === 66 && k.startsWith('0x'));
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Enable IR-based compilation to avoid stack too deep
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || '',
      accounts: getValidAccounts(DEPLOYER_PRIVATE_KEY, ADMIN_PRIVATE_KEY),
      chainId: 11155111,
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
      accounts: getValidAccounts(DEPLOYER_PRIVATE_KEY, ADMIN_PRIVATE_KEY),
      chainId: 97,
      gasPrice: 10000000000, // 10 gwei
    },
    base_sepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
      accounts: getValidAccounts(DEPLOYER_PRIVATE_KEY, ADMIN_PRIVATE_KEY),
      chainId: 84532,
    },
    base: {
      url: process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org',
      accounts: getValidAccounts(DEPLOYER_PRIVATE_KEY, ADMIN_PRIVATE_KEY),
      chainId: 8453,
    },
    bsc: {
      url: process.env.BSC_MAINNET_RPC_URL || 'https://bsc-dataseed1.binance.org',
      accounts: getValidAccounts(DEPLOYER_PRIVATE_KEY, ADMIN_PRIVATE_KEY),
      chainId: 56,
    },
  },
  etherscan: {
    // Use V2 API format with single API key
    apiKey: process.env.BSCSCAN_API_KEY || '',
  },
  sourcify: {
    enabled: false,
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
};
