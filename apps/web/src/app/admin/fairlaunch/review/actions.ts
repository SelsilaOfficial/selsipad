'use server';

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Get admin identity from admin_session cookie
 * (Admin login sets this cookie, separate from the regular user session_token)
 */
function getAdminSession(): { userId: string; wallet: string; roles: string[] } | null {
  const cookieStore = cookies();
  const adminCookie = cookieStore.get('admin_session')?.value;

  if (!adminCookie) {
    console.log('[Admin Action] No admin_session cookie found');
    return null;
  }

  try {
    const session = JSON.parse(adminCookie);
    if (!session.userId || !session.wallet) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/**
 * Approve Fairlaunch submission
 */
export async function approveFairlaunch(roundId: string): Promise<ActionResult> {
  try {
    const adminSession = getAdminSession();
    console.log(
      '[Approve Action] Admin session:',
      adminSession
        ? { userId: adminSession.userId, wallet: adminSession.wallet, roles: adminSession.roles }
        : 'NULL'
    );

    if (!adminSession) {
      return { success: false, error: 'Not authenticated as admin' };
    }

    const supabase = createServiceRoleClient();

    // Verify admin status from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin, user_id')
      .eq('user_id', adminSession.userId)
      .single();

    console.log('[Approve Action] Profile:', { profile, profileError });

    if (!profile?.is_admin || !profile.user_id) {
      return { success: false, error: 'Unauthorized — not an admin user' };
    }

    // Get fairlaunch round
    const { data: round, error: fetchError } = await supabase
      .from('launch_rounds')
      .select('*')
      .eq('id', roundId)
      .single();

    if (fetchError || !round) {
      return { success: false, error: 'Fairlaunch round not found' };
    }

    if (round.status !== 'SUBMITTED') {
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

    // 2. Update launch_round status to APPROVED
    const { error: updateError } = await supabase
      .from('launch_rounds')
      .update({
        status: 'APPROVED',
        reviewed_by: profile.user_id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', roundId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath('/admin/fairlaunch/review');
    revalidatePath(`/admin/fairlaunch/review/${roundId}`);
    return { success: true };
  } catch (error: any) {
    console.error('Fairlaunch approval error:', error);
    return { success: false, error: error.message || 'Failed to approve fairlaunch' };
  }
}

// Reject Fairlaunch submission
export async function rejectFairlaunch(roundId: string, reason: string): Promise<ActionResult> {
  try {
    const adminSession = getAdminSession();
    if (!adminSession) {
      return { success: false, error: 'Not authenticated as admin' };
    }

    if (!reason || reason.trim().length < 10) {
      return { success: false, error: 'Rejection reason required (min 10 chars)' };
    }

    const supabase = createServiceRoleClient();

    // Verify admin status
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin, user_id')
      .eq('user_id', adminSession.userId)
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
        reviewed_by: profile.user_id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', roundId)
      .eq('status', 'SUBMITTED');

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
