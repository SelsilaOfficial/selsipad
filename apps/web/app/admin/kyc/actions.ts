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
 * Approve KYC submission
 */
export async function approveKYC(submissionId: string): Promise<ActionResult> {
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
      .eq('user_id', session.userId)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get submission
    const { data: submission, error: fetchError } = await supabase
      .from('kyc_submissions')
      .select('user_id, status')
      .eq('id', submissionId)
      .single();

    if (fetchError || !submission) {
      return { success: false, error: 'Submission not found' };
    }

    if (submission.status !== 'PENDING') {
      return { success: false, error: 'Submission already reviewed' };
    }

    // Update submission status
    const { error: updateError } = await supabase
      .from('kyc_submissions')
      .update({
        status: 'APPROVED',
        reviewed_by: session.userId, // Use userId instead of address
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', submissionId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Update profile to mark KYC verified
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ kyc_verified: true })
      .eq('user_id', submission.user_id);

    if (profileError) {
      console.error('Failed to update profile:', profileError);
    }

    // TODO: Log admin action to audit log
    // await logAdminAction('KYC_APPROVE', session.userId, { submissionId });

    revalidatePath('/admin/kyc');
    return { success: true };
  } catch (error: any) {
    console.error('KYC approval error:', error);
    return { success: false, error: error.message || 'Failed to approve KYC' };
  }
}

/**
 * Reject KYC submission
 */
export async function rejectKYC(submissionId: string, reason: string): Promise<ActionResult> {
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
      .eq('user_id', session.userId)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: 'Unauthorized' };
    }

    // Update submission
    const { error: updateError } = await supabase
      .from('kyc_submissions')
      .update({
        status: 'REJECTED',
        rejection_reason: reason.trim(),
        reviewed_by: session.userId, // Use userId instead of address
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .eq('status', 'PENDING'); // Only reject if still pending

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // TODO: Log admin action to audit log
    // await logAdminAction('KYC_REJECT', session.userId, { submissionId, reason });

    revalidatePath('/admin/kyc');
    return { success: true };
  } catch (error: any) {
    console.error('KYC rejection error:', error);
    return { success: false, error: error.message || 'Failed to reject KYC' };
  }
}

/**
 * Get KYC submissions with filters
 */
export async function getKYCSubmissions(status?: string) {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = createClient();

    let query = supabase
      .from('kyc_submissions')
      .select('*, profiles(wallet_address, username)')
      .order('created_at', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Get KYC submissions error:', error);
    return { success: false, error: error.message || 'Failed to fetch submissions' };
  }
}
