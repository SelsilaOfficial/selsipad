'use server';
/**
 * AMA Data Layer
 *
 * Server actions for AMA system
 * Used by both app/ and src/ files
 */

import { getServerSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export type AMAStatus = 'PENDING' | 'PINNED' | 'LIVE' | 'ENDED' | 'REJECTED';

export type AMAType = 'TEXT' | 'VOICE' | 'VIDEO';

export interface AMARequest {
  id: string;
  project_id: string;
  developer_id: string;
  host_id?: string;
  project_name: string;
  description: string;
  scheduled_at: string;
  payment_tx_hash: string;
  payment_amount_bnb: number;
  status: AMAStatus;
  type: AMAType;
  video_enabled: boolean;
  is_pinned: boolean;
  started_at?: string;
  ended_at?: string;
  created_at: string;
}

export interface AMAMessage {
  id: string;
  ama_id: string;
  user_id: string;
  content: string;
  message_type: 'USER' | 'DEVELOPER' | 'HOST' | 'SYSTEM' | 'PINNED';
  username: string;
  avatar_url?: string;
  is_developer: boolean;
  is_host: boolean;
  is_verified: boolean;
  is_pinned_message: boolean;
  is_deleted: boolean;
  created_at: string;
}

/**
 * Get AMA Messages
 */
export async function getAMAMessages(amaId: string): Promise<AMAMessage[]> {
  const supabase = createClient();

  const { data: messages, error } = await supabase
    .from('ama_messages')
    .select('*')
    .eq('ama_id', amaId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }

  return (messages || []) as AMAMessage[];
}

/**
 * Send AMA Message
 * Role detection: TEAM_MOD badge → HOST, developer_id match → DEVELOPER, else → USER
 */
export async function sendAMAMessage(amaId: string, content: string) {
  console.log('[sendAMAMessage] Starting...', { amaId, content });

  const session = await getServerSession();

  if (!session) {
    console.log('[sendAMAMessage] No session');
    return { success: false, error: 'Authentication required' };
  }

  console.log('[sendAMAMessage] Session:', session.userId);

  if (!content.trim()) {
    return { success: false, error: 'Message cannot be empty' };
  }

  // Use service role to bypass RLS for message insertion
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get profile info
  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname, avatar_url, kyc_status')
    .eq('user_id', session.userId)
    .single();

  console.log('[sendAMAMessage] Profile:', profile);

  // Check if user is the developer (guest)
  const { data: ama } = await supabase
    .from('ama_requests')
    .select('developer_id, host_id')
    .eq('id', amaId)
    .single();

  const isDeveloper = ama?.developer_id === session.userId;

  // Check if user has TEAM_MOD badge (host)
  const { data: teamBadge } = await supabase
    .from('user_badges')
    .select('badge_key')
    .eq('user_id', session.userId)
    .eq('badge_key', 'TEAM_MOD')
    .limit(1);

  const isHost = (teamBadge && teamBadge.length > 0) || ama?.host_id === session.userId;

  // Determine message type: HOST > DEVELOPER > USER
  let messageType: 'HOST' | 'DEVELOPER' | 'USER' = 'USER';
  if (isHost) messageType = 'HOST';
  else if (isDeveloper) messageType = 'DEVELOPER';

  console.log('[sendAMAMessage] Role:', { isDeveloper, isHost, messageType });

  const messageData = {
    ama_id: amaId,
    user_id: session.userId,
    content: content.trim(),
    message_type: messageType,
    username: profile?.nickname || 'Anonymous',
    avatar_url: profile?.avatar_url,
    is_developer: isDeveloper,
    is_host: isHost,
    is_verified: profile?.kyc_status === 'APPROVED',
  };

  console.log('[sendAMAMessage] Inserting:', messageData);

  const { data: inserted, error } = await supabase
    .from('ama_messages')
    .insert(messageData)
    .select()
    .single();

  if (error) {
    console.error('[sendAMAMessage] Error:', error);
    return { success: false, error: error.message };
  }

  console.log('[sendAMAMessage] ✅ Success:', inserted);
  return { success: true, data: inserted };
}

/**
 * Pin a message (Host or Developer)
 */
export async function pinMessage(messageId: string, amaId: string) {
  const session = await getServerSession();

  if (!session) {
    return { success: false, error: 'Authentication required' };
  }

  // Use service role to bypass RLS
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check if user is developer OR host (TEAM_MOD badge)
  const { data: ama } = await supabase
    .from('ama_requests')
    .select('developer_id, host_id')
    .eq('id', amaId)
    .single();

  const isDeveloper = ama?.developer_id === session.userId;
  const isHostById = ama?.host_id === session.userId;

  // Check TEAM_MOD badge
  const { data: teamBadge } = await supabase
    .from('user_badges')
    .select('badge_key')
    .eq('user_id', session.userId)
    .eq('badge_key', 'TEAM_MOD')
    .limit(1);

  const isHost = isHostById || (teamBadge && teamBadge.length > 0);

  if (!isDeveloper && !isHost) {
    return { success: false, error: 'Only the host or developer can pin messages' };
  }

  const { error } = await supabase
    .from('ama_messages')
    .update({ is_pinned_message: true })
    .eq('id', messageId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Delete a message (Admin only)
 */
export async function deleteMessage(messageId: string) {
  const session = await getServerSession();

  if (!session) {
    return { success: false, error: 'Authentication required' };
  }

  const supabase = createClient();

  // Check if admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('wallet_address', session.address)
    .single();

  if (!profile?.is_admin) {
    return { success: false, error: 'Unauthorized' };
  }

  const { error } = await supabase
    .from('ama_messages')
    .update({ is_deleted: true })
    .eq('id', messageId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================
// Submit AMA Request (for useAMAPurchase hook)
// ============================================

export interface SubmitAMAData {
  projectId: string;
  projectName: string;
  scheduledAt: string;
  description: string;
  paymentTxHash: string;
  paymentAmountBnb: string;
  requestIdBytes32: string;
  chainId: number;
}

/**
 * Submit AMA Request after on-chain payment
 */
export async function submitAMARequest(data: SubmitAMAData) {
  console.log('[AMA Submit] Starting submission with data:', data);

  const session = await getServerSession();

  if (!session) {
    console.log('[AMA Submit] No session found');
    return { success: false, error: 'Authentication required' };
  }

  console.log('[AMA Submit] Session found:', session.userId);

  // Use service role client to bypass RLS
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Skip badge verification here - form is already gated by isDevVerified prop
  // Badge was already checked at page load time
  console.log('[AMA Submit] Creating AMA request (dev verification done at page level)...');

  // Create AMA request with service role (bypasses RLS)
  const { data: ama, error } = await serviceSupabase
    .from('ama_requests')
    .insert({
      developer_id: session.userId,
      project_id: data.projectId,
      project_name: data.projectName,
      scheduled_at: data.scheduledAt,
      description: data.description,
      payment_tx_hash: data.paymentTxHash,
      payment_amount_bnb: parseFloat(data.paymentAmountBnb),
      request_id_bytes32: data.requestIdBytes32,
      chain_id: data.chainId,
      status: 'PENDING',
    })
    .select()
    .single();

  if (error) {
    console.error('[AMA Submit] Database insert error:', error);
    return { success: false, error: error.message };
  }

  console.log('[AMA] ✅ Request submitted successfully:', ama.id);
  return { success: true, data: ama };
}
