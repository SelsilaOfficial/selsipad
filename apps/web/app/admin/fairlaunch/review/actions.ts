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
export async function approveFairlaunch(roundId: string): Promise<ActionResult> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = createClient();

    // Verify admin status
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('wallet_address', session.address)
      .single();

    if (!profile?.is_admin) {
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

    if (round.status !== 'SUBMITTED_FOR_REVIEW') {
      return { success: false, error: 'Round not in review status' };
    }

    // Validate fairlaunch constraints
    const liquidityPercent = round.params?.lp_lock?.percentage || 0;
    if (liquidityPercent < 70) {
      return {
        success: false,
        error: 'Fairlaunch requires minimum 70% liquidity',
      };
    }

    // Update status to approved
    const { error: updateError } = await supabase
      .from('launch_rounds')
      .update({
        status: 'APPROVED_TO_DEPLOY',
        reviewed_by: session.address,
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

/**
 * Reject Fairlaunch submission
 */
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

    // Verify admin status
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('wallet_address', session.address)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: 'Unauthorized' };
    }

    // Update round
    const { error: updateError } = await supabase
      .from('launch_rounds')
      .update({
        status: 'REJECTED',
        rejection_reason: reason.trim(),
        reviewed_by: session.address,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', roundId)
      .eq('sale_type', 'fairlaunch')
      .eq('status', 'SUBMITTED_FOR_REVIEW');

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // TODO: Log admin action
    // await logAdminAction('FAIRLAUNCH_REJECT', session.address, { roundId, reason });

    revalidatePath('/admin/fairlaunch/review');
    return { success: true };
  } catch (error: any) {
    console.error('Fairlaunch rejection error:', error);
    return { success: false, error: error.message || 'Failed to reject fairlaunch' };
  }
}
