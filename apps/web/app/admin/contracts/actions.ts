'use server';

import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Admin: Override scan result
 * POST /admin/projects/:id/scan/override
 */
export async function overrideScanResult(
  projectId: string,
  scanRunId: string,
  override: 'PASS' | 'FAIL',
  reason: string
): Promise<ActionResult> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Use service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify admin permission
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', session.userId)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: 'Unauthorized - Admin only' };
    }

    // Validate reason
    if (!reason || reason.trim().length < 20) {
      return { success: false, error: 'Reason must be at least 20 characters' };
    }

    // Update scan result with override
    const { data: scanRun, error: scanError } = await supabase
      .from('sc_scan_results')
      .update({
        override_status: override,
        override_reason: reason.trim(),
        override_by: session.userId,
        override_at: new Date().toISOString(),
        status: override === 'PASS' ? 'PASS' : 'FAIL',
        finished_at: new Date().toISOString(),
      })
      .eq('id', scanRunId)
      .select()
      .single();

    if (scanError) {
      return { success: false, error: 'Failed to update scan result' };
    }

    // Update project scan status
    await supabase
      .from('projects')
      .update({ sc_scan_status: override === 'PASS' ? 'PASS' : 'FAIL' })
      .eq('id', projectId);

    // Write audit log
    await supabase.from('admin_audit_logs').insert({
      actor_admin_id: session.userId,
      action: `SCAN_OVERRIDE_${override}`,
      entity_type: 'SCAN_RUN',
      entity_id: scanRunId,
      metadata: {
        project_id: projectId,
        reason: reason.trim(),
        previous_status: scanRun.status,
      },
    });

    // If override PASS, issue PROJECT_AUDITED badge
    if (override === 'PASS') {
      const { data: badge } = await supabase
        .from('badge_definitions')
        .select('id')
        .eq('badge_key', 'PROJECT_AUDITED')
        .single();

      if (badge) {
        await supabase
          .from('project_badges')
          .insert({
            project_id: projectId,
            badge_id: badge.id,
            awarded_by: session.userId,
            reason: `Security scan overridden to PASS by admin: ${reason.trim()}`,
          })
          .onConflict('project_id,badge_id')
          .merge();
      }
    }

    revalidatePath('/admin/contracts/scans');
    revalidatePath(`/projects/${projectId}`);

    return { success: true, data: scanRun };
  } catch (error: any) {
    console.error('Override scan error:', error);
    return { success: false, error: error.message || 'Failed to override scan' };
  }
}

/**
 * Admin: Verify audit proof
 * POST /admin/projects/:id/audit-proof/verify
 */
export async function verifyAuditProof(
  proofId: string,
  decision: 'VERIFIED' | 'REJECTED',
  reason?: string
): Promise<ActionResult> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Use service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify admin permission
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', session.userId)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: 'Unauthorized - Admin only' };
    }

    // Validate reason for rejection
    if (decision === 'REJECTED' && (!reason || reason.trim().length < 10)) {
      return { success: false, error: 'Rejection reason must be at least 10 characters' };
    }

    // Update audit proof
    const { data: proof, error: proofError } = await supabase
      .from('contract_audit_proofs')
      .update({
        status: decision,
        verified_by: session.userId,
        verified_at: new Date().toISOString(),
        rejection_reason: decision === 'REJECTED' ? reason?.trim() : null,
      })
      .eq('id', proofId)
      .select()
      .single();

    if (proofError) {
      return { success: false, error: 'Failed to update audit proof' };
    }

    // Write audit log
    await supabase.from('admin_audit_logs').insert({
      actor_admin_id: session.userId,
      action: `AUDIT_PROOF_${decision}`,
      entity_type: 'AUDIT_PROOF',
      entity_id: proofId,
      metadata: {
        project_id: proof.project_id,
        reason: reason?.trim(),
        auditor_name: proof.auditor_name,
      },
    });

    // If VERIFIED, issue SECURITY_AUDITED badge
    if (decision === 'VERIFIED') {
      const { data: badge } = await supabase
        .from('badge_definitions')
        .select('id')
        .eq('badge_key', 'SECURITY_AUDITED')
        .single();

      if (badge) {
        await supabase
          .from('project_badges')
          .insert({
            project_id: proof.project_id,
            badge_id: badge.id,
            awarded_by: session.userId,
            reason: `Professional audit verified by ${proof.auditor_name}`,
          })
          .onConflict('project_id,badge_id')
          .merge();
      }
    }

    revalidatePath('/admin/contracts/audits');
    revalidatePath(`/projects/${proof.project_id}`);

    return { success: true, data: proof };
  } catch (error: any) {
    console.error('Verify audit proof error:', error);
    return { success: false, error: error.message || 'Failed to verify audit proof' };
  }
}

/**
 * Admin: Upsert template audit record
 * POST /admin/templates/audits/upsert
 */
export async function upsertTemplateAudit(data: {
  network: 'EVM' | 'SOLANA';
  template_version: string;
  implementation_hash: string;
  factory_address?: string;
  audit_report_ref: string;
  audit_provider?: string;
  audited_at?: string;
  status: 'VALID' | 'REVOKED';
  revoked_reason?: string;
}): Promise<ActionResult> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Use service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify admin permission
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', session.userId)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: 'Unauthorized - Admin only' };
    }

    // Insert or update template audit
    const { data: templateAudit, error } = await supabase
      .from('template_audits')
      .upsert({
        network: data.network,
        template_version: data.template_version,
        implementation_hash: data.implementation_hash,
        factory_address: data.factory_address || null,
        audit_report_ref: data.audit_report_ref,
        audit_provider: data.audit_provider || null,
        audited_at: data.audited_at || null,
        status: data.status,
        revoked_reason: data.revoked_reason || null,
        created_by: session.userId,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to upsert template audit:', error);
      return { success: false, error: 'Failed to save template audit' };
    }

    // Write audit log
    await supabase.from('admin_audit_logs').insert({
      actor_admin_id: session.userId,
      action: 'TEMPLATE_AUDIT_UPSERT',
      entity_type: 'TEMPLATE_AUDIT',
      entity_id: templateAudit.id,
      metadata: {
        network: data.network,
        template_version: data.template_version,
        status: data.status,
      },
    });

    revalidatePath('/admin/contracts/templates');

    return { success: true, data: templateAudit };
  } catch (error: any) {
    console.error('Upsert template audit error:', error);
    return { success: false, error: error.message || 'Failed to save template audit' };
  }
}

/**
 * Admin: Get scans needing review
 */
export async function getScansNeedingReview(): Promise<ActionResult> {
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
      .eq('user_id', session.userId)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data, error } = await supabase
      .from('sc_scan_results')
      .select('*, projects(id, name)')
      .eq('status', 'NEEDS_REVIEW')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to get scans' };
  }
}

/**
 * Admin: Get pending audit proofs
 */
export async function getPendingAuditProofs(): Promise<ActionResult> {
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
      .eq('user_id', session.userId)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: 'Unauthorized' };
    }

    const { data, error } = await supabase
      .from('contract_audit_proofs')
      .select('*, projects(id, name)')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to get audit proofs' };
  }
}
