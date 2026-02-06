import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  validateContributionIntent,
  validatePoolStatus,
  validateContributionAmount,
  PoolValidationError,
} from '@selsipad/shared';
import type { PresaleParams } from '@selsipad/shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/rounds/[id]/contribute/intent
 * Create contribution intent (step 1 of 2-step flow)
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const roundId = params.id;

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
    let validatedData;
    try {
      validatedData = validateContributionIntent(body);
    } catch (err) {
      if (err instanceof PoolValidationError) {
        return NextResponse.json({ error: err.message, field: err.field }, { status: 400 });
      }
      throw err;
    }

    // Ensure payload round_id matches route round id
    if (validatedData.round_id !== roundId) {
      return NextResponse.json(
        { error: 'round_id mismatch', expected: roundId, received: validatedData.round_id },
        { status: 400 }
      );
    }

    // Get round details
    const { data: round, error: fetchError } = await supabase
      .from('launch_rounds')
      .select('*')
      .eq('id', roundId)
      .single();

    if (fetchError || !round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // Validate round is LIVE
    try {
      validatePoolStatus(round.status, ['LIVE'], 'contribute');
    } catch (err) {
      if (err instanceof PoolValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    // Check timing
    const now = new Date();
    const startAt = new Date(round.start_at);
    const endAt = new Date(round.end_at);

    if (now < startAt) {
      return NextResponse.json({ error: 'Round has not started yet' }, { status: 400 });
    }

    if (now > endAt) {
      return NextResponse.json({ error: 'Round has ended' }, { status: 400 });
    }

    // For PRESALE, validate contribution amount
    if (round.type === 'PRESALE') {
      const roundParams = round.params as PresaleParams;

      // Get user's total contributions so far
      const { data: userContributions } = await supabase
        .from('contributions')
        .select('amount')
        .eq('round_id', roundId)
        .eq('user_id', user.id)
        .eq('status', 'CONFIRMED');

      const userTotalContributed =
        userContributions?.reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0) || 0;

      try {
        validateContributionAmount(validatedData.amount, roundParams, userTotalContributed);
      } catch (err) {
        if (err instanceof PoolValidationError) {
          return NextResponse.json({ error: err.message }, { status: 400 });
        }
        throw err;
      }

      // Check if hardcap would be exceeded
      const totalRaised = parseFloat(round.total_raised.toString());
      if (totalRaised + validatedData.amount > roundParams.hardcap) {
        return NextResponse.json(
          {
            error: 'Contribution would exceed hardcap',
            available: roundParams.hardcap - totalRaised,
          },
          { status: 400 }
        );
      }
    }

    // Create contribution intent
    const intentId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // For now, we'll create a PENDING contribution record
    // In production, this would integrate with the transaction manager
    const { data: contribution, error: createError } = await supabase
      .from('contributions')
      .insert({
        id: intentId,
        round_id: roundId,
        user_id: user.id,
        wallet_address: validatedData.wallet_address,
        amount: validatedData.amount,
        chain: round.chain,
        tx_hash: '', // Will be updated on confirmation
        status: 'PENDING',
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating contribution intent:', createError);
      return NextResponse.json({ error: 'Failed to create contribution intent' }, { status: 500 });
    }

    // Return intent response
    // In production, this would include contract address, calldata, etc.
    return NextResponse.json({
      intent_id: intentId,
      round_id: roundId,
      amount: validatedData.amount,
      expires_at: expiresAt.toISOString(),
      // For EVM: contract_address, function signature, calldata
      // For Solana: program_id, instruction data
      chain: round.chain,
      raise_asset: round.raise_asset,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
