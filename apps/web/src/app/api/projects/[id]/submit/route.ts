import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/projects/[id]/submit
 * Submit project for review (owner only)
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Check if user is owner
    if (project.owner_user_id !== user.id) {
      return NextResponse.json({ error: 'Only project owner can submit' }, { status: 403 });
    }

    // Check if project is in DRAFT status
    if (project.status !== 'DRAFT') {
      return NextResponse.json(
        {
          error: `Cannot submit project in ${project.status} status`,
        },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!project.name || !project.symbol || !project.description || !project.website) {
      return NextResponse.json(
        {
          error: 'Missing required fields: name, symbol, description, and website are required',
        },
        { status: 400 }
      );
    }

    // Update status to SUBMITTED
    const { data: updatedProject, error: updateError } = await supabase
      .from('projects')
      .update({
        status: 'SUBMITTED',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error submitting project:', updateError);
      return NextResponse.json({ error: 'Failed to submit project' }, { status: 500 });
    }

    return NextResponse.json({
      project: updatedProject,
      message: 'Project submitted for review successfully',
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
