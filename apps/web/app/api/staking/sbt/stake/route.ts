import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';

/**
 * POST /api/staking/sbt/stake
 *
 * Stake an SBT (database-only, no actual token transfer)
 *
 * Body: {
 *   sbtContract: string;
 *   tokenId: string;
 *   chain: string;
 *   walletAddress: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sbtContract, tokenId, chain, walletAddress } = body;

    if (!sbtContract || !tokenId || !chain || !walletAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createClient();

    // Verify SBT ownership first
    const { data: verified } = await supabase
      .from('sbt_ownership_cache')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('sbt_contract', sbtContract)
      .eq('token_id', tokenId)
      .eq('is_valid', true)
      .single();

    if (!verified) {
      return NextResponse.json(
        { error: 'SBT ownership not verified. Please verify first.' },
        { status: 403 }
      );
    }

    // Check if already staked
    const { data: existingStake } = await supabase
      .from('staking_positions')
      .select('*')
      .eq('user_id', session.userId)
      .eq('sbt_token_id', tokenId)
      .eq('status', 'ACTIVE')
      .single();

    if (existingStake) {
      return NextResponse.json({ error: 'SBT already staked' }, { status: 400 });
    }

    // Create staking position
    const { data: position, error: stakeError } = await supabase
      .from('staking_positions')
      .insert({
        user_id: session.userId,
        wallet_address: walletAddress,
        sbt_token_id: tokenId,
        sbt_contract: sbtContract,
        chain,
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (stakeError) {
      console.error('Error creating stake:', stakeError);
      return NextResponse.json({ error: 'Failed to stake SBT' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        positionId: position.id,
        stakedAt: position.staked_at,
        status: position.status,
      },
    });
  } catch (error: any) {
    console.error('Error staking SBT:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
