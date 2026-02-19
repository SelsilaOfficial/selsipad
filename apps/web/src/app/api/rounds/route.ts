import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateCreatePool, PoolValidationError } from '@selsipad/shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/rounds
 * List launch rounds with filters and pagination
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Query parameters
    const network = searchParams.get('network'); // 'EVM' or 'SOLANA' or specific chain
    const status = searchParams.get('status');
    const type = searchParams.get('type'); // 'PRESALE' or 'FAIRLAUNCH'
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase.from('launch_rounds').select(
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
    );

    // Apply filters
    if (network) {
      if (network === 'SOLANA') {
        query = query.eq('chain', 'SOLANA');
      } else if (network === 'EVM') {
        query = query.neq('chain', 'SOLANA');
      } else {
        // Specific chain ID
        query = query.eq('chain', network);
      }
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (type) {
      query = query.eq('type', type);
    }

    if (search) {
      // Search in project name via join (using projects.name)
      // Note: For better search, this should use full-text search
      query = query.ilike('projects.name', `%${search}%`);
    }

    // Only show public rounds for non-authenticated requests
    // Authenticated users will see their own rounds regardless of status
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // If not authenticated, only show public rounds
    if (!userId) {
      query = query.in('status', ['APPROVED', 'DEPLOYED', 'ACTIVE', 'LIVE', 'ENDED', 'FINALIZED']);
    }

    // Order and paginate
    const {
      data: rounds,
      error,
      count,
    } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching rounds:', error);
      return NextResponse.json({ error: 'Failed to fetch rounds' }, { status: 500 });
    }

    return NextResponse.json({
      rounds: rounds || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/rounds
 * Create new launch round in DRAFT status
 */
export async function POST(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json();
    let validatedData;
    try {
      validatedData = validateCreatePool(body);
    } catch (err) {
      if (err instanceof PoolValidationError) {
        return NextResponse.json({ error: err.message, field: err.field }, { status: 400 });
      }
      throw err;
    }

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, owner_user_id, kyc_status, sc_scan_status')
      .eq('id', validatedData.project_id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.owner_user_id !== user.id) {
      return NextResponse.json({ error: 'You do not own this project' }, { status: 403 });
    }

    // Create round in DRAFT status
    const { data: round, error: createError } = await supabase
      .from('launch_rounds')
      .insert({
        project_id: validatedData.project_id,
        type: validatedData.type,
        chain: validatedData.chain,
        token_address: validatedData.token_address,
        raise_asset: validatedData.raise_asset,
        start_at: validatedData.start_at,
        end_at: validatedData.end_at,
        params: validatedData.params,
        status: 'DRAFT',
        result: 'NONE',
        created_by: user.id,
        // Snapshot compliance status at creation
        kyc_status_at_submit: project.kyc_status,
        scan_status_at_submit: project.sc_scan_status,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating round:', createError);
      return NextResponse.json({ error: 'Failed to create round' }, { status: 500 });
    }

    return NextResponse.json({ round }, { status: 201 });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
