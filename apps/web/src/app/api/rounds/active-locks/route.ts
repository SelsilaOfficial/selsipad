import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/rounds/active-locks
 * List all active liquidity locks (public)
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const chain = url.searchParams.get('chain');
    const dexType = url.searchParams.get('dex_type');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

    // Build query
    let query = supabase
      .from('liquidity_locks')
      .select(
        `
        *,
        launch_rounds!inner(
          id,
          project_id,
          type,
          total_raised,
          projects!inner(
            name,
            token_symbol,
            logo_url
          )
        )
      `,
        { count: 'exact' }
      )
      .eq('status', 'LOCKED');

    // Apply filters
    if (chain) {
      query = query.eq('chain', chain);
    }

    if (dexType) {
      query = query.eq('dex_type', dexType);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const {
      data: locks,
      error,
      count,
    } = await query.range(from, to).order('locked_at', { ascending: false });

    if (error) {
      console.error('Error fetching locks:', error);
      return NextResponse.json({ error: 'Failed to fetch locks' }, { status: 500 });
    }

    // Calculate TVL (total value locked)
    const tvl = (locks || []).reduce((sum, lock) => {
      return sum + BigInt(lock.lock_amount || '0');
    }, 0n);

    return NextResponse.json({
      locks: locks || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
      tvl: tvl.toString(),
      total_locks: count || 0,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
