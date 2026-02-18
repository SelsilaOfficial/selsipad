/**
 * Fix Blue Check Status — Auto-Reconcile Endpoint
 *
 * Called by BlueCheckClientContent when on-chain hasBlueCheck=true but DB status ≠ ACTIVE.
 * Verifies on-chain before updating DB to prevent abuse.
 * Supports BSC Testnet (97) and BSC Mainnet (56).
 */

import { getServerSession } from '@/lib/auth/session';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { NextResponse } from 'next/server';
import { createPublicClient, http, type Chain } from 'viem';
import { bscTestnet, bsc } from 'viem/chains';

export const dynamic = 'force-dynamic';

// Per-network configs
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

export async function POST(request: Request) {
  try {
    // Require authenticated session
    const session = await getServerSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { wallet_address } = await request.json();

    if (!wallet_address) {
      return NextResponse.json({ error: 'wallet_address required' }, { status: 400 });
    }

    console.log('[BlueCheck FixStatus] User:', session.userId, 'Wallet:', wallet_address);

    const supabase = createServiceRoleClient();

    // 1. Check current DB status — skip if already ACTIVE
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, bluecheck_status')
      .eq('user_id', session.userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (profile.bluecheck_status === 'ACTIVE') {
      return NextResponse.json({ success: true, message: 'Already ACTIVE' });
    }

    // 2. Verify on-chain hasBlueCheck on BOTH supported chains
    let verifiedOnChain = false;
    let verifiedChainId: number | null = null;

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
          args: [wallet_address as `0x${string}`],
        });

        if (hasPurchased) {
          verifiedOnChain = true;
          verifiedChainId = chainId;
          console.log(`[BlueCheck FixStatus] ✅ Verified on chain ${chainId}`);
          break;
        }
      } catch (err) {
        console.warn(`[BlueCheck FixStatus] Failed to check chain ${chainId}:`, err);
      }
    }

    if (!verifiedOnChain) {
      console.log('[BlueCheck FixStatus] ❌ Not verified on any chain');
      return NextResponse.json(
        { error: 'Blue Check not found on-chain. Purchase first.' },
        { status: 400 }
      );
    }

    // 3. Verified on-chain → update DB
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({
        bluecheck_status: 'ACTIVE',
      })
      .eq('user_id', session.userId)
      .select('user_id, bluecheck_status');

    if (updateError) {
      return NextResponse.json({ error: 'Update failed', details: updateError }, { status: 500 });
    }

    console.log(
      `[BlueCheck FixStatus] ✅ Activated for user ${session.userId} (chain ${verifiedChainId})`
    );

    return NextResponse.json({
      success: true,
      message: 'Blue Check activated via on-chain verification',
      chain_id: verifiedChainId,
    });
  } catch (error: any) {
    console.error('[BlueCheck FixStatus] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
