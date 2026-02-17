/**
 * Backend API: Verify Blue Check Purchase
 *
 * Verifies on-chain purchase and updates database.
 * Uses getServerSession for auth (wallet-based) and service role client for DB writes.
 */

import { getServerSession } from '@/lib/auth/session';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { NextResponse } from 'next/server';
import { createPublicClient, http, decodeEventLog } from 'viem';
import { bscTestnet } from 'viem/chains';

// BlueCheckRegistry deployed to BSC Testnet
const BLUECHECK_CONTRACT_ADDRESS = '0xfFaB42EcD7Eb0a85b018516421C9aCc088aC7157';

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
    const { wallet_address, tx_hash } = await request.json();

    if (!wallet_address || !tx_hash) {
      return NextResponse.json(
        { error: 'Missing required fields: wallet_address, tx_hash' },
        { status: 400 }
      );
    }

    console.log('[BlueCheck Verify] Wallet:', wallet_address, 'TX:', tx_hash);

    // Verify purchase on-chain using configured RPC (default is unreachable from server)
    const rpcUrl = process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
    console.log('[BlueCheck Verify] Using RPC:', rpcUrl);
    const publicClient = createPublicClient({
      chain: bscTestnet,
      transport: http(rpcUrl),
    });

    // Check if the wallet has Blue Check on-chain
    let hasPurchased = false;
    try {
      hasPurchased = await publicClient.readContract({
        address: BLUECHECK_CONTRACT_ADDRESS as `0x${string}`,
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
            address: BLUECHECK_CONTRACT_ADDRESS as `0x${string}`,
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
      })
      .eq('user_id', session.userId)
      .select('user_id, bluecheck_status');

    if (updateError) {
      console.error('[BlueCheck Verify] Error updating profile:', updateError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    console.log('[BlueCheck Verify] Profile updated:', updateData);

    // Parse transaction receipt to get referrer info
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

            // 1. Create fee_splits record (matches actual DB schema)
            const { error: splitError } = await supabase.from('fee_splits').insert({
              source_type: 'BLUECHECK',
              source_id: crypto.randomUUID(), // unique source ID for this purchase
              total_amount: amountPaid.toString(),
              treasury_amount: treasuryAmt.toString(),
              referral_pool_amount: referrerReward.toString(),
              asset: '0x0000000000000000000000000000000000000000', // native BNB
              chain: '97', // BSC Testnet
              processed: true,
              processed_at: new Date().toISOString(),
            });

            if (splitError) {
              console.error('[BlueCheck Verify] Fee split insert error:', splitError);
            } else {
              console.log(
                `[BlueCheck Verify] Created fee_split: total=${amountPaid.toString()}, referral=${referrerReward.toString()}`
              );
            }

            // 2. Create referral_ledger entry — CLAIMED since reward auto-sent on-chain
            const { error: ledgerError } = await supabase.from('referral_ledger').insert({
              referrer_id: referrerWallet.user_id,
              source_type: 'BLUECHECK',
              source_id: crypto.randomUUID(), // unique source ID
              amount: referrerReward.toString(),
              asset: '0x0000000000000000000000000000000000000000', // native BNB
              chain: '97', // BSC Testnet
              status: 'CLAIMED', // Auto-paid on-chain, no manual claim needed
              claimed_at: new Date().toISOString(),
            });

            if (ledgerError) {
              console.error('[BlueCheck Verify] Referral ledger insert error:', ledgerError);
            } else {
              console.log(
                `[BlueCheck Verify] Created referral_ledger: ${referrerReward.toString()} to referrer ${referrerWallet.user_id}`
              );
            }

            // 3. Activate the referral relationship (Blue Check purchase is a qualifying event)
            const { error: activateError } = await supabase
              .from('referral_relationships')
              .update({ activated_at: new Date().toISOString() })
              .eq('referrer_id', referrerWallet.user_id)
              .eq('referee_id', session.userId)
              .is('activated_at', null); // Only activate if not already activated

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
