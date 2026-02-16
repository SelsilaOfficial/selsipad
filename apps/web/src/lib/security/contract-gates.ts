'use server';

import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';

interface SecurityGateResult {
  success: boolean;
  projectId?: string;
  shouldIssueBadge: boolean;
  badgeReason?: string;
  error?: string;
}

/**
 * Validate contract security for presale submission
 * Enforces STRICT mode for template audits and scan requirements for external contracts
 */
export async function validateContractSecurity(
  contractMode: 'EXTERNAL_CONTRACT' | 'LAUNCHPAD_TEMPLATE' | null,
  contractAddress: string | null,
  templateVersion: string,
  network: string,
  projectData: {
    name: string;
    description: string;
    owner_user_id: string;
    kyc_status: string;
  }
): Promise<SecurityGateResult> {
  const supabase = createClient();

  if (!contractMode) {
    // No contract mode specified - create project without security badge
    const { data: project, error } = await supabase
      .from('projects')
      .insert(projectData)
      .select()
      .single();

    if (error || !project) {
      return {
        success: false,
        shouldIssueBadge: false,
        error: 'Failed to create project',
      };
    }

    return {
      success: true,
      projectId: project.id,
      shouldIssueBadge: false,
    };
  }

  // EXTERNAL_CONTRACT mode
  if (contractMode === 'EXTERNAL_CONTRACT') {
    if (!contractAddress) {
      return {
        success: false,
        shouldIssueBadge: false,
        error: 'External contract mode requires contract address',
      };
    }

    // Create project with external contract info
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        ...projectData,
        contract_mode: 'EXTERNAL_CONTRACT',
        contract_network: network,
        contract_address: contractAddress,
      })
      .select()
      .single();

    if (projectError || !project) {
      return {
        success: false,
        shouldIssueBadge: false,
        error: 'Failed to create project',
      };
    }

    // Check if scan exists and passed
    const { data: scan } = await supabase
      .from('sc_scan_results')
      .select('status, override_status, override_reason')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const scanPassed = scan?.status === 'PASS';
    const overridePassed = scan?.override_status === 'PASS';

    if (!scanPassed && !overridePassed) {
      // Clean up project
      await supabase.from('projects').delete().eq('id', project.id);

      return {
        success: false,
        shouldIssueBadge: false,
        error:
          scan?.status === 'FAIL'
            ? 'Contract security scan failed. Please fix issues or request admin review.'
            : scan?.status === 'NEEDS_REVIEW'
              ? 'Contract scan is pending admin review. Please wait for approval.'
              : 'Contract security scan required. Please run a security scan first.',
      };
    }

    // Scan passed - issue badge
    return {
      success: true,
      projectId: project.id,
      shouldIssueBadge: true,
      badgeReason: overridePassed
        ? `External contract scan overridden to PASS by admin: ${scan.override_reason}`
        : 'External contract passed security scan',
    };
  }

  // LAUNCHPAD_TEMPLATE mode
  if (contractMode === 'LAUNCHPAD_TEMPLATE') {
    // Check template audit registry (STRICT)
    const { data: templateAudit } = await supabase
      .from('template_audits')
      .select('status, implementation_hash, audit_report_ref')
      .eq('network', network)
      .eq('template_version', templateVersion)
      .eq('status', 'VALID')
      .single();

    // Create project with template info
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        ...projectData,
        contract_mode: 'LAUNCHPAD_TEMPLATE',
        contract_network: network,
        template_version: templateVersion,
        implementation_hash: templateAudit?.implementation_hash || null,
      })
      .select()
      .single();

    if (projectError || !project) {
      return {
        success: false,
        shouldIssueBadge: false,
        error: 'Failed to create project',
      };
    }

    // Issue badge ONLY if template is audited (STRICT)
    const shouldIssueBadge = !!templateAudit;

    return {
      success: true,
      projectId: project.id,
      shouldIssueBadge,
      badgeReason: shouldIssueBadge
        ? `Deployed from audited template ${templateVersion}`
        : undefined,
    };
  }

  return {
    success: false,
    shouldIssueBadge: false,
    error: 'Invalid contract mode',
  };
}

/**
 * Issue PROJECT_AUDITED badge to a project
 */
export async function issueProjectAuditedBadge(
  projectId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // Get PROJECT_AUDITED badge ID
  const { data: badge } = await supabase
    .from('badge_definitions')
    .select('id')
    .eq('badge_key', 'PROJECT_AUDITED')
    .single();

  if (!badge) {
    return { success: false, error: 'PROJECT_AUDITED badge not found' };
  }

  // Issue badge
  const { error } = await supabase.from('project_badges').upsert(
    {
      project_id: projectId,
      badge_id: badge.id,
      awarded_by: null, // Auto-award (system)
      reason,
    },
    { onConflict: 'project_id,badge_id' }
  );

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
