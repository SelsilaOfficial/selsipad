/**
 * GET /api/v1/trending
 * Returns Top 10/50 projects from latest snapshot
 * Cache-Control: 60 seconds
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60; // Next.js ISR/Cache

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // 1. Get Latest Snapshot
    const { data: snapshot } = await supabase
      .from('trending_snapshots')
      .select('id, computed_at')
      .order('computed_at', { ascending: false })
      .limit(1)
      .single();

    if (!snapshot) {
      return NextResponse.json({ trending: [] });
    }

    // 2. Fetch Projects for this snapshot
    const { data: trending } = await supabase
      .from('trending_projects')
      .select(
        `
        rank,
        score,
        post_count_24h,
        comment_count_24h,
        project:projects ( id, name, symbol, logo_url, status )
      `
      )
      .eq('snapshot_id', snapshot.id)
      .order('rank', { ascending: true })
      .limit(10); // Widget limit

    return NextResponse.json(
      {
        computed_at: snapshot.computed_at,
        trending: trending || [],
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        },
      }
    );
  } catch (error) {
    console.error('Trending API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
