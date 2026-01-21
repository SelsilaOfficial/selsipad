'use server';

import { createClient } from '@/lib/supabase/server';

export type KYCSubmissionType = 'INDIVIDUAL' | 'BUSINESS';
export type KYCStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface KYCSubmission {
  id: string;
  user_id: string;
  project_id?: string;
  submission_type: KYCSubmissionType;
  status: KYCStatus;
  documents_url: string;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export async function submitKYC(data: {
  submission_type: KYCSubmissionType;
  documents_url: string; // Upload handled separately
  project_id?: string;
}): Promise<KYCSubmission> {
  import { getServerSession } from '@/lib/auth/session';
  const session = await getServerSession();

  if (!session) {
    throw new Error('Authentication required');
  }

  const supabase = createClient();

  // Check for duplicate submission - prevent if already pending or verified
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('kyc_status')
    .eq('user_id', session.userId)
    .single();

  if (existingProfile?.kyc_status === 'pending') {
    throw new Error('You already have a pending KYC submission under review');
  }

  if (existingProfile?.kyc_status === 'verified') {
    throw new Error('Your KYC is already verified');
  }

  // Create KYC submission
  const { data: submission, error } = await supabase
    .from('kyc_submissions')
    .insert({
      user_id: session.userId,
      project_id: data.project_id,
      submission_type: data.submission_type,
      documents_url: data.documents_url,
      status: 'PENDING',
    })
    .select()
    .single();

  if (error) throw error;

  // Update profile kyc_status to 'pending' and set submission timestamp
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      kyc_status: 'pending',
      kyc_submitted_at: new Date().toISOString(),
    })
    .eq('user_id', session.userId);

  if (profileError) {
    console.error('Failed to update profile kyc_status:', profileError);
    // Don't throw - submission was successful, profile update is secondary
  }

  return submission;
}

/**
 * Get User's KYC Status
 */
export async function getKYCStatus(): Promise<KYCSubmission | null> {
  import { getServerSession } from '@/lib/auth/session';
  const session = await getServerSession();

  if (!session) {
    return null;
  }

  const supabase = createClient();

  // Get latest submission
  const { data: submission } = await supabase
    .from('kyc_submissions')
    .select('*')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return submission;
}

export async function uploadKYCDocuments(files: { name: string; data: string }[]): Promise<string> {
  import { getServerSession } from '@/lib/auth/session';
  const session = await getServerSession();

  if (!session) {
    throw new Error('Authentication required');
  }

  // Use service role client to bypass RLS for wallet-only auth (Pattern 81)
  // Regular authenticated client uses auth.uid() which is NULL for wallet-only users
  const { createServiceRoleClient } = await import('@/lib/supabase/service-role');
  const supabase = createServiceRoleClient();

  const timestamp = Date.now();
  const uploadedUrls: string[] = [];

  for (const file of files) {
    const fileName = `${session.userId}/${timestamp}/${file.name}`;

    // Decode base64 to buffer
    const base64Data = file.data.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    const { data, error } = await supabase.storage.from('kyc-documents').upload(fileName, buffer, {
      contentType: file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      upsert: false,
    });

    if (error) throw error;

    uploadedUrls.push(data.path);
  }

  // Return JSON array of paths
  return JSON.stringify(uploadedUrls);
}

/**
 * Get User Projects (for KYC linking)
 */
export async function getUserProjects(): Promise<Array<{ id: string; name: string }>> {
  import { getServerSession } from '@/lib/auth/session';
  const session = await getServerSession();

  if (!session) {
    return [];
  }

  const supabase = createClient();

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('creator_id', session.userId)
    .order('created_at', { ascending: false });

  return projects || [];
}
