import { supabase } from './config.js';
import { ethers } from 'ethers';

const TRADE_FEE_BPS = 150n; // 1.5%
const REFERRAL_FEE_BPS = 75n; // 0.75%
const BPS_DENOMINATOR = 10000n;

// Function to handle TokenLaunched event
export async function handleTokenLaunched(event: ethers.EventLog) {
  const [tokenAddress, name, symbol, creator] = event.args;
  console.log(`[TokenLaunched] ${tokenAddress} by ${creator}`);

  // Insert into bonding_pools
  const { error } = await supabase.from('bonding_pools').upsert(
    {
      pool_address: tokenAddress.toLowerCase(),
      creator_address: creator.toLowerCase(),
      name: name,
      symbol: symbol,
      status: 'TRADING',
      chain: 'bscTestnet', // For demo purposes
      created_at: new Date().toISOString(),
    },
    { onConflict: 'pool_address' }
  );

  if (error) {
    console.error(`Error inserting bonding_pool:`, error);
  } else {
    console.log(`Saved pool ${tokenAddress} to DB`);
  }
}

// Function to handle TokensPurchased event
export async function handleTokensPurchased(event: ethers.EventLog) {
  const [tokenAddress, buyer, tokenAmount, ethCost, referrer] = event.args;
  console.log(`[TokensPurchased] Buyer: ${buyer}, Amount: ${tokenAmount}, Cost: ${ethCost}`);

  // Insert into bonding_swaps
  await recordSwap('BUY', tokenAddress, buyer, tokenAmount, ethCost, event);

  // Handle referral tracking
  await processReferral(tokenAddress, buyer, ethCost, referrer, event);
}

// Function to handle TokensSold event
export async function handleTokensSold(event: ethers.EventLog) {
  const [tokenAddress, seller, tokenAmount, ethRefund, referrer] = event.args;
  console.log(`[TokensSold] Seller: ${seller}, Amount: ${tokenAmount}, Refund: ${ethRefund}`);

  // Insert into bonding_swaps
  await recordSwap('SELL', tokenAddress, seller, tokenAmount, ethRefund, event);

  // Handle referral tracking (fees are calculated on the gross amount before deductions usually, 
  // but using the net amount passed or roughly calculating)
  // For simplicity using ethRefund as base, but it depends on exact contract math 
  // From our contract, ethRefund = grossEthOut - fee. grossEthOut = ethRefund / (1 - 0.015).
  // grossEthOut * 10000 = ethRefund * 10000 / 9850;
  const grossEthOut = (BigInt(ethRefund) * 10000n) / 9850n;
  await processReferral(tokenAddress, seller, grossEthOut, referrer, event);
}

// Shared helper to record swaps
async function recordSwap(type: string, tokenAddress: string, trader: string, tokenAmount: bigint, ethAmount: bigint, event: ethers.EventLog) {
  const txHash = event.transactionHash;

  const { error } = await supabase.from('bonding_swaps').insert({
    pool_address: tokenAddress.toLowerCase(),
    trader_address: trader.toLowerCase(),
    type: type,
    token_amount: tokenAmount.toString(),
    eth_amount: ethAmount.toString(),
    tx_hash: txHash,
    chain: 'bscTestnet',
  });

  if (error) {
    console.error(`Error inserting swap for tx ${txHash}:`, error.message);
  }
}

// Shared helper to process referrals
async function processReferral(tokenAddress: string, trader: string, baseEthAmount: bigint, referrer: string, event: ethers.EventLog) {
  if (referrer === ethers.ZeroAddress || referrer.toLowerCase() === trader.toLowerCase()) {
    return; // No valid referrer
  }

  // Calculate the referrer share (0.75% of base value)
  const fee = (baseEthAmount * TRADE_FEE_BPS) / BPS_DENOMINATOR;
  const referrerShare = (fee * REFERRAL_FEE_BPS) / TRADE_FEE_BPS;

  const txHash = event.transactionHash;
  // Unique source ID to prevent duplicates (txhash + logIndex)
  const sourceId = `${txHash}-${event.index}`;

  const { error } = await supabase.from('referral_ledger').insert({
    referrer_address: 'bsc:' + referrer.toLowerCase(), // Prefix with chain to match existing pattern if needed
    amount: referrerShare.toString(),
    status: 'CLAIMABLE',
    source_type: 'BONDING_CURVE',
    source_id: sourceId,
    chain_name: 'bsc',
    asset_id: 'BNB',
    created_at: new Date().toISOString(),
  });

  if (error) {
    // Note: If error is uniqueness constraint, it means we already processed this event log
    if (error.code !== '23505') { 
      console.error(`Error inserting referral ledger for tx ${txHash}:`, error.message);
    }
  } else {
    console.log(`Saved referral reward of ${ethers.formatEther(referrerShare)} BNB for ${referrer}`);
  }
}
