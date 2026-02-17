import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateClaimConfirm, VestingValidationError } from '@selsipad/shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/rounds/[id]/vesting/claim-confirm
 * Confirm claim with transaction hash
 */
export const dynamic = 'force-dynamic';

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

    // Validate request body
    const body = await request.json();
    let confirmData;
    try {
      confirmData = validateClaimConfirm(body);
    } catch (err) {
      if (err instanceof VestingValidationError) {
        return NextResponse.json({ error: err.message, field: err.field }, { status: 400 });
      }
      throw err;
    }

    // Get vesting schedule
    const { data: schedule } = await supabase
      .from('vesting_schedules')
      .select('*, round_id')
      .eq('round_id', params.id)
      .single();

    if (!schedule) {
      return NextResponse.json({ error: 'Vesting schedule not found' }, { status: 404 });
    }

    // Check for duplicate transaction hash
    const { data: existingClaim } = await supabase
      .from('vesting_claims')
      .select('id')
      .eq('tx_hash', confirmData.tx_hash)
      .maybeSingle();

    if (existingClaim) {
      return NextResponse.json({ error: 'Transaction hash already used' }, { status: 400 });
    }

    // Get user's primary wallet (TODO: Implement wallet system)
    const primaryWallet = confirmData.wallet_address; // For now, trust user input

    // Create claim record with idempotency key
    const idempotencyKey = `claim_${user.id}_${confirmData.intent_id}`;

    const { data: createdClaim, error: claimError } = await supabase
      .from('vesting_claims')
      .insert({
        allocation_id: body.allocation_id, // From intent
        user_id: user.id,
        claim_amount: body.claim_amount, // From intent
        chain: schedule.chain,
        wallet_address: primaryWallet,
        tx_hash: confirmData.tx_hash,
        status: 'PENDING',
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    if (claimError) {
      if (claimError.code === '23505') {
        // Duplicate idempotency key
        const { data: existing } = await supabase
          .from('vesting_claims')
          .select('*')
          .eq('idempotency_key', idempotencyKey)
          .single();

        return NextResponse.json({
          claim: existing,
          message: 'Claim already submitted',
        });
      }

      console.error('Error creating claim:', claimError);
      return NextResponse.json({ error: 'Failed to create claim' }, { status: 500 });
    }

    // TODO: Trigger Tx Manager to verify transaction on-chain
    // Worker will update claim status once verified

    return NextResponse.json({
      claim: createdClaim,
      message: 'Claim submitted for verification',
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
