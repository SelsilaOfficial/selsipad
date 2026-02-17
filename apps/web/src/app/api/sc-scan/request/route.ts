import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/sc-scan/request
 * Request smart contract security scan
 */
export const dynamic = 'force-dynamic';

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
    const { project_id, contract_address, chain, scan_provider } = body;

    // Validation
    if (!project_id || !contract_address || !chain || !scan_provider) {
      return NextResponse.json(
        {
          error: 'project_id, contract_address, chain, and scan_provider are required',
        },
        { status: 400 }
      );
    }

    // Verify project ownership or admin
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_user_id')
      .eq('id', project_id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // TODO: Check admin via RBAC
    const isOwner = project.owner_user_id === user.id;
    if (!isOwner) {
      return NextResponse.json({ error: 'Only project owner can request scan' }, { status: 403 });
    }

    // Create scan request
    const { data: scanRequest, error: createError } = await supabase
      .from('sc_scan_results')
      .insert({
        project_id,
        contract_address,
        chain,
        scan_provider,
        status: 'PENDING',
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating scan request:', createError);
      return NextResponse.json({ error: 'Failed to request scan' }, { status: 500 });
    }

    // TODO: Integrate with external scan API (CertiK, Hacken, etc.)
    // For now, just create the pending entry

    return NextResponse.json(
      {
        scan_request: scanRequest,
        message: `Scan request submitted to ${scan_provider}. Results will be available via webhook.`,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
