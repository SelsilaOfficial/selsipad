import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateSuccessGating } from '@selsipad/shared';
import { requireAdmin } from '@/lib/auth/require-admin';
import { ethers } from 'ethers';
import { PRESALE_ROUND_ABI } from '@/lib/web3/presale-contracts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RPC_BY_CHAIN: Record<string, string> = {
  '97': process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
  '56': process.env.BSC_MAINNET_RPC_URL || 'https://bsc-dataseed.binance.org',
};

/**
 * POST /api/admin/rounds/[id]/mark-success
 * Mark round as SUCCESS (admin only). For PRESALE with on-chain round, verifies contract status.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminResult = await requireAdmin(request);
    if (adminResult instanceof NextResponse) return adminResult;

    // Get round
    const { data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .select('*')
      .eq('id', params.id)
      .single();

    if (roundError || !round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // Check if already marked
    if (round.success_gated_at) {
      return NextResponse.json(
        {
          error: 'Round already marked as SUCCESS',
          success_gated_at: round.success_gated_at,
        },
        { status: 400 }
      );
    }

    const roundAddress = round.round_address || round.contract_address;
    const chain = String(round.chain || '97');

    if (round.type === 'PRESALE' && roundAddress) {
      const rpcUrl = RPC_BY_CHAIN[chain];
      if (rpcUrl) {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const roundContract = new ethers.Contract(roundAddress, PRESALE_ROUND_ABI as any, provider);
        const onChainStatus = await roundContract.status().catch(() => null);
        if (onChainStatus !== null && Number(onChainStatus) !== 4) {
          // V2.4: FINALIZED_SUCCESS = 4
          return NextResponse.json(
            { error: 'On-chain round status is not FINALIZED_SUCCESS; cannot mark success' },
            { status: 400 }
          );
        }
      }
    }

    const gateValidation = validateSuccessGating(
      round.result || 'NONE',
      round.vesting_status || 'NONE',
      round.lock_status || 'NONE'
    );

    if (!gateValidation.passed) {
      return NextResponse.json(
        {
          error: 'Cannot mark as SUCCESS: Not all gates passed',
          missing_requirements: gateValidation.missing,
          gates: {
            round_success: round.result === 'SUCCESS',
            vesting_confirmed: round.vesting_status === 'CONFIRMED',
            lock_confirmed: round.lock_status === 'LOCKED',
          },
        },
        { status: 400 }
      );
    }

    // Mark round as SUCCESS
    const successGatedAt = new Date().toISOString();
    const { data: updatedRound, error: updateError } = await supabase
      .from('launch_rounds')
      .update({ success_gated_at: successGatedAt })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error marking success:', updateError);
      return NextResponse.json({ error: 'Failed to mark as SUCCESS' }, { status: 500 });
    }

    // TODO: Trigger badge awards
    // TODO: Trigger project milestone notifications
    // TODO: Write audit log

    return NextResponse.json({
      round: updatedRound,
      success_gated_at: successGatedAt,
      message: 'Round marked as SUCCESS - all gates passed!',
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
