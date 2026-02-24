import { ethers } from 'ethers';
import { provider, FACTORY_ADDRESS } from './config.js';
import { handleTokenLaunched, handleTokensPurchased, handleTokensSold } from './processors.js';

// Minimal ABI for the factory events we care about
const FACTORY_ABI = [
  "event TokenLaunched(address indexed token, string name, string symbol, address indexed creator)",
  "event TokensPurchased(address indexed token, address indexed buyer, uint256 tokenAmount, uint256 ethCost, address indexed referrer)",
  "event TokensSold(address indexed token, address indexed seller, uint256 tokenAmount, uint256 ethRefund, address indexed referrer)"
];

async function main() {
  console.log(`[indexer_evm] Starting listener on ${FACTORY_ADDRESS}...`);

  const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);

  // Listen to TokenLaunched
  factoryContract.on('TokenLaunched', async (token: string, name: string, symbol: string, creator: string, event: ethers.EventLog) => {
    try {
      await handleTokenLaunched(event);
    } catch (err: any) {
      console.error(`Error processing TokenLaunched: ${err.message}`);
    }
  });

  // Listen to TokensPurchased
  factoryContract.on('TokensPurchased', async (token: string, buyer: string, tokenAmount: bigint, ethCost: bigint, referrer: string, event: ethers.EventLog) => {
    try {
      await handleTokensPurchased(event);
    } catch (err: any) {
      console.error(`Error processing TokensPurchased: ${err.message}`);
    }
  });

  // Listen to TokensSold
  factoryContract.on('TokensSold', async (token: string, seller: string, tokenAmount: bigint, ethRefund: bigint, referrer: string, event: ethers.EventLog) => {
    try {
      await handleTokensSold(event);
    } catch (err: any) {
      console.error(`Error processing TokensSold: ${err.message}`);
    }
  });

  console.log('[indexer_evm] Listening for events...');
}

main().catch((error) => {
  console.error('[indexer_evm] Fatal error:', error);
  process.exit(1);
});
