/**
 * POST /api/v1/sbt/claim/intent
 * Initiate a claim. Check balance > 0. Return fee requirement ($10).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ClaimSbtRewardResponse } from '@selsipad/shared';

const CLAIM_FEE_SOL = '100000000'; // ~0.1 SOL (Simplified $10 assumption for now)
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || 'TREASURY_PLACEHOLDER';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest
): Promise<NextResponse<ClaimSbtRewardResponse | { error: string }>> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check ledger balance
    const { data: ledger, error: ledgerError } = await supabase
      .from('sbt_rewards_ledger')
      .select('total_accrued, total_claimed')
      .eq('user_id', user.id)
      .single();

    if (ledgerError || !ledger) {
      return NextResponse.json({ error: 'No rewards ledger found' }, { status: 404 });
    }

    const accrued = BigInt(ledger.total_accrued);
    const claimed = BigInt(ledger.total_claimed);
    const claimable = accrued - claimed;

    if (claimable <= 0n) {
      return NextResponse.json({ error: 'No claimable rewards' }, { status: 400 });
    }

    // Generate Intent (Stateless for now, or signed payload? Just fields for testing)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

    return NextResponse.json({
      intent_id: `claim_intent_${user.id}_${Date.now()}`, // Temporary ID generation
      amount_sol: CLAIM_FEE_SOL,
      treasury_address: TREASURY_ADDRESS,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error('Claim intent error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
