import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/badges/definitions
 * List all badge definitions
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: badges, error } = await supabase
      .from('badge_definitions')
      .select('*')
      .eq('is_active', true)
      .order('badge_type', { ascending: true });

    if (error) {
      console.error('Error fetching badge definitions:', error);
      return NextResponse.json({ error: 'Failed to fetch badges' }, { status: 500 });
    }

    return NextResponse.json({ badges });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
