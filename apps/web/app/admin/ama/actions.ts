'use server';

import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Pin AMA request (approve for display)
 */
export async function pinAMA(requestId: string): Promise<ActionResult> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify admin using user_id (more reliable than wallet_address)
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', session.userId)
      .single();

    console.log('[AMA Pin] Admin check:', { userId: session.userId, isAdmin: profile?.is_admin });

    if (!profile?.is_admin) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get request
    const { data: ama, error: fetchError } = await supabase
      .from('ama_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !ama) {
      console.error('[AMA Pin] Fetch error:', fetchError);
      return { success: false, error: 'AMA request not found' };
    }

    if (ama.status !== 'PENDING') {
      return { success: false, error: 'AMA not in pending status' };
    }

    // Update status to PINNED
    const { error: updateError } = await supabase
      .from('ama_requests')
      .update({
        status: 'PINNED',
        is_pinned: true,
        pinned_at: new Date().toISOString(),
        pinned_by: session.userId,
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('[AMA Pin] Update error:', updateError);
      return { success: false, error: updateError.message };
    }

    console.log('[AMA Pin] ✅ Success:', requestId);
    revalidatePath('/admin/ama');
    return { success: true };
  } catch (error: any) {
    console.error('[AMA Pin] Error:', error);
    return { success: false, error: error.message || 'Failed to pin AMA' };
  }
}

/**
 * Reject AMA request (triggers refund)
 */
export async function rejectAMA(requestId: string, reason: string): Promise<ActionResult> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!reason || reason.trim().length < 10) {
      return { success: false, error: 'Rejection reason required (min 10 chars)' };
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify admin using user_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', session.userId)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: 'Unauthorized' };
    }

    // Update request
    const { error: updateError } = await supabase
      .from('ama_requests')
      .update({
        status: 'REJECTED',
        rejection_reason: reason.trim(),
      })
      .eq('id', requestId)
      .eq('status', 'PENDING');

    if (updateError) {
      console.error('[AMA Reject] Update error:', updateError);
      return { success: false, error: updateError.message };
    }

    // TODO: Trigger on-chain refund via backend wallet
    // The contract has refundRequest(bytes32 requestId) function
    // This would require a server-side wallet to call the contract

    console.log('[AMA Reject] ✅ Success:', requestId);
    revalidatePath('/admin/ama');
    return { success: true };
  } catch (error: any) {
    console.error('[AMA Reject] Error:', error);
    return { success: false, error: error.message || 'Failed to reject AMA' };
  }
}

/**
 * Start AMA session (go live)
 */
export async function startAMA(requestId: string): Promise<ActionResult> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify admin using user_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', session.userId)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify request is PINNED
    const { data: ama } = await supabase
      .from('ama_requests')
      .select('status')
      .eq('id', requestId)
      .single();

    if (!ama || ama.status !== 'PINNED') {
      return { success: false, error: 'AMA must be pinned to start' };
    }

    // Update status to LIVE — admin becomes host
    const { error: updateError } = await supabase
      .from('ama_requests')
      .update({
        status: 'LIVE',
        started_at: new Date().toISOString(),
        host_id: session.userId,
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('[AMA Start] Update error:', updateError);
      return { success: false, error: updateError.message };
    }

    // Post system message
    await supabase.from('ama_messages').insert({
      ama_id: requestId,
      user_id: session.userId,
      content: '🎤 AMA has started! Welcome everyone!',
      message_type: 'SYSTEM',
      username: 'System',
    });

    console.log('[AMA Start] ✅ Success:', requestId);
    revalidatePath('/admin/ama');
    return { success: true };
  } catch (error: any) {
    console.error('[AMA Start] Error:', error);
    return { success: false, error: error.message || 'Failed to start AMA' };
  }
}

/**
 * End AMA session
 */
export async function endAMA(requestId: string): Promise<ActionResult> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify admin using user_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', session.userId)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify request is LIVE
    const { data: ama } = await supabase
      .from('ama_requests')
      .select('status')
      .eq('id', requestId)
      .single();

    if (!ama || ama.status !== 'LIVE') {
      return { success: false, error: 'AMA must be live to end' };
    }

    // Update status to ENDED
    const { error: updateError } = await supabase
      .from('ama_requests')
      .update({
        status: 'ENDED',
        ended_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('[AMA End] Update error:', updateError);
      return { success: false, error: updateError.message };
    }

    // Post system message
    await supabase.from('ama_messages').insert({
      ama_id: requestId,
      user_id: session.userId,
      content: '👋 AMA has ended. Thank you for participating!',
      message_type: 'SYSTEM',
      username: 'System',
    });

    console.log('[AMA End] ✅ Success:', requestId);
    revalidatePath('/admin/ama');
    return { success: true };
  } catch (error: any) {
    console.error('[AMA End] Error:', error);
    return { success: false, error: error.message || 'Failed to end AMA' };
  }
}

/**
 * Get single AMA request with details
 */
export async function getAMARequest(requestId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('ama_requests')
    .select(
      `
      *,
      profiles:developer_id (wallet_address, nickname, avatar_url, kyc_status),
      projects:project_id (name, token_symbol, logo_url)
    `
    )
    .eq('id', requestId)
    .single();

  if (error) {
    console.error('Failed to fetch AMA request:', error);
    return null;
  }

  return data;
}
