import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/badges/[projectId]
 * Get all badges awarded to a project
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const { data: badges, error } = await supabase
      .from('project_badges')
      .select(
        `
        *,
        badge_definitions (
          badge_key,
          name,
          description,
          icon_url,
          badge_type
        )
      `
      )
      .eq('project_id', params.projectId)
      .order('awarded_at', { ascending: false });

    if (error) {
      console.error('Error fetching project badges:', error);
      return NextResponse.json({ error: 'Failed to fetch badges' }, { status: 500 });
    }

    return NextResponse.json({ badges });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
