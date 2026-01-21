import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';
import { calculateClaimableAmount, generateClaimIdempotencyKey } from '@/lib/vesting/claim-utils';
import type { VestingAllocation, VestingSchedule } from '@/lib/vesting/claim-utils';

/**
 * POST /api/vesting/claim
 *
 * Claim available vesting tokens
 *
 * Body: {
 *   allocationId: string;
 *   amount: string; // Amount to claim (as string to handle BigInt)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { allocationId, amount } = body;

    if (!allocationId || !amount) {
      return NextResponse.json({ error: 'Missing allocationId or amount' }, { status: 400 });
    }

    const supabase = createClient();

    // Fetch allocation
    const { data: allocation, error: allocationError } = await supabase
      .from('vesting_allocations')
      .select('*')
      .eq('id', allocationId)
      .single();

    if (allocationError || !allocation) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
    }

    // Verify ownership
    if (allocation.user_id !== session.userId) {
      return NextResponse.json({ error: 'Forbidden - not your allocation' }, { status: 403 });
    }

    // Fetch vesting schedule
    const { data: schedule, error: scheduleError } = await supabase
      .from('vesting_schedules')
      .select('*')
      .eq('id', allocation.schedule_id)
      .single();

    if (scheduleError || !schedule) {
      return NextResponse.json({ error: 'Vesting schedule not found' }, { status: 404 });
    }

    // Calculate claimable amount
    const result = calculateClaimableAmount(
      allocation as VestingAllocation,
      schedule as VestingSchedule
    );

    const requestedAmount = BigInt(amount);

    // Validate request amount
    if (requestedAmount > result.claimable) {
      return NextResponse.json(
        {
          error: 'Requested amount exceeds claimable amount',
          claimable: result.claimable.toString(),
          requested: requestedAmount.toString(),
        },
        { status: 400 }
      );
    }

    if (requestedAmount <= 0n) {
      return NextResponse.json({ error: 'Claim amount must be greater than 0' }, { status: 400 });
    }

    // Generate idempotency key
    const idempotencyKey = generateClaimIdempotencyKey(allocationId);

    // Check for duplicate claim (idempotency)
    const { data: existingClaim } = await supabase
      .from('vesting_claims')
      .select('id, status, claim_amount')
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (existingClaim) {
      // Duplicate claim detected
      return NextResponse.json({
        success: false,
        error: 'Duplicate claim detected (hourly limit)',
        existingClaim: {
          id: existingClaim.id,
          status: existingClaim.status,
          amount: existingClaim.claim_amount,
        },
      });
    }

    // TODO: Get wallet address from session/profile
    // For now, using placeholder
    const walletAddress = session.address || 'UNKNOWN';

    // Create claim record
    const { data: claimRecord, error: claimError } = await supabase
      .from('vesting_claims')
      .insert({
        allocation_id: allocationId,
        user_id: session.userId,
        claim_amount: requestedAmount.toString(),
        chain: schedule.chain,
        wallet_address: walletAddress,
        status: 'PENDING',
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    if (claimError) {
      console.error('Error creating claim record:', claimError);
      return NextResponse.json({ error: 'Failed to create claim record' }, { status: 500 });
    }

    // TODO: Execute blockchain transaction here
    // For MVP, we'll mark as CONFIRMED immediately
    // In production, this should:
    // 1. Create transaction via transaction manager
    // 2. Wait for confirmation
    // 3. Update claim status

    const txHash = `0x${Date.now().toString(16)}`; // Mock tx hash for now

    // Update claim with tx hash and status
    const { error: updateError } = await supabase
      .from('vesting_claims')
      .update({
        tx_hash: txHash,
        status: 'CONFIRMED',
      })
      .eq('id', claimRecord.id);

    if (updateError) {
      console.error('Error updating claim:', updateError);
    }

    // Update allocation claimed amount
    const newClaimedTotal = BigInt(allocation.claimed_tokens) + requestedAmount;

    const { error: allocationUpdateError } = await supabase
      .from('vesting_allocations')
      .update({
        claimed_tokens: newClaimedTotal.toString(),
        last_claim_at: new Date().toISOString(),
        total_claims: allocation.total_claims + 1,
      })
      .eq('id', allocationId);

    if (allocationUpdateError) {
      console.error('Error updating allocation:', allocationUpdateError);
      // Note: Claim record exists but allocation not updated
      // This should be handled by a reconciliation job
    }

    return NextResponse.json({
      success: true,
      data: {
        claimId: claimRecord.id,
        amount: requestedAmount.toString(),
        txHash,
        status: 'CONFIRMED',
        newClaimedTotal: newClaimedTotal.toString(),
        remainingClaimable: (result.claimable - requestedAmount).toString(),
      },
    });
  } catch (error: any) {
    console.error('Error processing claim:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
