'use server';

import { createClient } from '@/lib/supabase/server';

export type AMAType = 'TEXT' | 'VOICE' | 'VIDEO';
export type AMAStatus = 'SUBMITTED' | 'PAID' | 'APPROVED' | 'LIVE' | 'ENDED' | 'CANCELLED';

export interface AMASession {
  id: string;
  project_id: string;
  host_id: string;
  title: string;
  description?: string;
  type: AMAType;
  status: AMAStatus;
  scheduled_at: string;
  started_at?: string;
  ended_at?: string;
  payment_tx_hash?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Submit New AMA
 * Developer creates AMA for their project
 */
export async function submitAMA(data: {
  project_id: string;
  title: string;
  description?: string;
  type: AMAType;
  scheduled_at: string;
  payment_tx_hash?: string;
}): Promise<AMASession> {
  import { getServerSession } from '@/lib/auth/session';
  const session = await getServerSession();

  if (!session) {
    throw new Error('Authentication required');
  }

  const supabase = createClient();

  // Verify user owns the project
  const { data: project } = await supabase
    .from('projects')
    .select('creator_id')
    .eq('id', data.project_id)
    .single();

  if (!project || project.creator_id !== session.userId) {
    throw new Error('You can only create AMAs for your own projects');
  }

  // Create AMA session
  const { data: ama, error } = await supabase
    .from('ama_sessions')
    .insert({
      project_id: data.project_id,
      host_id: session.userId,
      title: data.title,
      description: data.description,
      type: data.type,
      scheduled_at: data.scheduled_at,
      payment_tx_hash: data.payment_tx_hash,
      status: data.payment_tx_hash ? 'PAID' : 'SUBMITTED',
    })
    .select()
    .single();

  if (error) throw error;

  return ama;
}

/**
 * Get Upcoming AMAs
 * Public - shows APPROVED and LIVE AMAs
 */
export async function getUpcomingAMAs(): Promise<any[]> {
  const supabase = createClient();

  const { data: sessions } = await supabase
    .from('ama_sessions')
    .select(
      `
      *,
      projects (
        name,
        logo_url
      )
    `
    )
    .in('status', ['APPROVED', 'LIVE'])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(20);

  // Fetch host profiles
  const hostIds = [...new Set((sessions || []).map((s: any) => s.host_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, username, avatar_url, bluecheck_status')
    .in('user_id', hostIds);

  const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

  return (sessions || []).map((session: any) => ({
    ...session,
    host: profileMap.get(session.host_id) || {},
  }));
}

/**
 * Get Live AMAs
 */
export async function getLiveAMAs(): Promise<any[]> {
  const supabase = createClient();

  const { data: sessions } = await supabase
    .from('ama_sessions')
    .select(
      `
      *,
      projects (
        name,
        logo_url
      )
    `
    )
    .eq('status', 'LIVE')
    .order('started_at', { ascending: false });

  const hostIds = [...new Set((sessions || []).map((s: any) => s.host_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, username, avatar_url, bluecheck_status')
    .in('user_id', hostIds);

  const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

  return (sessions || []).map((session: any) => ({
    ...session,
    host: profileMap.get(session.host_id) || {},
  }));
}

/**
 * Get My AMAs (Developer)
 */
export async function getMyAMAs(): Promise<any[]> {
  import { getServerSession } from '@/lib/auth/session';
  const session = await getServerSession();

  if (!session) {
    return [];
  }

  const supabase = createClient();

  const { data: sessions } = await supabase
    .from('ama_sessions')
    .select(
      `
      *,
      projects (
        name,
        logo_url
      )
    `
    )
    .eq('host_id', session.userId)
    .order('created_at', { ascending: false });

  return sessions || [];
}

/**
 * Start AMA Session
 * Change status to LIVE
 */
export async function startAMA(amaId: string): Promise<void> {
  import { getServerSession } from '@/lib/auth/session';
  const session = await getServerSession();

  if (!session) {
    throw new Error('Authentication required');
  }

  const supabase = createClient();

  // Verify ownership
  const { data: ama } = await supabase
    .from('ama_sessions')
    .select('host_id, status')
    .eq('id', amaId)
    .single();

  if (!ama || ama.host_id !== session.userId) {
    throw new Error('Only the host can start this AMA');
  }

  if (ama.status !== 'APPROVED') {
    throw new Error('AMA must be approved before starting');
  }

  const { error } = await supabase
    .from('ama_sessions')
    .update({
      status: 'LIVE',
      started_at: new Date().toISOString(),
    })
    .eq('id', amaId);

  if (error) throw error;
}

/**
 * End AMA Session
 */
export async function endAMA(amaId: string): Promise<void> {
  import { getServerSession } from '@/lib/auth/session';
  const session = await getServerSession();

  if (!session) {
    throw new Error('Authentication required');
  }

  const supabase = createClient();

  // Verify ownership
  const { data: ama } = await supabase
    .from('ama_sessions')
    .select('host_id, status')
    .eq('id', amaId)
    .single();

  if (!ama || ama.host_id !== session.userId) {
    throw new Error('Only the host can end this AMA');
  }

  if (ama.status !== 'LIVE') {
    throw new Error('AMA must be live to end');
  }

  const { error } = await supabase
    .from('ama_sessions')
    .update({
      status: 'ENDED',
      ended_at: new Date().toISOString(),
    })
    .eq('id', amaId);

  if (error) throw error;
}

/**
 * Cancel AMA
 */
export async function cancelAMA(amaId: string): Promise<void> {
  import { getServerSession } from '@/lib/auth/session';
  const session = await getServerSession();

  if (!session) {
    throw new Error('Authentication required');
  }

  const supabase = createClient();

  // Verify ownership
  const { data: ama } = await supabase
    .from('ama_sessions')
    .select('host_id, status')
    .eq('id', amaId)
    .single();

  if (!ama || ama.host_id !== session.userId) {
    throw new Error('Only the host can cancel this AMA');
  }

  if (!['SUBMITTED', 'PAID', 'APPROVED'].includes(ama.status)) {
    throw new Error('Cannot cancel AMA that is live or ended');
  }

  const { error } = await supabase
    .from('ama_sessions')
    .update({
      status: 'CANCELLED',
    })
    .eq('id', amaId);

  if (error) throw error;
}
