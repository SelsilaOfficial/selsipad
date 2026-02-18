/**
 * Blue Check Verifier Worker
 *
 * Safety net: scans profiles where bluecheck_status != ACTIVE,
 * checks on-chain hasBlueCheck(), and activates if verified.
 * This catches cases where verify-purchase was missed (e.g. user closed browser).
 */

import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http, type Chain } from 'viem';
import { bscTestnet, bsc } from 'viem/chains';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Per-network BlueCheck contract addresses
const BLUECHECK_ADDRESSES: Record<number, `0x${string}`> = {
  97: '0xfFaB42EcD7Eb0a85b018516421C9aCc088aC7157', // BSC Testnet
  56: '0xC14CdFE71Ca04c26c969a1C8a6aA4b1192e6fC43', // BSC Mainnet
};

const CHAIN_CONFIGS: Record<number, { chain: Chain; rpcEnv: string; rpcFallback: string }> = {
  97: {
    chain: bscTestnet,
    rpcEnv: 'BSC_TESTNET_RPC_URL',
    rpcFallback: 'https://bsc-testnet-rpc.publicnode.com',
  },
  56: {
    chain: bsc,
    rpcEnv: 'BSC_MAINNET_RPC_URL',
    rpcFallback: 'https://bsc-dataseed1.binance.org',
  },
};

const BLUECHECK_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'hasBlueCheck',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Verify on-chain hasBlueCheck for a wallet address across all supported chains.
 */
async function verifyOnChain(
  walletAddress: string
): Promise<{ verified: boolean; chainId: number | null }> {
  for (const [chainIdStr, config] of Object.entries(CHAIN_CONFIGS)) {
    const chainId = Number(chainIdStr);
    const contractAddress = BLUECHECK_ADDRESSES[chainId];
    if (!contractAddress) continue;

    try {
      const rpcUrl = process.env[config.rpcEnv] || config.rpcFallback;
      const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(rpcUrl),
      });

      const hasPurchased = await publicClient.readContract({
        address: contractAddress,
        abi: BLUECHECK_ABI,
        functionName: 'hasBlueCheck',
        args: [walletAddress as `0x${string}`],
      });

      if (hasPurchased) {
        return { verified: true, chainId };
      }
    } catch (err) {
      console.warn(
        `[BlueCheck Verifier] Failed to check chain ${chainId} for ${walletAddress}:`,
        err
      );
    }
  }

  return { verified: false, chainId: null };
}

export async function runBlueCheckVerifier() {
  console.log('[BlueCheck Verifier] Starting...');

  try {
    // Get profiles that are NOT active but have a linked EVM wallet
    // This catches users who purchased on-chain but DB didn't update
    const { data: nonActiveProfiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, bluecheck_status')
      .neq('bluecheck_status', 'ACTIVE')
      .limit(50);

    if (profileError) {
      console.error('[BlueCheck Verifier] Error fetching profiles:', profileError);
      return;
    }

    if (!nonActiveProfiles || nonActiveProfiles.length === 0) {
      console.log('[BlueCheck Verifier] No non-active profiles to check');
      return;
    }

    console.log(`[BlueCheck Verifier] Checking ${nonActiveProfiles.length} non-active profiles`);

    let activated = 0;

    for (const profile of nonActiveProfiles) {
      try {
        // Get the user's EVM wallet(s)
        const { data: wallets, error: walletError } = await supabase
          .from('wallets')
          .select('address, chain')
          .eq('user_id', profile.user_id)
          .eq('chain', 'EVM_1');

        if (walletError || !wallets || wallets.length === 0) {
          continue; // No EVM wallet, skip
        }

        // Check each wallet on-chain
        for (const wallet of wallets) {
          const result = await verifyOnChain(wallet.address);

          if (result.verified) {
            // Activate in DB
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ bluecheck_status: 'ACTIVE' })
              .eq('user_id', profile.user_id);

            if (updateError) {
              console.error(
                `[BlueCheck Verifier] Error activating user ${profile.user_id}:`,
                updateError
              );
            } else {
              activated++;
              console.log(
                `[BlueCheck Verifier] ✅ Activated Blue Check for user ${profile.user_id} (chain ${result.chainId}, wallet ${wallet.address})`
              );
            }
            break; // No need to check other wallets
          }
        }
      } catch (err) {
        console.error(`[BlueCheck Verifier] Error processing user ${profile.user_id}:`, err);
      }
    }

    console.log(`[BlueCheck Verifier] Completed. Activated ${activated} users.`);
  } catch (error) {
    console.error('[BlueCheck Verifier] Fatal error:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  runBlueCheckVerifier()
    .then(() => {
      console.log('[BlueCheck Verifier] Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[BlueCheck Verifier] Fatal error:', error);
      process.exit(1);
    });
}
