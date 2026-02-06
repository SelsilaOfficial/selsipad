import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateRefundClaim, PoolValidationError } from '@selsipad/shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/rounds/[id]/refund/claim
 * Claim refund for failed or canceled round
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Parse and validate request body
    const body = await request.json();
    try {
      validateRefundClaim(body);
    } catch (err) {
      if (err instanceof PoolValidationError) {
        return NextResponse.json({ error: err.message, field: err.field }, { status: 400 });
      }
      throw err;
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

    // Verify round is in refundable state (support both spellings)
    const refundableResults = ['FAILED', 'CANCELLED', 'CANCELED'];
    if (!refundableResults.includes(round.result)) {
      return NextResponse.json(
        {
          error: `Round must be FAILED or CANCELLED/CANCELED to claim refund (current: ${round.result})`,
        },
        { status: 400 }
      );
    }

    // Get user's wallet address (support wallet-only auth)
    let walletAddress: string;

    // Try to get wallet from authenticated user
    const { data: profile } = await supabase
      .from('profiles')
      .select('primary_wallet')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.primary_wallet) {
      walletAddress = profile.primary_wallet;
    } else {
      // Fallback: get from request header for wallet-only flow
      walletAddress = request.headers.get('x-wallet-address') || '';
      if (!walletAddress) {
        return NextResponse.json({ error: 'Wallet address required for refund' }, { status: 400 });
      }
    }

    // Get user's total contributions by wallet_address (not user_id)
    const { data: contributions } = await supabase
      .from('contributions')
      .select('*')
      .eq('round_id', params.id)
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('status', 'CONFIRMED');

    if (!contributions || contributions.length === 0) {
      return NextResponse.json(
        { error: 'No confirmed contributions found for this round' },
        { status: 404 }
      );
    }

    const totalRefundAmount = contributions.reduce(
      (sum, c) => sum + parseFloat(c.amount.toString()),
      0
    );

    // Check for existing refund
    const { data: existingRefund } = await supabase
      .from('refunds')
      .select('*')
      .eq('round_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingRefund) {
      if (existingRefund.status === 'COMPLETED') {
        return NextResponse.json({ error: 'Refund already completed' }, { status: 409 });
      }
      if (existingRefund.status === 'PROCESSING') {
        return NextResponse.json(
          { error: 'Refund already in progress', refund: existingRefund },
          { status: 409 }
        );
      }
    }

    // Get primary wallet from most recent contribution
    const primaryWallet = contributions.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0].wallet_address;

    // Create idempotency key
    const idempotencyKey = `REFUND:${params.id}:${user.id}`;

    // Create or update refund record
    const refundData = {
      round_id: params.id,
      user_id: user.id,
      amount: totalRefundAmount,
      status: 'PENDING',
      chain: round.chain,
      idempotency_key: idempotencyKey,
    };

    let refund;
    if (existingRefund) {
      const { data: updated, error: updateError } = await supabase
        .from('refunds')
        .update({ status: 'PENDING' })
        .eq('id', existingRefund.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating refund:', updateError);
        return NextResponse.json({ error: 'Failed to process refund' }, { status: 500 });
      }
      refund = updated;
    } else {
      const { data: created, error: createError } = await supabase
        .from('refunds')
        .insert(refundData)
        .select()
        .single();

      if (createError) {
        console.error('Error creating refund:', createError);

        // Check if it's a duplicate key error
        if (createError.code === '23505') {
          return NextResponse.json({ error: 'Refund request already exists' }, { status: 409 });
        }

        return NextResponse.json({ error: 'Failed to create refund request' }, { status: 500 });
      }
      refund = created;
    }

    // In production, this would create a transaction intent for the user to sign
    // For now, we return the refund record
    return NextResponse.json({
      refund,
      wallet_address: primaryWallet,
      amount: totalRefundAmount,
      message: 'Refund request created. Please sign the transaction.',
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
