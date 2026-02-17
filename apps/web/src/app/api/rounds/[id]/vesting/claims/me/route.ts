import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/rounds/[id]/vesting/claims/me
 * Get user's claim history
 */
export const dynamic = 'force-dynamic';

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

    // Get user's allocation
    const { data: allocation } = await supabase
      .from('vesting_allocations')
      .select('id, allocation_tokens, claimed_tokens, total_claims')
      .eq('round_id', params.id)
      .eq('user_id', user.id)
      .single();

    if (!allocation) {
      return NextResponse.json({ error: 'No allocation found' }, { status: 404 });
    }

    // Get claims
    const { data: claims, error: claimsError } = await supabase
      .from('vesting_claims')
      .select('*')
      .eq('allocation_id', allocation.id)
      .order('created_at', { ascending: false });

    if (claimsError) {
      console.error('Error fetching claims:', claimsError);
      return NextResponse.json({ error: 'Failed to fetch claims' }, { status: 500 });
    }

    return NextResponse.json({
      allocation,
      claims: claims || [],
      total_claimed: allocation.claimed_tokens,
      total_claims: allocation.total_claims,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
