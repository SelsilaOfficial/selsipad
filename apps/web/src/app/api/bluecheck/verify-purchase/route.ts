/**
 * Backend API: Verify Blue Check Purchase
 *
 * Verifies on-chain purchase and updates database.
 * Supports BSC Testnet (97) and BSC Mainnet (56).
 * Uses getServerSession for auth (wallet-based) and service role client for DB writes.
 */

import { getServerSession } from '@/lib/auth/session';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { NextResponse } from 'next/server';
import { createPublicClient, http, decodeEventLog, type Chain } from 'viem';
import { bscTestnet, bsc } from 'viem/chains';

// Per-network BlueCheck contract addresses
const BLUECHECK_ADDRESSES: Record<number, string> = {
  97: '0xfFaB42EcD7Eb0a85b018516421C9aCc088aC7157', // BSC Testnet
  56: '0xC14CdFE71Ca04c26c969a1C8a6aA4b1192e6fC43', // BSC Mainnet
};

// Per-network chain configs
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

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Use wallet-based session auth
    const session = await getServerSession();

    if (!session) {
      console.error('[BlueCheck Verify] No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[BlueCheck Verify] Session userId:', session.userId);

    // Parse request body
    const { wallet_address, tx_hash, chain_id } = await request.json();

    if (!wallet_address || !tx_hash) {
      return NextResponse.json(
        { error: 'Missing required fields: wallet_address, tx_hash' },
        { status: 400 }
      );
    }

    // Resolve chain — default to 97 for backward compatibility
    const chainId = chain_id ? Number(chain_id) : 97;
    const chainConfig = CHAIN_CONFIGS[chainId];
    const contractAddress = BLUECHECK_ADDRESSES[chainId];

    if (!chainConfig || !contractAddress) {
      return NextResponse.json(
        { error: `Unsupported chain: ${chainId}. Use BSC Testnet (97) or BSC Mainnet (56).` },
        { status: 400 }
      );
    }

    console.log('[BlueCheck Verify] Chain:', chainId, 'Wallet:', wallet_address, 'TX:', tx_hash);

    // Verify purchase on-chain using configured RPC
    const rpcUrl = process.env[chainConfig.rpcEnv] || chainConfig.rpcFallback;
    console.log('[BlueCheck Verify] Using RPC:', rpcUrl);
    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(rpcUrl),
    });

    // Check if the wallet has Blue Check on-chain
    let hasPurchased = false;
    try {
      hasPurchased = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: BLUECHECK_ABI,
        functionName: 'hasBlueCheck',
        args: [wallet_address as `0x${string}`],
      });
      console.log(
        '[BlueCheck Verify] On-chain hasBlueCheck for',
        wallet_address,
        ':',
        hasPurchased
      );
    } catch (err) {
      console.error('[BlueCheck Verify] Failed to read on-chain status:', err);
    }

    // Also check the TX sender if the wallet_address check failed
    if (!hasPurchased) {
      try {
        const tx = await publicClient.getTransaction({ hash: tx_hash as `0x${string}` });
        const txSender = tx.from;
        console.log('[BlueCheck Verify] TX sender:', txSender);

        if (txSender.toLowerCase() !== wallet_address.toLowerCase()) {
          const senderHasPurchased = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: BLUECHECK_ABI,
            functionName: 'hasBlueCheck',
            args: [txSender as `0x${string}`],
          });
          console.log('[BlueCheck Verify] TX sender hasBlueCheck:', senderHasPurchased);

          if (senderHasPurchased) {
            hasPurchased = true;
          }
        }
      } catch (err) {
        console.error('[BlueCheck Verify] Failed to check TX sender:', err);
      }
    }

    if (!hasPurchased) {
      console.error('[BlueCheck Verify] Purchase not confirmed on-chain');
      return NextResponse.json(
        { error: 'Purchase not confirmed on-chain (tx may still be pending)' },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS for the update
    const supabase = createServiceRoleClient();

    // Update profile bluecheck_status to ACTIVE
    const { error: updateError, data: updateData } = await supabase
      .from('profiles')
      .update({
        bluecheck_status: 'ACTIVE',
        bluecheck_tx_hash: tx_hash,
      })
      .eq('user_id', session.userId)
      .select('user_id, bluecheck_status');

    if (updateError) {
      console.error('[BlueCheck Verify] Error updating profile:', updateError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    console.log('[BlueCheck Verify] Profile updated:', updateData);

    // Parse transaction receipt to get referrer info
    const chainStr = String(chainId);
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: tx_hash as `0x${string}` });

      // Parse BlueCheckPurchased event to extract referrer
      const blueCheckEventAbi = [
        {
          anonymous: false,
          inputs: [
            { indexed: true, name: 'user', type: 'address' },
            { indexed: false, name: 'amountPaid', type: 'uint256' },
            { indexed: false, name: 'treasuryAmount', type: 'uint256' },
            { indexed: false, name: 'referrerReward', type: 'uint256' },
            { indexed: true, name: 'referrer', type: 'address' },
            { indexed: false, name: 'timestamp', type: 'uint256' },
          ],
          name: 'BlueCheckPurchased',
          type: 'event',
        },
      ];

      const eventLog = receipt.logs.find((log) => {
        try {
          const decoded = decodeEventLog({
            abi: blueCheckEventAbi,
            data: log.data,
            topics: log.topics,
          });
          return decoded.eventName === 'BlueCheckPurchased';
        } catch {
          return false;
        }
      });

      if (eventLog) {
        const decoded = decodeEventLog({
          abi: blueCheckEventAbi,
          data: eventLog.data,
          topics: eventLog.topics,
        });

        const referrerAddress = (decoded.args as any)?.referrer as string;
        const referrerReward = (decoded.args as any)?.referrerReward as bigint;
        const zeroAddress = '0x0000000000000000000000000000000000000000';

        console.log(
          '[BlueCheck Verify] Event referrer:',
          referrerAddress,
          'reward:',
          referrerReward?.toString()
        );

        // If referrer is not zero address and not treasury, create fee_split record
        if (referrerAddress && referrerAddress.toLowerCase() !== zeroAddress) {
          // Lookup referrer user_id from wallet address
          const { data: referrerWallet } = await supabase
            .from('wallets')
            .select('user_id')
            .ilike('address', referrerAddress)
            .single();

          console.log('[BlueCheck Verify] Referrer wallet lookup:', referrerWallet);

          if (referrerWallet?.user_id) {
            const amountPaid = (decoded.args as any)?.amountPaid as bigint;
            const treasuryAmt = (decoded.args as any)?.treasuryAmount as bigint;

            // 1. Create fee_splits record (idempotent: tx_hash as source_id)
            const { error: splitError } = await supabase.from('fee_splits').upsert(
              {
                source_type: 'BLUECHECK',
                source_id: tx_hash,
                total_amount: amountPaid.toString(),
                treasury_amount: treasuryAmt.toString(),
                referral_pool_amount: referrerReward.toString(),
                asset: '0x0000000000000000000000000000000000000000', // native BNB
                chain: chainStr,
                processed: true,
                processed_at: new Date().toISOString(),
              },
              { onConflict: 'source_type,source_id', ignoreDuplicates: true }
            );

            if (splitError) {
              console.error('[BlueCheck Verify] Fee split insert error:', splitError);
            } else {
              console.log(
                `[BlueCheck Verify] Created fee_split: chain=${chainStr}, total=${amountPaid.toString()}, referral=${referrerReward.toString()}`
              );
            }

            // 2. Create referral_ledger entry — CLAIMED since reward auto-sent on-chain
            //    Idempotent: tx_hash as source_id prevents duplicates
            const { error: ledgerError } = await supabase.from('referral_ledger').upsert(
              {
                referrer_id: referrerWallet.user_id,
                source_type: 'BLUECHECK',
                source_id: tx_hash,
                amount: referrerReward.toString(),
                asset: '0x0000000000000000000000000000000000000000', // native BNB
                chain: chainStr,
                status: 'CLAIMED',
                claimed_at: new Date().toISOString(),
              },
              { onConflict: 'source_type,source_id', ignoreDuplicates: true }
            );

            if (ledgerError) {
              console.error('[BlueCheck Verify] Referral ledger insert error:', ledgerError);
            } else {
              console.log(
                `[BlueCheck Verify] Created referral_ledger: chain=${chainStr}, ${referrerReward.toString()} to referrer ${referrerWallet.user_id}`
              );
            }

            // 3. Activate the referral relationship
            const { error: activateError } = await supabase
              .from('referral_relationships')
              .update({ activated_at: new Date().toISOString() })
              .eq('referrer_id', referrerWallet.user_id)
              .eq('referee_id', session.userId)
              .is('activated_at', null);

            if (activateError) {
              console.error('[BlueCheck Verify] Referral activation error:', activateError);
            } else {
              console.log(
                `[BlueCheck Verify] Activated referral: referee=${session.userId} -> referrer=${referrerWallet.user_id}`
              );
            }
          }
        }
      }
    } catch (err) {
      console.error('[BlueCheck Verify] Failed to parse event or create fee_split:', err);
      // Don't fail the verification, just log the error
    }

    return NextResponse.json({
      success: true,
      message: 'Blue Check purchase verified and activated',
      user_id: session.userId,
    });
  } catch (error) {
    console.error('[BlueCheck Verify] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
