import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/rounds/[id]/refund/quote
 * Get refund eligibility and quote amount
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get authenticated user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get round details
    const { data: round, error: fetchError } = await supabase
      .from('launch_rounds')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // Check if refund is available
    const refundableResults = ['FAILED', 'CANCELED', 'CANCELLED'];
    if (!refundableResults.includes(round.result)) {
      return NextResponse.json({
        is_eligible: false,
        refund_amount: 0,
        reason: `Refunds only available for FAILED or CANCELED/CANCELLED rounds (current: ${round.result})`,
        primary_wallet: null,
      });
    }

    // Get user's confirmed contributions
    const { data: contributions } = await supabase
      .from('contributions')
      .select('*')
      .eq('round_id', params.id)
      .eq('user_id', user.id)
      .eq('status', 'CONFIRMED');

    if (!contributions || contributions.length === 0) {
      return NextResponse.json({
        is_eligible: false,
        refund_amount: 0,
        reason: 'No confirmed contributions found',
        primary_wallet: null,
      });
    }

    // Calculate total refund amount
    const totalRefundAmount = contributions.reduce(
      (sum, c) => sum + parseFloat(c.amount.toString()),
      0
    );

    // Check if already refunded
    const { data: existingRefund } = await supabase
      .from('refunds')
      .select('*')
      .eq('round_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingRefund && ['COMPLETED', 'PROCESSING'].includes(existingRefund.status)) {
      return NextResponse.json({
        is_eligible: false,
        refund_amount: 0,
        reason: `Refund already ${existingRefund.status.toLowerCase()}`,
        primary_wallet: existingRefund.wallet_address || contributions[0].wallet_address,
      });
    }

    // Get primary wallet (most recent contribution)
    const primaryWallet = contributions.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0].wallet_address;

    return NextResponse.json({
      is_eligible: true,
      refund_amount: totalRefundAmount,
      reason: null,
      primary_wallet: primaryWallet,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
