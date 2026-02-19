/**
 * GET /api/v1/sbt/eligibility
 * Check if the authenticated user (or provided wallet) is eligible for SBT staking
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySbtOwnership } from '@selsipad/shared/src/utils/sbt-verification';
import type { SbtRule } from '@selsipad/shared';

// Force dynamic since we read DB
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let wallet = searchParams.get('wallet');

    const supabase = createClient();

    // If wallet not provided, verify auth and get from profile?
    // FASE 8 spec implies we verify "external" wallet usually connected via frontend.
    // However, if we want to bind it to user, we should check auth.
    // Let's assume user must be logged in to stake, but eligibility check might be public?
    // The spec says "User bisa verifikasi...".
    // Let's require Auth for robust implementation.

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use wallet param if provided (for checking new wallets), or user's primary wallet?
    // Spec: "payout only to primary wallet". But verification is for "external" SBT source.
    // User might have SBT on a different wallet than primary.
    // Let's require `wallet` param.

    if (!wallet) {
      return NextResponse.json({ error: 'Missing wallet parameter' }, { status: 400 });
    }

    // Fetch active rules from DB
    const ServiceSupabase = createClient(); // Service role? Or just public read? Rules are public.
    // Use standard client, RLS allows reading rules.
    const { data: rules, error: rulesError } = await supabase
      .from('sbt_rules')
      .select('*')
      .eq('is_active', true);

    if (rulesError || !rules) {
      return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 });
    }

    const results = [];

    // Check eligibility for each rule
    for (const rule of rules as SbtRule[]) {
      const verification = await verifySbtOwnership(rule.chain, wallet, rule.collection_id);

      if (verification.isValid) {
        results.push({
          rule_id: rule.id,
          chain: rule.chain,
          collection: rule.name,
          eligible: true,
        });
      }
    }

    return NextResponse.json({
      wallet,
      eligible_rules: results,
      total_eligible: results.length,
    });
  } catch (error) {
    console.error('Eligibility check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
