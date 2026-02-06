import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateUpdatePool, validatePoolStatus, PoolValidationError } from '@selsipad/shared';
import { getAuthUserId } from '@/lib/auth/require-admin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/rounds/[id]
 * Get launch round details with contributions
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Optional auth
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Get round with project details
    const { data: round, error } = await supabase
      .from('launch_rounds')
      .select(
        `
        *,
        projects (
          name,
          symbol,
          logo_url,
          kyc_status,
          sc_scan_status,
          owner_user_id
        )
      `
      )
      .eq('id', params.id)
      .single();

    if (error || !round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // Check access permissions
    const isOwner = round.projects.owner_user_id === userId;
    const isPublic = ['APPROVED', 'LIVE', 'ENDED', 'FINALIZED'].includes(round.status);

    if (!isOwner && !isPublic) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get user's contribution if authenticated
    let userContribution = null;
    if (userId) {
      const { data: contrib } = await supabase
        .from('contributions')
        .select('*')
        .eq('round_id', params.id)
        .eq('user_id', userId)
        .eq('status', 'CONFIRMED')
        .maybeSingle();

      userContribution = contrib;
    }

    return NextResponse.json({
      round,
      user_contribution: userContribution,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/rounds/[id]
 * Update launch round (only in DRAFT status)
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    let userId: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) userId = user.id;
    }
    if (!userId) userId = await getAuthUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get round
    const { data: round, error: fetchError } = await supabase
      .from('launch_rounds')
      .select('*, projects(owner_user_id)')
      .eq('id', params.id)
      .single();

    if (fetchError || !round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // Check ownership
    if (round.projects.owner_user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only allow updates in DRAFT status
    try {
      validatePoolStatus(round.status, ['DRAFT'], 'update');
    } catch (err) {
      if (err instanceof PoolValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    // Validate update data
    const body = await request.json();
    let updateData;
    try {
      updateData = validateUpdatePool(body);
    } catch (err) {
      if (err instanceof PoolValidationError) {
        return NextResponse.json({ error: err.message, field: err.field }, { status: 400 });
      }
      throw err;
    }

    // Update round
    const { data: updatedRound, error: updateError } = await supabase
      .from('launch_rounds')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating round:', updateError);
      return NextResponse.json({ error: 'Failed to update round' }, { status: 500 });
    }

    return NextResponse.json({ round: updatedRound });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/rounds/[id]
 * Cancel/delete launch round (only in DRAFT)
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Get round
    const { data: round, error: fetchError } = await supabase
      .from('launch_rounds')
      .select('*, projects(owner_user_id)')
      .eq('id', params.id)
      .single();

    if (fetchError || !round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // Check ownership
    if (round.projects.owner_user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only allow deletion in DRAFT status
    if (round.status !== 'DRAFT') {
      return NextResponse.json({ error: 'Can only delete DRAFT rounds' }, { status: 400 });
    }

    // Delete round
    const { error: deleteError } = await supabase
      .from('launch_rounds')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      console.error('Error deleting round:', deleteError);
      return NextResponse.json({ error: 'Failed to delete round' }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
