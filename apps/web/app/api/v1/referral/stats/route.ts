/**
 * GET /api/v1/referral/stats
 * Get referrer's statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getServerSession } from '@/lib/auth/session';
import { calculateReferralStatistics, checkClaimEligibility } from '@selsipad/shared';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    const userId = session.userId;

    // Get profile data
    const { data: profile } = await supabase
      .from('profiles')
      .select('active_referral_count, bluecheck_status')
      .eq('user_id', userId)
      .single();

    // Get total referrals
    const { data: referrals, count: totalReferrals } = await supabase
      .from('referral_relationships')
      .select('*', { count: 'exact' })
      .eq('referrer_id', userId);

    // Get active referrals
    const activeReferrals = referrals?.filter((r) => r.activated_at !== null).length || 0;

    // Get ledger entries
    const { data: ledgerEntries } = await supabase
      .from('referral_ledger')
      .select('*')
      .eq('referrer_id', userId);

    // Calculate statistics
    const stats = calculateReferralStatistics(
      totalReferrals || 0,
      activeReferrals,
      ledgerEntries || []
    );

    // Get claimable by chain
    const claimableByChain: Array<{ chain: string; asset: string; amount: string }> = [];
    const grouped = (ledgerEntries || [])
      .filter((e) => e.status === 'CLAIMABLE')
      .reduce(
        (acc, entry) => {
          const key = `${entry.chain}:${entry.asset}`;
          if (!acc[key]) {
            acc[key] = { chain: entry.chain, asset: entry.asset, amount: 0n };
          }
          acc[key].amount += BigInt(entry.amount);
          return acc;
        },
        {} as Record<string, { chain: string; asset: string; amount: bigint }>
      );

    for (const key in grouped) {
      claimableByChain.push({
        chain: grouped[key].chain,
        asset: grouped[key].asset,
        amount: grouped[key].amount.toString(),
      });
    }

    // Check claim eligibility
    const eligibility = checkClaimEligibility(
      profile?.bluecheck_status || null,
      profile?.active_referral_count || 0,
      ledgerEntries || []
    );

    return NextResponse.json({
      ...stats,
      claimable_by_chain: claimableByChain,
      can_claim: eligibility.can_claim,
      claim_requirements: eligibility.checks,
    });
  } catch (error) {
    console.error('Error in GET /api/v1/referral/stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
