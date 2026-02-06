require('@nomicfoundation/hardhat-toolbox');
require('@nomicfoundation/hardhat-verify');
require('dotenv').config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const ADMIN_DEPLOYER_PRIVATE_KEY = process.env.ADMIN_DEPLOYER_PRIVATE_KEY;

function getValidAccounts(...keys) {
  return keys.filter(key => key && key !== '').map(key => key.startsWith('0x') ? key : `0x${key}`);
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
      // Required for forking BSC testnet reliably (chainId 97 has no built-in hardfork history here)
      hardfork: 'shanghai',
      chains: {
        // Minimal override: treat all blocks as shanghai for chainId 97
        97: {
          hardforkHistory: {
            shanghai: 0,
          },
        },
      },
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || '',
      accounts: getValidAccounts(DEPLOYER_PRIVATE_KEY, ADMIN_DEPLOYER_PRIVATE_KEY),
      chainId: 11155111,
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
      accounts: getValidAccounts(DEPLOYER_PRIVATE_KEY, ADMIN_DEPLOYER_PRIVATE_KEY),
      chainId: 97,
      gasPrice: 10000000000, // 10 gwei
    },
    base_sepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
      accounts: getValidAccounts(DEPLOYER_PRIVATE_KEY, ADMIN_DEPLOYER_PRIVATE_KEY),
      chainId: 84532,
    },
    base: {
      url: process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org',
      accounts: getValidAccounts(DEPLOYER_PRIVATE_KEY, ADMIN_DEPLOYER_PRIVATE_KEY),
      chainId: 8453,
    },
    bsc: {
      url: process.env.BSC_MAINNET_RPC_URL || 'https://bsc-dataseed1.binance.org',
      accounts: getValidAccounts(DEPLOYER_PRIVATE_KEY, ADMIN_DEPLOYER_PRIVATE_KEY),
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
