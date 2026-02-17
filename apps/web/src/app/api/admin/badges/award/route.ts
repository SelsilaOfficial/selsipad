import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/badges/award
 * Manually award a badge to a project
 * Requires: MANAGE_BADGES permission
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

    // TODO: Check RBAC - MANAGE_BADGES permission
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { project_id, badge_id, reason } = body;

    // Validation
    if (!project_id || !badge_id) {
      return NextResponse.json({ error: 'project_id and badge_id are required' }, { status: 400 });
    }

    // Verify project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', project_id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify badge exists
    const { data: badge, error: badgeError } = await supabase
      .from('badge_definitions')
      .select('id, name')
      .eq('id', badge_id)
      .single();

    if (badgeError || !badge) {
      return NextResponse.json({ error: 'Badge not found' }, { status: 404 });
    }

    // Award badge
    const { data: award, error: awardError } = await supabase
      .from('project_badges')
      .insert({
        project_id,
        badge_id,
        awarded_by: user.id,
        reason,
      })
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
      .single();

    if (awardError) {
      if (awardError.code === '23505') {
        // Unique constraint violation
        return NextResponse.json(
          { error: 'Badge already awarded to this project' },
          { status: 400 }
        );
      }
      console.error('Error awarding badge:', awardError);
      return NextResponse.json({ error: 'Failed to award badge' }, { status: 500 });
    }

    // Log audit event
    await supabase.from('audit_logs').insert({
      actor_admin_id: user.id,
      action: 'BADGE_AWARDED',
      entity_type: 'project_badge',
      entity_id: award.id,
      after_data: { project_id, badge_id, badge_name: badge.name, reason },
    });

    return NextResponse.json(
      {
        award,
        message: `Badge "${badge.name}" awarded successfully`,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
