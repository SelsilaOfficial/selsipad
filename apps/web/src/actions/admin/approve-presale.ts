'use server';

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getServerSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

/**
 * Admin action to approve a presale submission.
 * Moves status from SUBMITTED_FOR_REVIEW → APPROVED
 */
export async function approvePresale(roundId: string) {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = createServiceRoleClient();

    // Verify round exists and is in correct status
    const { data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .select('id, status, type, project_id')
      .eq('id', roundId)
      .single();

    if (roundError || !round) {
      return { success: false, error: 'Round not found' };
    }

    if (round.type !== 'PRESALE') {
      return { success: false, error: 'Not a presale round' };
    }

    if (round.status !== 'SUBMITTED') {
      return { success: false, error: `Cannot approve: current status is ${round.status}` };
    }

    // Update status to APPROVED
    const { error: updateError } = await supabase
      .from('launch_rounds')
      .update({
        status: 'APPROVED',
        approved_by: session.userId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', roundId);

    if (updateError) {
      return { success: false, error: `Failed to approve: ${updateError.message}` };
    }

    // Update project status
    if (round.project_id) {
      await supabase
        .from('projects')
        .update({ status: 'APPROVED', updated_at: new Date().toISOString() })
        .eq('id', round.project_id);
    }

    revalidatePath('/admin');
    return { success: true, status: 'APPROVED' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to approve presale' };
  }
}

/**
 * Admin action to reject a presale submission.
 * Moves status from SUBMITTED_FOR_REVIEW → REJECTED
 */
export async function rejectPresale(roundId: string, reason: string) {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = createServiceRoleClient();

    // Verify round exists and is in correct status
    const { data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .select('id, status, type, project_id')
      .eq('id', roundId)
      .single();

    if (roundError || !round) {
      return { success: false, error: 'Round not found' };
    }

    if (round.type !== 'PRESALE') {
      return { success: false, error: 'Not a presale round' };
    }

    if (round.status !== 'SUBMITTED') {
      return { success: false, error: `Cannot reject: current status is ${round.status}` };
    }

    // Update status to REJECTED
    const { error: updateError } = await supabase
      .from('launch_rounds')
      .update({
        status: 'REJECTED',
        rejection_reason: reason,
        reviewed_by: session.userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', roundId);

    if (updateError) {
      return { success: false, error: `Failed to reject: ${updateError.message}` };
    }

    revalidatePath('/admin');
    return { success: true, status: 'REJECTED' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to reject presale' };
  }
}
