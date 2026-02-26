import { ethers } from 'ethers';
import { provider, FACTORY_ADDRESS, BLUECHECK_ADDRESS, mainnetProvider, MAINNET_BLUECHECK_ADDRESS } from './config.js';
import { handleTokenLaunched, handleTokensPurchased, handleTokensSold, handleBlueCheckPurchased, handleLiquidityMigrated } from './processors.js';

// Minimal ABI for the factory events we care about
const FACTORY_ABI = [
  "event TokenLaunched(address indexed token, string name, string symbol, address indexed creator)",
  "event TokensPurchased(address indexed token, address indexed buyer, uint256 tokenAmount, uint256 ethCost, address indexed referrer)",
  "event TokensSold(address indexed token, address indexed seller, uint256 tokenAmount, uint256 ethRefund, address indexed referrer)",
  "event LiquidityMigrated(address indexed token, uint256 tokenAmount, uint256 ethAmount, address pair)"
];

const BLUECHECK_ABI = [
  "event BlueCheckPurchased(address indexed user, uint256 amountPaid, uint256 treasuryAmount, uint256 referrerReward, address indexed referrer, uint256 timestamp)"
];

async function main() {
  console.log(`[indexer_evm] Starting listener on ${FACTORY_ADDRESS}...`);

  const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
  const bluecheckContract = new ethers.Contract(BLUECHECK_ADDRESS, BLUECHECK_ABI, provider);
  const mainnetBluecheckContract = new ethers.Contract(MAINNET_BLUECHECK_ADDRESS, BLUECHECK_ABI, mainnetProvider);

  // Listen to TokenLaunched
  factoryContract.on('TokenLaunched', async (token: string, name: string, symbol: string, creator: string, event: any) => {
    try {
      const txHash = event.log?.transactionHash || event.transactionHash;
      await handleTokenLaunched(event.args, txHash);
    } catch (err: any) {
      console.error(`Error processing TokenLaunched: ${err.message}`);
    }
  });

  // Listen to TokensPurchased
  factoryContract.on('TokensPurchased', async (token: string, buyer: string, tokenAmount: bigint, ethCost: bigint, referrer: string, event: any) => {
    try {
      const txHash = event.log?.transactionHash || event.transactionHash;
      await handleTokensPurchased(event.args, txHash);
    } catch (err: any) {
      console.error(`Error processing TokensPurchased: ${err.message}`);
    }
  });

  // Listen to TokensSold
  factoryContract.on('TokensSold', async (token: string, seller: string, tokenAmount: bigint, ethRefund: bigint, referrer: string, event: any) => {
    try {
      const txHash = event.log?.transactionHash || event.transactionHash;
      await handleTokensSold(event.args, txHash);
    } catch (err: any) {
      console.error(`Error processing TokensSold: ${err.message}`);
    }
  });

  // Listen to LiquidityMigrated (graduation to DEX)
  factoryContract.on('LiquidityMigrated', async (token: string, tokenAmount: bigint, ethAmount: bigint, pair: string, event: any) => {
    try {
      const txHash = event.log?.transactionHash || event.transactionHash;
      await handleLiquidityMigrated(event.args, txHash);
    } catch (err: any) {
      console.error(`Error processing LiquidityMigrated: ${err.message}`);
    }
  });

  // Listen to BlueCheckPurchased on Testnet
  bluecheckContract.on('BlueCheckPurchased', async (user: string, amountPaid: bigint, treasuryAmount: bigint, referrerReward: bigint, referrer: string, timestamp: bigint, event: any) => {
    try {
      const txHash = event.log?.transactionHash || event.transactionHash;
      await handleBlueCheckPurchased(event.args, txHash, '97');
    } catch (err: any) {
      console.error(`Error processing BlueCheckPurchased (Testnet): ${err.message}`);
    }
  });

  // Listen to BlueCheckPurchased on Mainnet
  mainnetBluecheckContract.on('BlueCheckPurchased', async (user: string, amountPaid: bigint, treasuryAmount: bigint, referrerReward: bigint, referrer: string, timestamp: bigint, event: any) => {
    try {
      const txHash = event.log?.transactionHash || event.transactionHash;
      await handleBlueCheckPurchased(event.args, txHash, '56');
    } catch (err: any) {
      console.error(`Error processing BlueCheckPurchased (Mainnet): ${err.message}`);
    }
  });

  console.log('[indexer_evm] Listening for events...');
}

main().catch((error) => {
  console.error('[indexer_evm] Fatal error:', error);
  process.exit(1);
});
