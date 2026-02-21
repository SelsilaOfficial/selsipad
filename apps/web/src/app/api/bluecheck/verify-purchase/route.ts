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

    // ========== REFERRAL PROCESSING ==========
    // Process referral reward, activation, and fee split.
    // Each step runs independently — one failure does NOT block others.
    const chainStr = String(chainId);
    let referralProcessingWarnings: string[] = [];

    // Step 1: Fetch transaction receipt and parse BlueCheckPurchased event
    let referrerAddress: string | null = null;
    let referrerReward: bigint | null = null;
    let amountPaid: bigint | null = null;
    let treasuryAmt: bigint | null = null;

    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: tx_hash as `0x${string}` });
      console.log('[BlueCheck Referral] Receipt fetched, logs count:', receipt.logs.length);

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

        referrerAddress = (decoded.args as any)?.referrer as string;
        referrerReward = (decoded.args as any)?.referrerReward as bigint;
        amountPaid = (decoded.args as any)?.amountPaid as bigint;
        treasuryAmt = (decoded.args as any)?.treasuryAmount as bigint;

        console.log('[BlueCheck Referral] Parsed event — referrer:', referrerAddress, 'reward:', referrerReward?.toString());
      } else {
        console.warn('[BlueCheck Referral] BlueCheckPurchased event NOT found in receipt logs. Total logs:', receipt.logs.length);
        referralProcessingWarnings.push('BlueCheckPurchased event not found in tx logs');
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[BlueCheck Referral] STEP 1 FAILED — Receipt fetch/parse error:', errMsg);
      referralProcessingWarnings.push(`Receipt fetch failed: ${errMsg}`);
    }

    // Step 2: Lookup referrer wallet and process rewards (only if event was parsed)
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    if (referrerAddress && referrerAddress.toLowerCase() !== zeroAddress && referrerReward) {
      let referrerUserId: string | null = null;

      // Step 2a: Lookup referrer user_id from wallet address
      try {
        const { data: referrerWallet, error: walletError } = await supabase
          .from('wallets')
          .select('user_id')
          .ilike('address', referrerAddress)
          .single();

        if (walletError || !referrerWallet?.user_id) {
          console.error('[BlueCheck Referral] STEP 2a FAILED — Referrer wallet not found for address:', referrerAddress, 'error:', walletError);
          referralProcessingWarnings.push(`Referrer wallet not found: ${referrerAddress}`);
        } else {
          referrerUserId = referrerWallet.user_id;
          console.log('[BlueCheck Referral] Referrer user_id:', referrerUserId);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[BlueCheck Referral] STEP 2a FAILED — Wallet lookup error:', errMsg);
        referralProcessingWarnings.push(`Wallet lookup error: ${errMsg}`);
      }

      if (referrerUserId) {
        // Step 2b: Create fee_splits record
        try {
          const { error: splitError } = await supabase.from('fee_splits').upsert(
            {
              source_type: 'BLUECHECK',
              source_id: tx_hash,
              total_amount: amountPaid!.toString(),
              treasury_amount: treasuryAmt!.toString(),
              referral_pool_amount: referrerReward.toString(),
              asset: zeroAddress, // native BNB
              chain: chainStr,
              processed: true,
              processed_at: new Date().toISOString(),
            },
            { onConflict: 'source_type,source_id', ignoreDuplicates: true }
          );

          if (splitError) {
            console.error('[BlueCheck Referral] STEP 2b FAILED — Fee split error:', splitError);
            referralProcessingWarnings.push(`Fee split insert failed: ${splitError.message}`);
          } else {
            console.log(`[BlueCheck Referral] STEP 2b OK — fee_split created: chain=${chainStr}, total=${amountPaid!.toString()}`);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error('[BlueCheck Referral] STEP 2b FAILED — Fee split error:', errMsg);
          referralProcessingWarnings.push(`Fee split error: ${errMsg}`);
        }

        // Step 2c: Create referral_ledger entry (with referee_id for proper tracking)
        try {
          const { error: ledgerError } = await supabase.from('referral_ledger').upsert(
            {
              referrer_id: referrerUserId,
              referee_id: session.userId,
              source_type: 'BLUECHECK',
              source_id: tx_hash,
              amount: referrerReward.toString(),
              asset: zeroAddress, // native BNB
              chain: chainStr,
              status: 'CLAIMED',
              claimed_at: new Date().toISOString(),
            },
            { onConflict: 'source_type,source_id,referee_id', ignoreDuplicates: true }
          );

          if (ledgerError) {
            console.error('[BlueCheck Referral] STEP 2c FAILED — Ledger error:', ledgerError);
            referralProcessingWarnings.push(`Referral ledger insert failed: ${ledgerError.message}`);
          } else {
            console.log(`[BlueCheck Referral] STEP 2c OK — referral_ledger: ${referrerReward.toString()} BNB to referrer ${referrerUserId}, referee ${session.userId}`);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error('[BlueCheck Referral] STEP 2c FAILED — Ledger error:', errMsg);
          referralProcessingWarnings.push(`Referral ledger error: ${errMsg}`);
        }

        // Step 2d: Activate the referral relationship + increment active_referral_count
        try {
          const { data: activatedRows, error: activateError } = await supabase
            .from('referral_relationships')
            .update({ activated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('referrer_id', referrerUserId)
            .eq('referee_id', session.userId)
            .is('activated_at', null)
            .select('id');

          if (activateError) {
            console.error('[BlueCheck Referral] STEP 2d FAILED — Activation error:', activateError);
            referralProcessingWarnings.push(`Referral activation failed: ${activateError.message}`);
          } else if (activatedRows && activatedRows.length > 0) {
            console.log(`[BlueCheck Referral] STEP 2d OK — Activated referral: referee=${session.userId} -> referrer=${referrerUserId}`);

            // Increment active_referral_count on referrer's profile
            const { error: countError } = await supabase.rpc('increment_active_referral_count', {
              target_user_id: referrerUserId,
            });

            if (countError) {
              // Fallback: direct update if RPC doesn't exist
              console.warn('[BlueCheck Referral] RPC increment failed, using direct update:', countError.message);
              const { error: directError } = await supabase
                .from('profiles')
                .update({
                  active_referral_count: (await supabase
                    .from('referral_relationships')
                    .select('id', { count: 'exact' })
                    .eq('referrer_id', referrerUserId)
                    .not('activated_at', 'is', null)
                  ).count || 0,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', referrerUserId);

              if (directError) {
                console.error('[BlueCheck Referral] STEP 2d PARTIAL — active_referral_count update failed:', directError);
                referralProcessingWarnings.push(`active_referral_count update failed: ${directError.message}`);
              } else {
                console.log(`[BlueCheck Referral] STEP 2d OK — active_referral_count updated for referrer ${referrerUserId}`);
              }
            } else {
              console.log(`[BlueCheck Referral] STEP 2d OK — active_referral_count incremented for referrer ${referrerUserId}`);
            }
          } else {
            console.log(`[BlueCheck Referral] STEP 2d SKIP — No pending referral to activate (already active or not found)`);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error('[BlueCheck Referral] STEP 2d FAILED — Activation error:', errMsg);
          referralProcessingWarnings.push(`Referral activation error: ${errMsg}`);
        }
      }
    } else if (referrerAddress && referrerAddress.toLowerCase() === zeroAddress) {
      console.log('[BlueCheck Referral] No referrer (zero address) — skipping referral processing');
    }

    // Log summary of referral processing
    if (referralProcessingWarnings.length > 0) {
      console.warn('[BlueCheck Referral] COMPLETED WITH WARNINGS:', JSON.stringify(referralProcessingWarnings));
    } else {
      console.log('[BlueCheck Referral] COMPLETED SUCCESSFULLY — all steps passed');
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
