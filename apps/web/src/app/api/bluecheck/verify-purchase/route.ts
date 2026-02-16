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

export async function POST(request: Request) {
  try {
    // Use wallet-based session auth
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const { wallet_address, tx_hash } = await request.json();

    if (!wallet_address || !tx_hash) {
      return NextResponse.json(
        { error: 'Missing required fields: wallet_address, tx_hash' },
        { status: 400 }
      );
    }

    // Verify purchase on-chain
    const publicClient = createPublicClient({
      chain: bscTestnet,
      transport: http(),
    });

    const hasPurchased = await publicClient.readContract({
      address: BLUECHECK_CONTRACT_ADDRESS as `0x${string}`,
      abi: BLUECHECK_ABI,
      functionName: 'hasBlueCheck',
      args: [wallet_address as `0x${string}`],
    });

    if (!hasPurchased) {
      return NextResponse.json(
        { error: 'Purchase not confirmed on-chain (tx may still be pending)' },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS for the update
    const supabase = createServiceRoleClient();

    // Update profile bluecheck_status to ACTIVE
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        bluecheck_status: 'ACTIVE',
      })
      .eq('user_id', session.userId);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

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

        // If referrer is not zero address, create fee_split record
        if (referrerAddress && referrerAddress.toLowerCase() !== zeroAddress) {
          // Lookup referrer user_id from wallet address
          const { data: referrerWallet } = await supabase
            .from('wallets')
            .select('user_id')
            .eq('address', referrerAddress.toLowerCase())
            .eq('chain', '97')
            .single();

          if (referrerWallet?.user_id) {
            // Create fee_split record
            await supabase.from('fee_splits').insert({
              contributor_id: session.userId,
              referrer_id: referrerWallet.user_id,
              split_type: 'BLUECHECK_PURCHASE',
              amount: referrerReward.toString(),
              status: 'COMPLETED',
              tx_hash: tx_hash,
            });

            console.log(
              `Created fee_split for Blue Check purchase: ${referrerReward.toString()} to ${
                referrerWallet.user_id
              }`
            );
          }
        }
      }
    } catch (err) {
      console.error('Failed to parse event or create fee_split:', err);
      // Don't fail the verification, just log the error
    }

    return NextResponse.json({
      success: true,
      message: 'Blue Check purchase verified and activated',
      user_id: session.userId,
    });
  } catch (error) {
    console.error('Error in verify purchase endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
