import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/rounds/[id]/contributions/me
 * Get user's contributions for a round
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

    // Get user's contributions
    const { data: contributions, error } = await supabase
      .from('contributions')
      .select('*')
      .eq('round_id', params.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contributions:', error);
      return NextResponse.json({ error: 'Failed to fetch contributions' }, { status: 500 });
    }

    // Calculate total contributed
    const totalContributed = contributions
      .filter((c) => c.status === 'CONFIRMED')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    // Get allocation if round is finalized
    const { data: allocation } = await supabase
      .from('round_allocations')
      .select('*')
      .eq('round_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();

    return NextResponse.json({
      contributions,
      total_contributed: totalContributed,
      allocation,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
