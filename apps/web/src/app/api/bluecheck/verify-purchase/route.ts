/**
 * Backend API: Verify Blue Check Purchase
 *
 * Verifies on-chain purchase and updates database.
 * Uses getServerSession for auth (wallet-based) and service role client for DB writes.
 */

import { getServerSession } from '@/lib/auth/session';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { bscTestnet } from 'viem/chains';

// BlueCheckRegistry deployed to BSC Testnet
const BLUECHECK_CONTRACT_ADDRESS = '0x57d4789062F3f2DbB504d11A98Fc9AeA390Be8E2';

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
