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
 * Approve AMA session
 */
export async function approveAMA(sessionId: string): Promise<ActionResult> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = createClient();

    // Verify admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('wallet_address', session.address)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get AMA session
    const { data: ama, error: fetchError } = await supabase
      .from('ama_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError || !ama) {
      return { success: false, error: 'AMA session not found' };
    }

    if (ama.status !== 'SUBMITTED') {
      return { success: false, error: 'AMA not in submitted status' };
    }

    // Update status to SCHEDULED
    const { error: updateError } = await supabase
      .from('ama_sessions')
      .update({
        status: 'SCHEDULED',
        reviewed_by: session.address,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // TODO: Log admin action
    // await logAdminAction('AMA_APPROVE', session.address, { sessionId });

    revalidatePath('/admin/ama');
    return { success: true };
  } catch (error: any) {
    console.error('AMA approval error:', error);
    return { success: false, error: error.message || 'Failed to approve AMA' };
  }
}

/**
 * Reject AMA session
 */
export async function rejectAMA(sessionId: string, reason: string): Promise<ActionResult> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!reason || reason.trim().length < 10) {
      return { success: false, error: 'Rejection reason required (min 10 chars)' };
    }

    const supabase = createClient();

    // Verify admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('wallet_address', session.address)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: 'Unauthorized' };
    }

    // Update AMA
    const { error: updateError } = await supabase
      .from('ama_sessions')
      .update({
        status: 'REJECTED',
        rejection_reason: reason.trim(),
        reviewed_by: session.address,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('status', 'SUBMITTED');

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // TODO: Log admin action
    // await logAdminAction('AMA_REJECT', session.address, { sessionId, reason });

    revalidatePath('/admin/ama');
    return { success: true };
  } catch (error: any) {
    console.error('AMA rejection error:', error);
    return { success: false, error: error.message || 'Failed to reject AMA' };
  }
}

/**
 * Pin/Unpin AMA session
 */
export async function toggleAMAPin(sessionId: string): Promise<ActionResult> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = createClient();

    // Verify admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('wallet_address', session.address)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get current status
    const { data: ama } = await supabase
      .from('ama_sessions')
      .select('is_pinned')
      .eq('id', sessionId)
      .single();

    if (!ama) {
      return { success: false, error: 'AMA not found' };
    }

    // Toggle pin
    const { error: updateError } = await supabase
      .from('ama_sessions')
      .update({ is_pinned: !ama.is_pinned })
      .eq('id', sessionId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath('/admin/ama');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to toggle pin' };
  }
}

/**
 * Force end AMA session
 */
export async function forceEndAMA(sessionId: string): Promise<ActionResult> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = createClient();

    // Verify admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('wallet_address', session.address)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: 'Unauthorized' };
    }

    // Update status to ENDED
    const { error: updateError } = await supabase
      .from('ama_sessions')
      .update({ status: 'ENDED' })
      .eq('id', sessionId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // TODO: Log admin action
    // await logAdminAction('AMA_FORCE_END', session.address, { sessionId });

    revalidatePath('/admin/ama');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to end AMA' };
  }
}
