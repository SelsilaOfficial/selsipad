import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/projects
 * List projects with filtering and pagination
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const owner_user_id = searchParams.get('owner_user_id');
    const kyc_status = searchParams.get('kyc_status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    let query = supabase.from('projects').select(
      `
        *,
        project_badges (
          badge_id,
          awarded_at,
          badge_definitions (
            badge_key,
            name,
            icon_url,
            badge_type
          )
        )
      `,
      { count: 'exact' }
    );

    // Apply filters
    if (status) query = query.eq('status', status);
    if (owner_user_id) query = query.eq('owner_user_id', owner_user_id);
    if (kyc_status) query = query.eq('kyc_status', kyc_status);

    // Pagination and ordering
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching projects:', error);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    return NextResponse.json({
      projects: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projects
 * Create a new project (DRAFT status)
 */
export async function POST(request: NextRequest) {
  try {
    // Get user from auth header
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

    const body = await request.json();
    const {
      name,
      symbol,
      description,
      logo_url,
      banner_url,
      website,
      twitter,
      telegram,
      chains_supported,
    } = body;

    // Validation
    if (!name || name.length < 3 || name.length > 100) {
      return NextResponse.json({ error: 'Name must be between 3-100 characters' }, { status: 400 });
    }

    if (symbol && (symbol.length < 2 || symbol.length > 10 || symbol !== symbol.toUpperCase())) {
      return NextResponse.json(
        { error: 'Symbol must be 2-10 uppercase characters' },
        { status: 400 }
      );
    }

    // Create project
    const { data: project, error: createError } = await supabase
      .from('projects')
      .insert({
        owner_user_id: user.id,
        name,
        symbol,
        description,
        logo_url,
        banner_url,
        website,
        twitter,
        telegram,
        chains_supported: chains_supported || [],
        status: 'DRAFT',
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating project:', createError);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
