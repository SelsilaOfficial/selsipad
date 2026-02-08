/**
 * POST /api/v1/referral/claim
 * Claim referral rewards for specific chain/asset
 *
 * CRITICAL GATING:
 * - Must be Blue Check ACTIVE
 * - Must have active_referral_count >= 1
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getServerSession } from '@/lib/auth/session';
import {
  validateReferralClaim,
  checkClaimEligibility,
  getClaimableForChainAsset,
} from '@selsipad/shared';
import type { ReferralClaimRequest } from '@selsipad/shared';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    const userId = session.userId;

    const body = (await request.json()) as ReferralClaimRequest;

    const validation = validateReferralClaim(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // Get profile for gating checks
    const { data: profile } = await supabase
      .from('profiles')
      .select('bluecheck_status, active_referral_count, primary_wallet')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get ledger entries
    const { data: ledgerEntries } = await supabase
      .from('referral_ledger')
      .select('*')
      .eq('referrer_id', userId);

    // CRITICAL: Check claim eligibility
    const eligibility = checkClaimEligibility(
      profile.bluecheck_status,
      profile.active_referral_count,
      ledgerEntries || []
    );

    if (!eligibility.can_claim) {
      return NextResponse.json(
        {
          error: 'Claim not allowed',
          reasons: eligibility.reasons,
          requirements: eligibility.checks,
        },
        { status: 403 }
      );
    }

    // Get claimable entries for this chain/asset
    const claimableData = getClaimableForChainAsset(ledgerEntries || [], body.chain, body.asset);

    if (claimableData.total_amount === 0n) {
      return NextResponse.json(
        { error: 'No claimable rewards for this chain/asset' },
        { status: 400 }
      );
    }

    // Check idempotency
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (idempotencyKey) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const { data: recentClaim } = await supabase
        .from('referral_ledger')
        .select('*')
        .eq('referrer_id', userId)
        .eq('chain', body.chain)
        .eq('asset', body.asset)
        .eq('status', 'CLAIMED')
        .gte('claimed_at', fiveMinutesAgo.toISOString())
        .order('claimed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentClaim) {
        return NextResponse.json({
          success: true,
          message: 'Claim already processed',
          claim_tx_hash: recentClaim.claim_tx_hash,
        });
      }
    }

    // Mark entries as CLAIMED and set claim_tx_hash
    // TODO: Integrate with Tx Manager for actual payout
    const mockTxHash = `0x${Math.random().toString(16).substring(2)}`;

    const { error: updateError } = await supabase
      .from('referral_ledger')
      .update({
        status: 'CLAIMED',
        claimed_at: new Date().toISOString(),
        claim_tx_hash: mockTxHash,
      })
      .in('id', claimableData.entry_ids);

    if (updateError) {
      console.error('Error updating ledger:', updateError);
      return NextResponse.json({ error: 'Failed to process claim' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      amount: claimableData.total_amount.toString(),
      chain: body.chain,
      asset: body.asset,
      claim_tx_hash: mockTxHash,
      recipient: profile.primary_wallet,
      message: 'Claim processed successfully',
    });
  } catch (error) {
    console.error('Error in POST /api/v1/referral/claim:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
