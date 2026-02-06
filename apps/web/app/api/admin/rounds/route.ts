import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/rounds
 * List rounds for admin review
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user (admin check would be done via middleware in production)
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

    // TODO: Check admin role (RBAC)
    // For now, assuming user is admin

    // Get query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'SUBMITTED_FOR_REVIEW';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Get rounds with project details
    const {
      data: rounds,
      error,
      count,
    } = await supabase
      .from('launch_rounds')
      .select(
        `
        *,
        projects (
          name,
          symbol,
          logo_url,
          kyc_status,
          sc_scan_status
        )
      `,
        { count: 'exact' }
      )
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching rounds:', error);
      return NextResponse.json({ error: 'Failed to fetch rounds' }, { status: 500 });
    }

    return NextResponse.json({
      rounds,
      total: count || 0,
      page,
      limit,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
