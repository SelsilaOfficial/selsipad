import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateCreatePool, PoolValidationError, checkPoolEligibility } from '@selsipad/shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/projects/[projectId]/rounds
 * Create a new launch round for a project
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
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

    // Get request body
    const body = await request.json();

    // Validate request
    let poolData;
    try {
      poolData = validateCreatePool({
        ...body,
        project_id: params.projectId,
      });
    } catch (err) {
      if (err instanceof PoolValidationError) {
        return NextResponse.json({ error: err.message, field: err.field }, { status: 400 });
      }
      throw err;
    }

    // Check if user owns the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_user_id, kyc_status, sc_scan_status')
      .eq('id', params.projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.owner_user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check project eligibility (KYC + SC Scan)
    const eligibility = checkPoolEligibility(project);
    if (!eligibility.is_eligible) {
      return NextResponse.json(
        {
          error: 'Project not eligible to create pool',
          reasons: eligibility.reasons,
        },
        { status: 400 }
      );
    }

    // Create launch round
    const { data: round, error: createError } = await supabase
      .from('launch_rounds')
      .insert({
        project_id: params.projectId,
        type: poolData.type,
        chain: poolData.chain,
        token_address: poolData.token_address,
        raise_asset: poolData.raise_asset,
        start_at: poolData.start_at,
        end_at: poolData.end_at,
        params: poolData.params,
        status: 'DRAFT',
        created_by: user.id,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating launch round:', createError);
      return NextResponse.json({ error: 'Failed to create launch round' }, { status: 500 });
    }

    return NextResponse.json({ round }, { status: 201 });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/projects/[projectId]/rounds
 * List all launch rounds for a project
 */
export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    // Optional auth - public can see approved/live rounds, owners see all
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Check if user owns project
    const { data: project } = await supabase
      .from('projects')
      .select('owner_user_id')
      .eq('id', params.projectId)
      .single();

    const isOwner = project && userId === project.owner_user_id;

    // Build query
    let query = supabase
      .from('launch_rounds')
      .select('*')
      .eq('project_id', params.projectId)
      .order('created_at', { ascending: false });

    // Filter by status if not owner
    if (!isOwner) {
      query = query.in('status', ['APPROVED', 'LIVE', 'ENDED', 'FINALIZED']);
    }

    const { data: rounds, error } = await query;

    if (error) {
      console.error('Error fetching rounds:', error);
      return NextResponse.json({ error: 'Failed to fetch rounds' }, { status: 500 });
    }

    return NextResponse.json({ rounds });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
