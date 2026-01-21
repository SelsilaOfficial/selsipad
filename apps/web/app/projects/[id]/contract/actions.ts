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
 * Start contract security scan
 * POST /projects/:id/contract/scan/start
 */
export async function startContractScan(
  projectId: string,
  network: 'EVM' | 'SOLANA',
  targetAddress: string,
  idempotencyKey: string
): Promise<ActionResult<{ scan_run_id: string; status: string }>> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Use service role for database operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, owner_user_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return { success: false, error: 'Project not found' };
    }

    if (project.owner_user_id !== session.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check for existing pending/running scan (prevent duplicate scans)
    const { data: existingScan } = await supabase
      .from('sc_scan_results')
      .select('id, status')
      .eq('project_id', projectId)
      .in('status', ['PENDING', 'RUNNING'])
      .single();

    if (existingScan) {
      return {
        success: true,
        data: {
          scan_run_id: existingScan.id,
          status: existingScan.status,
        },
      };
    }

    // Create new scan run
    const { data: scanRun, error: scanError } = await supabase
      .from('sc_scan_results')
      .insert({
        project_id: projectId,
        network,
        target_address: targetAddress,
        status: 'PENDING',
        contract_address: targetAddress,
        chain: network,
        scan_provider: 'INTERNAL',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (scanError) {
      console.error('Failed to create scan run:', scanError);
      return { success: false, error: 'Failed to start scan' };
    }

    // Update project scan status
    await supabase
      .from('projects')
      .update({
        sc_scan_status: 'PENDING',
        sc_scan_last_run_id: scanRun.id,
      })
      .eq('id', projectId);

    // Trigger scan execution immediately
    try {
      // Call scanner execution API
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';
      await fetch(`${baseUrl}/api/scanner/${scanRun.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (executeError) {
      console.error('Failed to trigger scan execution:', executeError);
      // Non-blocking - scan will be picked up by batch processor
    }

    revalidatePath(`/projects/${projectId}`);

    return {
      success: true,
      data: {
        scan_run_id: scanRun.id,
        status: 'RUNNING',
      },
    };
  } catch (error: any) {
    console.error('Start scan error:', error);
    return { success: false, error: error.message || 'Failed to start scan' };
  }
}

/**
 * Get contract scan status (for polling)
 * GET /projects/:id/contract/scan/status
 */
export async function getContractScanStatus(projectId: string): Promise<
  ActionResult<{
    scan_run_id: string;
    status: string;
    risk_score: number | null;
    risk_flags: string[];
    summary: string | null;
    override_status: string | null;
  }>
> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = createClient();

    // Get latest scan run for project
    const { data: scanRun, error } = await supabase
      .from('sc_scan_results')
      .select('id, status, score, risk_flags, summary, override_status')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !scanRun) {
      return { success: false, error: 'No scan found' };
    }

    return {
      success: true,
      data: {
        scan_run_id: scanRun.id,
        status: scanRun.status,
        risk_score: scanRun.score,
        risk_flags: scanRun.risk_flags || [],
        summary: scanRun.summary,
        override_status: scanRun.override_status,
      },
    };
  } catch (error: any) {
    console.error('Get scan status error:', error);
    return { success: false, error: error.message || 'Failed to get scan status' };
  }
}

/**
 * Submit audit proof for project
 * POST /projects/:id/audit-proof/submit
 */
export async function submitAuditProof(
  projectId: string,
  proof: {
    auditor_name: string;
    report_url: string;
    report_hash?: string;
    audit_date?: string;
    scope?: object;
  }
): Promise<ActionResult<{ proof_id: string }>> {
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

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, owner_user_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return { success: false, error: 'Project not found' };
    }

    if (project.owner_user_id !== session.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate required fields
    if (!proof.auditor_name || proof.auditor_name.trim().length < 2) {
      return { success: false, error: 'Auditor name is required' };
    }

    if (!proof.report_url || !proof.report_url.startsWith('http')) {
      return { success: false, error: 'Valid report URL is required' };
    }

    // Insert audit proof
    const { data: auditProof, error } = await supabase
      .from('contract_audit_proofs')
      .insert({
        project_id: projectId,
        auditor_name: proof.auditor_name.trim(),
        report_url: proof.report_url.trim(),
        report_hash: proof.report_hash || null,
        audit_date: proof.audit_date || null,
        scope: proof.scope || {},
        status: 'PENDING',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to submit audit proof:', error);
      return { success: false, error: 'Failed to submit audit proof' };
    }

    revalidatePath(`/projects/${projectId}`);

    return {
      success: true,
      data: { proof_id: auditProof.id },
    };
  } catch (error: any) {
    console.error('Submit audit proof error:', error);
    return { success: false, error: error.message || 'Failed to submit audit proof' };
  }
}

/**
 * Get audit proofs for project
 */
export async function getProjectAuditProofs(projectId: string): Promise<ActionResult> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from('contract_audit_proofs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to get audit proofs' };
  }
}
