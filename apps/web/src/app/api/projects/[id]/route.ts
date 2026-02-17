import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/projects/[id]
 * Get project details with badges and scan results
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: project, error } = await supabase
      .from('projects')
      .select(
        `
        *,
        project_badges (
          awarded_at,
          reason,
          badge_definitions (
            badge_key,
            name,
            description,
            icon_url,
            badge_type
          )
        ),
        sc_scan_results (
          id,
          contract_address,
          chain,
          scan_provider,
          score,
          status,
          report_url,
          scan_completed_at
        )
      `
      )
      .eq('id', params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      console.error('Error fetching project:', error);
      return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
    }

    return NextResponse.json({ project });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/[id]
 * Update project (owner or admin only)
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Get project
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check permissions: must be owner or admin
    const isOwner = project.owner_user_id === user.id;
    // TODO: Check admin role via RBAC
    const isAdmin = false; // Placeholder

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    // Owners can only update DRAFT projects
    if (isOwner && !isAdmin && project.status !== 'DRAFT') {
      return NextResponse.json(
        {
          error: 'Can only update DRAFT projects. Submit for review once ready.',
        },
        { status: 403 }
      );
    }

    // Prevent non-admins from changing status
    if (!isAdmin && body.status) {
      return NextResponse.json(
        {
          error: 'Only admins can change project status',
        },
        { status: 403 }
      );
    }

    // Build update object (only allow certain fields)
    const allowedFields = [
      'name',
      'symbol',
      'description',
      'logo_url',
      'banner_url',
      'website',
      'twitter',
      'telegram',
      'chains_supported',
    ];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Admins can update additional fields
    if (isAdmin) {
      if (body.status) updates.status = body.status;
      if (body.rejection_reason) updates.rejection_reason = body.rejection_reason;
    }

    // Update project
    const { data: updatedProject, error: updateError } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating project:', updateError);
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }

    return NextResponse.json({ project: updatedProject });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]
 * Soft delete project (owner or admin with DELETE_PROJECT permission)
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Get project
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check permissions
    const isOwner = project.owner_user_id === user.id;
    // TODO: Check admin role and DELETE_PROJECT permission
    const isAdmin = false;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft delete: set status to REJECTED
    const { error: deleteError } = await supabase
      .from('projects')
      .update({
        status: 'REJECTED',
        rejection_reason: 'Deleted by owner',
      })
      .eq('id', params.id);

    if (deleteError) {
      console.error('Error deleting project:', deleteError);
      return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
