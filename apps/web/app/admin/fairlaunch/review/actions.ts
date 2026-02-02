'use server';

import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Approve Fairlaunch submission
 */
// Approve Fairlaunch submission
export async function approveFairlaunch(roundId: string): Promise<ActionResult> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = createClient();

    // Verify admin status and get user_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin, user_id')
      .eq('user_id', session.userId)
      .single();

    if (!profile?.is_admin || !profile.user_id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get fairlaunch round
    const { data: round, error: fetchError } = await supabase
      .from('launch_rounds')
      .select('*')
      .eq('id', roundId)
      .eq('sale_type', 'fairlaunch')
      .single();

    if (fetchError || !round) {
      return { success: false, error: 'Fairlaunch round not found' };
    }

    if (!['SUBMITTED', 'SUBMITTED_FOR_REVIEW'].includes(round.status)) {
      return { success: false, error: 'Round not in review status' };
    }

    // Validate fairlaunch constraints
    const liquidityPercent = round.params?.liquidity_percent || 0;
    if (liquidityPercent < 70) {
      return {
        success: false,
        error: 'Fairlaunch requires minimum 70% liquidity',
      };
    }

    // 1. Update project status to APPROVED
    if (round.project_id) {
      const { error: projectError } = await supabase
        .from('projects')
        .update({ status: 'APPROVED' })
        .eq('id', round.project_id);

      if (projectError) {
        console.error('Failed to update project status:', projectError);
        return { success: false, error: 'Failed to update project status' };
      }
    }

    // 2. Update launch_round status to APPROVED_TO_DEPLOY
    const { error: updateError } = await supabase
      .from('launch_rounds')
      .update({
        status: 'APPROVED_TO_DEPLOY',
        reviewed_by: profile.user_id, // Use UUID
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', roundId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // TODO: Log admin action
    // await logAdminAction('FAIRLAUNCH_APPROVE', session.address, { roundId });

    revalidatePath('/admin/fairlaunch/review');
    return { success: true };
  } catch (error: any) {
    console.error('Fairlaunch approval error:', error);
    return { success: false, error: error.message || 'Failed to approve fairlaunch' };
  }
}

// Reject Fairlaunch submission
export async function rejectFairlaunch(roundId: string, reason: string): Promise<ActionResult> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!reason || reason.trim().length < 10) {
      return { success: false, error: 'Rejection reason required (min 10 chars)' };
    }

    const supabase = createClient();

    // Verify admin status and get user_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin, user_id')
      .eq('user_id', session.userId)
      .single();

    if (!profile?.is_admin || !profile.user_id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get round to find project_id
    const { data: round } = await supabase
      .from('launch_rounds')
      .select('project_id')
      .eq('id', roundId)
      .single();

    // 1. Update project status to REJECTED
    if (round?.project_id) {
      const { error: projectError } = await supabase
        .from('projects')
        .update({ status: 'REJECTED' })
        .eq('id', round.project_id);

      if (projectError) {
        return { success: false, error: 'Failed to update project status' };
      }
    }

    // 2. Update launch_round status
    const { error: updateError } = await supabase
      .from('launch_rounds')
      .update({
        status: 'REJECTED',
        rejection_reason: reason.trim(),
        reviewed_by: profile.user_id, // Use UUID
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', roundId)
      .eq('sale_type', 'fairlaunch')
      .in('status', ['SUBMITTED', 'SUBMITTED_FOR_REVIEW']);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath('/admin/fairlaunch/review');
    return { success: true };
  } catch (error: any) {
    console.error('Fairlaunch rejection error:', error);
    return { success: false, error: error.message || 'Failed to reject fairlaunch' };
  }
}
