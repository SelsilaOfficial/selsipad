import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/kyc/submit
 * Submit KYC documents for verification
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
    const { submission_type, project_id, documents_url } = body;

    // Validation
    if (!submission_type || !['INDIVIDUAL', 'BUSINESS'].includes(submission_type)) {
      return NextResponse.json(
        {
          error: 'submission_type must be INDIVIDUAL or BUSINESS',
        },
        { status: 400 }
      );
    }

    if (!documents_url) {
      return NextResponse.json({ error: 'documents_url is required' }, { status: 400 });
    }

    // If project_id provided, verify ownership
    if (project_id) {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('owner_user_id')
        .eq('id', project_id)
        .single();

      if (projectError || !project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      if (project.owner_user_id !== user.id) {
        return NextResponse.json({ error: 'Not project owner' }, { status: 403 });
      }
    }

    // Create KYC submission
    const { data: submission, error: createError } = await supabase
      .from('kyc_submissions')
      .insert({
        user_id: user.id,
        project_id,
        submission_type,
        documents_url,
        status: 'PENDING',
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating KYC submission:', createError);
      return NextResponse.json({ error: 'Failed to submit KYC' }, { status: 500 });
    }

    return NextResponse.json(
      {
        submission,
        message: 'KYC documents submitted successfully. Review typically takes 1-3 business days.',
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
