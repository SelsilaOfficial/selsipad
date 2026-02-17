/**
 * POST /api/v1/bonding/:pool_id/swap/intent
 * Calculate swap output using constant-product AMM and generate intent
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSwapQuote } from '@selsipad/shared';
import type { SwapIntentRequest, SwapIntentResponse } from '@selsipad/shared';

const INTENT_EXPIRY_SECONDS = 30; // 30 seconds for price validity
const DEFAULT_SLIPPAGE_BPS = 100; // 1%

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { pool_id: string } }
): Promise<NextResponse<SwapIntentResponse | { error: string }>> {
  try {
    const { pool_id } = params;
    const body: SwapIntentRequest = await request.json();
    const { swap_type, input_amount, slippage_tolerance_bps } = body;

    if (!swap_type || !input_amount) {
      return NextResponse.json(
        { error: 'Missing required fields: swap_type, input_amount' },
        { status: 400 }
      );
    }

    if (swap_type !== 'BUY' && swap_type !== 'SELL') {
      return NextResponse.json(
        { error: 'Invalid swap_type. Must be BUY or SELL' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get pool
    const { data: pool, error: poolError } = await supabase
      .from('bonding_pools')
      .select('*')
      .eq('id', pool_id)
      .single();

    if (poolError || !pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    // Verify pool is LIVE
    if (pool.status !== 'LIVE') {
      return NextResponse.json(
        { error: `Pool must be LIVE to swap. Current status: ${pool.status}` },
        { status: 400 }
      );
    }

    // Calculate swap using AMM
    try {
      const quote = generateSwapQuote(
        swap_type,
        input_amount,
        pool.virtual_sol_reserves,
        pool.virtual_token_reserves,
        pool.swap_fee_bps,
        slippage_tolerance_bps || DEFAULT_SLIPPAGE_BPS
      );

      // Generate intent ID
      const intentId = `swap_${pool_id}_${user.id}_${Date.now()}`;
      const expiresAt = new Date(Date.now() + INTENT_EXPIRY_SECONDS * 1000);

      // TODO: Store intent in cache/database with expiry

      const response: SwapIntentResponse = {
        intent_id: intentId,
        estimated_output: quote.output_amount,
        price_per_token: quote.price_per_token,
        swap_fee: ((BigInt(input_amount) * BigInt(pool.swap_fee_bps)) / 10000n).toString(),
        treasury_fee: quote.treasury_fee,
        referral_pool_fee: quote.referral_pool_fee,
        minimum_output: quote.minimum_output,
        expires_at: expiresAt.toISOString(),
      };

      return NextResponse.json(response);
    } catch (ammError) {
      console.error('AMM calculation error:', ammError);
      return NextResponse.json(
        { error: ammError instanceof Error ? ammError.message : 'AMM calculation failed' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Swap intent error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
