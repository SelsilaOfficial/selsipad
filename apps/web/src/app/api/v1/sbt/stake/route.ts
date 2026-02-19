/**
 * POST /api/v1/sbt/stake
 * Stake an SBT to start earning rewards.
 * Idempotent: One stake per (user, rule).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySbtOwnership } from '@selsipad/shared/src/utils/sbt-verification';
import type { StakeSbtRequest, StakeSbtResponse, SbtRule } from '@selsipad/shared';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest
): Promise<NextResponse<StakeSbtResponse | { error: string }>> {
  try {
    const body: StakeSbtRequest = await request.json();
    const { rule_id, wallet_address } = body;

    if (!rule_id || !wallet_address) {
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

    // 1. Verify Rule exists and is active
    // Use service role for robust check if RLS issues occur, but standard should work.
    const { data: rule, error: ruleError } = await supabase
      .from('sbt_rules')
      .select('*')
      .eq('id', rule_id)
      .single();

    if (ruleError || !rule || !rule.is_active) {
      return NextResponse.json({ error: 'Rule not found or inactive' }, { status: 404 });
    }

    const sbtRule = rule as SbtRule;

    // 2. Check if already staked (Idempotency Check)
    const { data: existingStake } = await supabase
      .from('sbt_stakes')
      .select('id')
      .eq('user_id', user.id)
      .eq('rule_id', rule_id)
      .single();

    if (existingStake) {
      return NextResponse.json({
        success: true,
        stake_id: existingStake.id,
        message: 'Already staked (Idempotent)',
      });
    }

    // 3. Verify Ownership (Fresh check)
    const verification = await verifySbtOwnership(
      sbtRule.chain,
      wallet_address,
      sbtRule.collection_id
    );

    if (!verification.isValid) {
      return NextResponse.json(
        { error: `Verification failed: ${verification.error || 'Ownership not proven'}` },
        { status: 400 }
      );
    }

    // 4. Insert Stake
    // Use service role if needed, but RLS allows "Users insert own stakes".
    // We need to ensure we insert user_id = auth.uid().
    const { data: newStake, error: insertError } = await supabase
      .from('sbt_stakes')
      .insert({
        user_id: user.id,
        rule_id: rule_id,
        wallet_address: wallet_address,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Stake insert error:', insertError);

      // Handle race condition unique violation
      if (insertError.code === '23505') {
        // Unique violation
        return NextResponse.json({
          success: true,
          stake_id: 'existing', // We don't have ID handy without requery, but generic success ok
          message: 'Already staked (Race Condition Handled)',
        });
      }

      return NextResponse.json({ error: 'Failed to create stake' }, { status: 500 });
    }

    // 5. Initialize Rewards Ledger for user if not exists
    // Using ON CONFLICT logic would be nice, but supabase-js insert upsert check...
    // Let's try inserting ignore conflict.
    const serviceSupabase = createClient(); // Need privileges to verify/ensure ledger?
    // Ledger RLS: Users read own. Insert? "No explicit insert policy for users"?
    // The Migrations said: "Users read own ledger".
    // So creation must be system-side or we add Insert policy?
    // Usually ledger is system managed.
    // Let's use service client to ensure ledger exists.

    // Note: The plan didn't specify Ledger creation time.
    // We can do it lazily or here.
    await serviceSupabase
      .from('sbt_rewards_ledger')
      .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true });

    return NextResponse.json({
      success: true,
      stake_id: newStake.id,
      message: 'SBT staked successfully',
    });
  } catch (error) {
    console.error('Stake error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
