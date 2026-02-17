import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/badges/[userId]
 *
 * Fetch user's active badges
 *
 * Query params:
 * - limit: number (default 10, max 50)
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const { userId } = params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    const supabase = createClient();

    // Use the database function to get active badges
    const { data, error } = await supabase.rpc('get_user_active_badges', {
      target_user_id: userId,
    });

    if (error) {
      console.error('Error fetching badges:', error);
      return NextResponse.json({ error: 'Failed to fetch badges' }, { status: 500 });
    }

    // Map to frontend format and apply limit
    const badges = (data || []).slice(0, limit).map((badge: any) => ({
      key: badge.badge_key,
      display_name: badge.badge_name,
      description: badge.badge_description,
      icon_url: badge.icon_url,
      category: badge.badge_type,
      awarded_at: badge.awarded_at,
    }));

    return NextResponse.json({
      success: true,
      badges,
      total: badges.length,
    });
  } catch (error: any) {
    console.error('Error in GET /api/badges/[userId]:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
