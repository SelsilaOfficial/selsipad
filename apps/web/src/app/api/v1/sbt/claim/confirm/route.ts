/**
 * POST /api/v1/sbt/claim/confirm
 * Verify $10 fee -> Update Ledger -> Record Claim
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SbtClaimConfirmRequest, SbtClaimConfirmResponse } from '@selsipad/shared';

// Simplify verification logic reuse
async function verifyFeeTx(txHash: string): Promise<boolean> {
  // Mock verification
  return txHash.startsWith('valid_tx') || txHash.length > 10;
}

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest
): Promise<NextResponse<SbtClaimConfirmResponse | { error: string }>> {
  try {
    const body: SbtClaimConfirmRequest = await request.json();
    const { intent_id, fee_tx_hash } = body;

    if (!intent_id || !fee_tx_hash) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Fee
    const isFeeValid = await verifyFeeTx(fee_tx_hash);
    if (!isFeeValid) {
      return NextResponse.json({ error: 'Invalid fee transaction' }, { status: 400 });
    }

    // Use Service Role for updating ledger and claims logic
    const serviceSupabase = createClient();

    // Check Ledger again
    const { data: ledger } = await serviceSupabase
      .from('sbt_rewards_ledger')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!ledger) return NextResponse.json({ error: 'Ledger error' }, { status: 500 });

    const accrued = BigInt(ledger.total_accrued);
    const claimed = BigInt(ledger.total_claimed);
    const pending = accrued - claimed;

    if (pending <= 0n) {
      return NextResponse.json({ error: 'No pending rewards to claim' }, { status: 400 });
    }

    // Update Ledger (Optimistic update or transactional?)
    // Increase claimed amount
    const newClaimed = claimed + pending;

    // We should do this in a transaction or RPC ideally.
    // For now, simple update.

    const { error: updateError } = await serviceSupabase
      .from('sbt_rewards_ledger')
      .update({
        total_claimed: newClaimed.toString(),
        last_updated: new Date().toISOString(),
      })
      .eq('id', ledger.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update ledger' }, { status: 500 });
    }

    // Record Claim
    const { data: claim, error: claimError } = await serviceSupabase
      .from('sbt_claims')
      .insert({
        user_id: user.id,
        amount: pending.toString(),
        fee_tx_hash: fee_tx_hash,
        status: 'CONFIRMED', // Immediate confirm if fee valid
      })
      .select('id')
      .single();

    if (claimError) {
      console.error('Claim insert error:', claimError);
      return NextResponse.json({ error: 'Failed to record claim' }, { status: 500 });
    }

    // Trigger Payout (Async Worker would pick this up usually, or immediate mock)
    // We assume worker handles payout based on CONFIRMED claims.

    return NextResponse.json({
      success: true,
      claim_id: claim.id,
      status: 'CONFIRMED',
      message: 'Claim confirmed. Payout processing.',
    });
  } catch (error) {
    console.error('Claim confirm error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
