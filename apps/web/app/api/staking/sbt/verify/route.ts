import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';

/**
 * POST /api/staking/sbt/verify
 *
 * Verify SBT ownership on-chain and cache result
 *
 * Body: {
 *   walletAddress: string;
 *   sbtContract: string;
 *   tokenId: string;
 *   chain: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { walletAddress, sbtContract, tokenId, chain } = body;

    if (!walletAddress || !sbtContract || !tokenId || !chain) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createClient();

    // Check cache first
    const { data: cached } = await supabase
      .from('sbt_ownership_cache')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('sbt_contract', sbtContract)
      .eq('token_id', tokenId)
      .single();

    // Use cache if less than 1 hour old
    if (cached && cached.is_valid) {
      const cacheAge = Date.now() - new Date(cached.last_check_at).getTime();
      if (cacheAge < 60 * 60 * 1000) {
        return NextResponse.json({
          success: true,
          data: {
            isValid: cached.is_valid,
            tokenId: cached.token_id,
            verifiedAt: cached.verified_at,
            cached: true,
          },
        });
      }
    }

    // TODO: Verify on-chain
    // For now, mock verification (always valid)
    // In production, call blockchain RPC to verify ownership
    const isValid = true; // Mock: always valid
    const ownerAddress = walletAddress; // Mock

    // Update or insert cache
    const { data: cacheRecord, error: cacheError } = await supabase
      .from('sbt_ownership_cache')
      .upsert(
        {
          wallet_address: walletAddress,
          sbt_contract: sbtContract,
          token_id: tokenId,
          chain,
          is_valid: isValid,
          verified_at: new Date().toISOString(),
          last_check_at: new Date().toISOString(),
          owner_address: ownerAddress,
        },
        {
          onConflict: 'wallet_address,sbt_contract,token_id',
        }
      )
      .select()
      .single();

    if (cacheError) {
      console.error('Error caching SBT verification:', cacheError);
    }

    return NextResponse.json({
      success: true,
      data: {
        isValid,
        tokenId,
        verifiedAt: new Date().toISOString(),
        cached: false,
      },
    });
  } catch (error: any) {
    console.error('Error verifying SBT:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
