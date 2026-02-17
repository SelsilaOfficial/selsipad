import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * PATCH /api/admin/kyc/[id]/review
 * Admin review KYC submission
 * Requires: REVIEW_KYC permission
 */
export const dynamic = 'force-dynamic';

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

    // TODO: Check RBAC - REVIEW_KYC permission
    // For now, check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { status, rejection_reason } = body;

    // Validation
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        {
          error: 'status must be APPROVED or REJECTED',
        },
        { status: 400 }
      );
    }

    if (status === 'REJECTED' && !rejection_reason) {
      return NextResponse.json(
        {
          error: 'rejection_reason required when rejecting',
        },
        { status: 400 }
      );
    }

    // Get submission
    const { data: submission, error: fetchError } = await supabase
      .from('kyc_submissions')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Update submission
    const { data: updated, error: updateError } = await supabase
      .from('kyc_submissions')
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: status === 'REJECTED' ? rejection_reason : null,
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating KYC submission:', updateError);
      return NextResponse.json({ error: 'Failed to review KYC' }, { status: 500 });
    }

    // Log audit event
    await supabase.from('audit_logs').insert({
      actor_admin_id: user.id,
      action: `KYC_${status}`,
      entity_type: 'kyc_submission',
      entity_id: params.id,
      after_data: { status, rejection_reason },
    });

    return NextResponse.json({
      submission: updated,
      message: `KYC ${status.toLowerCase()} successfully`,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
