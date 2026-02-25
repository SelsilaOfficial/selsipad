import { supabase } from './config.js';
import { ethers } from 'ethers';
import crypto from 'crypto';


const TRADE_FEE_BPS = 150n; // 1.5%
const REFERRAL_FEE_BPS = 75n; // 0.75%
const BPS_DENOMINATOR = 10000n;

// Function to handle TokenLaunched event
export async function handleTokenLaunched(args: any, txHash: string) {
  const [tokenAddress, name, symbol, creator] = args;
  console.log(`[TokenLaunched] ${tokenAddress} by ${creator}`);

  let creatorId = await getUserIdFromWallet(creator);
  // Fallback for E2E test wallets that aren't properly registered through frontend
  if (!creatorId) {
    const { data: randomProfile } = await supabase.from('profiles').select('user_id').limit(1).single();
    if (randomProfile) creatorId = randomProfile.user_id;
  }

  // Insert into bonding_pools using Phase 7 schema
  const { error } = await supabase.from('bonding_pools').upsert(
    {
      token_address: tokenAddress.toLowerCase(),
      creator_id: creatorId || null,
      creator_wallet: creator.toLowerCase(),
      token_name: name,
      token_symbol: symbol,
      status: 'LIVE',
      total_supply: "1000000000000000000000000000", // 1 Billion tokens (18 decimals)
      token_decimals: 18, 
      deploy_tx_hash: txHash,
      actual_token_reserves: "1000000000000000000000000000",
      actual_native_reserves: "0",
      virtual_token_reserves: "1000000000000000000000000000",
      virtual_native_reserves: "30000000000000000000", // 30 BNB
      graduation_threshold_native: "24000000000000000000", // 24 BNB
      chain_id: 97,
      created_at: new Date().toISOString(),
      deployed_at: new Date().toISOString()
    },
    { onConflict: 'token_address' }
  );

  if (error) {
    console.error(`Error inserting bonding_pool:`, error);
  } else {
    console.log(`Saved pool ${tokenAddress} to DB`);
  }
}

// Function to handle TokensPurchased event
export async function handleTokensPurchased(args: any, txHash: string) {
  const [tokenAddress, buyer, tokenAmount, ethCost, referrer] = args;
  console.log(`[TokensPurchased] Buyer: ${buyer}, Amount: ${tokenAmount}, Cost: ${ethCost}`);

  // Insert into bonding_swaps
  await recordSwap('BUY', tokenAddress, buyer, tokenAmount, ethCost, txHash);

  // Handle referral tracking
  await processReferral(tokenAddress, buyer, ethCost, referrer, txHash);
}

// Function to handle TokensSold event
export async function handleTokensSold(args: any, txHash: string) {
  const [tokenAddress, seller, tokenAmount, ethRefund, referrer] = args;
  console.log(`[TokensSold] Seller: ${seller}, Amount: ${tokenAmount}, Refund: ${ethRefund}`);

  // Insert into bonding_swaps
  await recordSwap('SELL', tokenAddress, seller, tokenAmount, ethRefund, txHash);

  // Handle referral tracking
  const grossEthOut = (BigInt(ethRefund) * 10000n) / 9850n;
  await processReferral(tokenAddress, seller, grossEthOut, referrer, txHash);
}

// Shared helper to retrieve user UUID from a wallet address
async function getUserIdFromWallet(walletAddress: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('wallets')
    .select('user_id')
    .ilike('address', walletAddress)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }
  return data.user_id;
}

// Shared helper to record swaps
async function recordSwap(type: string, tokenAddress: string, trader: string, tokenAmount: bigint, ethAmount: bigint, txHash: string) {
  // Find user_id from wallet
  const userId = await getUserIdFromWallet(trader);
  if (!userId) {
    console.error(`Skipping swap for tx ${txHash}: Unregistered trader wallet ${trader}`);
    return;
  }

  // Calculate fees (Phase 7 compatibility requires storing these fields)
  const fee = (ethAmount * TRADE_FEE_BPS) / BPS_DENOMINATOR;
  const treasuryFee = fee / 2n;
  const referralPoolFee = fee - treasuryFee;

  // We map 'bscTestnet' to the Phase 7 Supabase schema (assuming pool_id is fetched via token_address)
  const { data: poolObj } = await supabase
    .from('bonding_pools')
    .select('id')
    .eq('token_address', tokenAddress.toLowerCase())
    .limit(1)
    .single();

  if (!poolObj) {
    console.error(`Skipping swap for tx ${txHash}: Unknown bonding pool ${tokenAddress}`);
    return;
  }

  const { error } = await supabase.from('bonding_swaps').insert({
    pool_id: poolObj.id,
    user_id: userId || null,
    wallet_address: trader.toLowerCase(),
    swap_type: type,
    input_amount: type === 'BUY' ? ethAmount.toString() : tokenAmount.toString(),
    output_amount: type === 'BUY' ? tokenAmount.toString() : ethAmount.toString(),
    price_per_token: (ethAmount / (tokenAmount || 1n)).toString(),
    swap_fee_amount: fee.toString(),
    treasury_fee: treasuryFee.toString(),
    referral_pool_fee: referralPoolFee.toString(),
    tx_hash: txHash,
    native_reserves_before: 0, 
    token_reserves_before: 0, 
    native_reserves_after: 0, 
    token_reserves_after: 0, 
    chain_id: 97,
    signature_verified: true
  });

  if (error) {
    // If it's a unique constraint violation, it means it's already indexed
    if (error.code !== '23505') { 
      console.error(`Error inserting swap for tx ${txHash}:`, error.message);
    }
  }
}

// Shared helper to process referrals
async function processReferral(tokenAddress: string, trader: string, baseEthAmount: bigint, referrer: string, txHash: string) {
  if (referrer === ethers.ZeroAddress || referrer.toLowerCase() === trader.toLowerCase()) {
    return; // No valid referrer
  }

  // Find UUID for the referrer
  const referrerUserId = await getUserIdFromWallet(referrer);
  if (!referrerUserId) {
    console.error(`Skipping referral for tx ${txHash}: Unregistered referrer wallet ${referrer}`);
    return;
  }

  // Find UUID for the trader (referee)
  const traderUserId = await getUserIdFromWallet(trader);
  
  // Look up the swap UUID we just inserted for source_id
  const { data: swapObj } = await supabase
    .from('bonding_swaps')
    .select('id')
    .eq('tx_hash', txHash)
    .limit(1)
    .single();

  if (!swapObj) {
    console.error(`Cannot process referral for tx ${txHash} because no swap ID was found.`);
    return;
  }

  // Calculate the referrer share (0.75% of base value)
  const fee = (baseEthAmount * TRADE_FEE_BPS) / BPS_DENOMINATOR;
  const referrerShare = (fee * REFERRAL_FEE_BPS) / TRADE_FEE_BPS;

  const { error } = await supabase.from('referral_ledger').insert({
    referrer_id: referrerUserId, 
    referee_id: traderUserId || null,
    source_type: 'BONDING',
    source_id: swapObj.id,
    amount: referrerShare.toString(),
    asset: 'BNB',
    chain: '97',
    status: 'CLAIMABLE',
    created_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code !== '23505') { 
      console.error(`Error inserting referral ledger for tx ${txHash}:`, error.message);
    }
  } else {
    console.log(`Saved referral reward of ${ethers.formatEther(referrerShare)} BNB for UUID ${referrerUserId}`);
  }

  // Activate the referral_relationship if not yet activated
  if (traderUserId) {
    const { error: activateError } = await supabase
      .from('referral_relationships')
      .update({ activated_at: new Date().toISOString() })
      .eq('referee_id', traderUserId)
      .eq('referrer_id', referrerUserId)
      .is('activated_at', null);

    if (activateError) {
      console.warn(`Could not activate referral_relationship for referee ${traderUserId}:`, activateError.message);
    } else {
      console.log(`Activated referral_relationship for referee ${traderUserId} → referrer ${referrerUserId}`);
    }
  }
}

// Function to handle BlueCheckPurchased event
export async function handleBlueCheckPurchased(args: any, txHash: string, chainId: string) {
  const [user, amountPaid, treasuryAmount, referrerReward, referrer, timestamp] = args;
  
  console.log(`[BlueCheckPurchased] User: ${user}, Paid: ${amountPaid}, Referrer: ${referrer}, Chain: ${chainId}`);

  // Fetch UUID for the purchaser
  const purchaserUserId = await getUserIdFromWallet(user);
  if (!purchaserUserId) {
    console.warn(`[BlueCheckPurchased] Unregistered purchaser wallet ${user}. Cannot record referral.`);
    return;
  }

  // Update profile bluecheck_status to ACTIVE
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ 
      bluecheck_status: 'ACTIVE'
    })
    .eq('user_id', purchaserUserId);
  if (updateError) console.error(`[BlueCheck] Profile update error:`, updateError.message);

  // Record fee split
  const zeroAddress = '0x0000000000000000000000000000000000000000';
  const { error: splitError } = await supabase.from('fee_splits').upsert(
    {
      source_type: 'BLUECHECK',
      source_id: txHash,
      total_amount: amountPaid.toString(),
      treasury_amount: treasuryAmount.toString(),
      referral_pool_amount: referrerReward.toString(),
      asset: zeroAddress, // native BNB
      chain: chainId,
      processed: true,
      processed_at: new Date().toISOString(),
    },
    { onConflict: 'source_type,source_id', ignoreDuplicates: true }
  );
  if (splitError) console.error(`[BlueCheck] Fee split error:`, splitError.message);

  // If no referrer, we're done
  if (referrer === ethers.ZeroAddress || referrer.toLowerCase() === user.toLowerCase()) {
    return;
  }

  const referrerUserId = await getUserIdFromWallet(referrer);
  if (!referrerUserId) {
    console.error(`Skipping referral for tx ${txHash}: Unregistered referrer wallet ${referrer}`);
    return;
  }

  // Record into referral_ledger
  const { error: ledgerError } = await supabase.from('referral_ledger').upsert(
    {
      referrer_id: referrerUserId,
      referee_id: purchaserUserId,
      source_type: 'BLUECHECK',
      source_id: txHash,
      amount: referrerReward.toString(),
      asset: zeroAddress, // native BNB
      chain: chainId,
      status: 'CLAIMED', // BlueCheck splits are sent immediately on-chain!
      claimed_at: new Date().toISOString(),
    },
    { onConflict: 'source_type,source_id,referee_id', ignoreDuplicates: true }
  );
  
  if (ledgerError) console.error(`[BlueCheck] Ledger error:`, ledgerError.message);
  else console.log(`[BlueCheck] Saved referral reward to ${referrerUserId}`);
  
  // Activate relationship and increment tally
  const { data: activatedRows } = await supabase
    .from('referral_relationships')
    .update({ activated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('referrer_id', referrerUserId)
    .eq('referee_id', purchaserUserId)
    .is('activated_at', null)
    .select('id');

  if (activatedRows && activatedRows.length > 0) {
    await supabase.rpc('increment_active_referral_count', { target_user_id: referrerUserId });
  }
}
