/**
 * Backend API: Verify Blue Check Purchase
 *
 * Verifies on-chain purchase and updates database
 */

import { createClient } from '@/lib/supabase/server';
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
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
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

    // Get profile by wallet address
    const { data: wallet } = await supabase
      .from('wallets')
      .select('profile_id')
      .eq('address', wallet_address.toLowerCase())
      .eq('network', 'EVM')
      .single();

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
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

    // Update profile in database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        bluecheck_status: 'ACTIVE',
        bluecheck_purchased_at: new Date().toISOString(),
        bluecheck_tx_hash: tx_hash,
        bluecheck_grant_type: 'PURCHASE',
      })
      .eq('user_id', wallet.profile_id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    // Create fee events record (simplified - full implementation would parse tx receipt)
    // For now, we just track that a purchase happened
    const { error: feeError } = await supabase.from('fee_events').insert({
      event_type: 'BLUE_CHECK_PURCHASE',
      user_id: wallet.profile_id,
      amount_usd: 10,
      amount_native: 0, // TODO: Parse from tx receipt
      tx_hash: tx_hash,
      network: 'BSC',
    });

    if (feeError) {
      console.error('Error creating fee event:', feeError);
      // Don't fail the request
    }

    // Create audit log entry
    const { error: auditError } = await supabase.from('bluecheck_audit_log').insert({
      action_type: 'PURCHASE',
      target_user_id: wallet.profile_id,
      tx_hash: tx_hash,
      amount_usd: 10,
      metadata: {
        wallet_address: wallet_address,
      },
    });

    if (auditError) {
      console.error('Error creating audit log:', auditError);
      // Don't fail the request
    }

    return NextResponse.json({
      success: true,
      message: 'Blue Check purchase verified and activated',
      user_id: wallet.profile_id,
    });
  } catch (error) {
    console.error('Error in verify purchase endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
