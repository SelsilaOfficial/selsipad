/**
 * GET /api/admin/referral/analytics
 * Admin referral analytics (total stats)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // TODO: Check admin role

    // Get total referral relationships
    const { count: totalRelationships } = await supabase
      .from('referral_relationships')
      .select('*', { count: 'exact', head: true });

    // Get activated referrals
    const { count: activatedCount } = await supabase
      .from('referral_relationships')
      .select('*', { count: 'exact', head: true })
      .not('activated_at', 'is', null);

    // Get total rewards distributed
    const { data: ledgerEntries } = await supabase
      .from('referral_ledger')
      .select('amount, asset, chain, status');

    const totalRewards = ledgerEntries?.reduce(
      (acc, entry) => {
        const key = `${entry.chain}:${entry.asset}`;
        if (!acc[key])
          acc[key] = { chain: entry.chain, asset: entry.asset, total: 0n, claimed: 0n };
        acc[key].total += BigInt(entry.amount);
        if (entry.status === 'CLAIMED') acc[key].claimed += BigInt(entry.amount);
        return acc;
      },
      {} as Record<string, { chain: string; asset: string; total: bigint; claimed: bigint }>
    );

    const rewardsByChain = Object.values(totalRewards || {}).map((r) => ({
      chain: r.chain,
      asset: r.asset,
      total: r.total.toString(),
      claimed: r.claimed.toString(),
      claimable: (r.total - r.claimed).toString(),
    }));

    // Get top referrers
    const { data: topReferrers } = await supabase
      .from('profiles')
      .select('user_id, username, active_referral_count')
      .gt('active_referral_count', 0)
      .order('active_referral_count', { ascending: false })
      .limit(10);

    return NextResponse.json({
      total_relationships: totalRelationships || 0,
      activated_relationships: activatedCount || 0,
      activation_rate: totalRelationships
        ? (((activatedCount || 0) / totalRelationships) * 100).toFixed(2)
        : '0.00',
      rewards_by_chain: rewardsByChain,
      top_referrers: topReferrers || [],
    });
  } catch (error) {
    console.error('Error in GET /api/admin/referral/analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
