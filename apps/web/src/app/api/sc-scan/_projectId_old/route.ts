import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/sc-scan/[projectId]
 * Get latest scan results for a project
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const { data: scanResults, error } = await supabase
      .from('sc_scan_results')
      .select('*')
      .eq('project_id', params.projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching scan results:', error);
      return NextResponse.json({ error: 'Failed to fetch scan results' }, { status: 500 });
    }

    return NextResponse.json({ scan_results: scanResults });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
