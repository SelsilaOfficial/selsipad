'use server';

import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import type { FullPresaleConfig } from '@/../../packages/shared/src/validators/presale-wizard';
import { validateComplianceGates } from '@/../../packages/shared/src/validators/presale-wizard';
import { validateContractSecurity, issueProjectAuditedBadge } from '@/lib/security/contract-gates';

interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Create or update a presale draft
 */
export async function createPresaleDraft(
  config: Partial<FullPresaleConfig>,
  walletAddress: string
): Promise<ActionResult> {
  try {
    const supabase = createClient();

    // Check authentication (Pattern 68: Wallet-Only Auth)
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // ============================================
    // CREATE/GET PROJECT FOR DRAFT
    // ============================================
    // We need a project_id for launch_rounds
    // Use validateContractSecurity which creates project if needed
    const network = config.basics?.network || 'ethereum';

    const securityResult = await validateContractSecurity(
      'LAUNCHPAD_TEMPLATE', // Default mode for draft
      null, // No contract address yet
      '1.0.0', // Default template version
      network,
      {
        name: config.basics?.name || 'Untitled Presale',
        description: config.basics?.description || '',
        owner_user_id: session.userId,
        kyc_status: 'PENDING',
      }
    );

    if (!securityResult.success || !securityResult.projectId) {
      return { success: false, error: 'Failed to create project for draft' };
    }

    const projectId = securityResult.projectId;

    // Map network to chain format (database uses 'chain' column)
    const chainMapping: Record<string, string> = {
      ethereum: '1',
      bsc: '56',
      polygon: '137',
      avalanche: '43114',
      solana: 'SOLANA',
    };

    // Prepare draft data
    const draftData = {
      project_id: projectId,
      created_by: session.userId,
      status: 'DRAFT',
      chain: chainMapping[network] || '1', // Use 'chain' not 'network'
      type: 'PRESALE', // Default to presale
      token_address: config.sale_params?.token_address || '',
      raise_asset: config.sale_params?.payment_token || 'NATIVE',
      start_at: config.sale_params?.start_at || new Date(Date.now() + 3600000).toISOString(),
      end_at: config.sale_params?.end_at || new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
      params: {
        // Presale params
        price: parseFloat(config.sale_params?.price || '0'),
        softcap: parseFloat(config.sale_params?.softcap || '0'),
        hardcap: parseFloat(config.sale_params?.hardcap || '0'),
        token_for_sale: parseFloat(config.sale_params?.total_tokens || '0'),
        min_contribution: parseFloat(config.sale_params?.min_contribution || '0'),
        max_contribution: parseFloat(config.sale_params?.max_contribution || '0'),
        // Vesting
        investor_vesting: config.investor_vesting,
        team_vesting: config.team_vesting,
        // LP Lock
        lp_lock: config.lp_lock,
        // Additional metadata
        project_name: config.basics?.name,
        project_description: config.basics?.description,
        logo_url: config.basics?.logo_url,
        banner_url: config.basics?.banner_url,
        anti_bot: config.anti_bot,
        fees_referral: config.fees_referral,
      },
    };

    // Insert draft
    const { data, error } = await supabase
      .from('launch_rounds')
      .insert(draftData)
      .select()
      .single();

    if (error) {
      console.error('Failed to save draft:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/owner/presales');
    return {
      success: true,
      data: {
        ...data,
        project_id: projectId, // Include project_id for contract scanning
      },
    };
  } catch (error: any) {
    console.error('Draft save error:', error);
    return { success: false, error: error.message || 'Failed to save draft' };
  }
}

/**
 * Submit presale for admin review
 */
export async function submitPresale(
  config: FullPresaleConfig,
  walletAddress: string
): Promise<ActionResult> {
  try {
    const supabase = createClient();

    // Check authentication (Pattern 68: Wallet-Only Auth)
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Fetch KYC status
    const { data: kycData } = await supabase
      .from('kyc_submissions')
      .select('status')
      .eq('wallet_address', walletAddress)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const kycStatus = kycData?.status || 'PENDING';

    // ============================================
    // CONTRACT SECURITY VALIDATION (NEW)
    // ============================================

    const contractMode = (config as any).contract?.mode;
    const contractAddress = (config as any).contract?.address;
    const templateVersion = (config as any).contract?.template_version || '1.0.0';

    const securityResult = await validateContractSecurity(
      contractMode,
      contractAddress,
      templateVersion,
      config.basics.network,
      {
        name: config.basics.name,
        description: config.basics.description || '',
        owner_user_id: session.userId,
        kyc_status: kycStatus,
      }
    );

    if (!securityResult.success) {
      return {
        success: false,
        error: securityResult.error || 'Contract security validation failed',
      };
    }

    const projectId = securityResult.projectId!;

    // Issue PROJECT_AUDITED badge if eligible
    if (securityResult.shouldIssueBadge && securityResult.badgeReason) {
      await issueProjectAuditedBadge(projectId, securityResult.badgeReason);
    }

    // Update project with launch round reference (will be added after presale creation)
    // ============================================
    // END CONTRACT SECURITY VALIDATION
    // ============================================

    // Validate compliance gates
    const complianceStatus = {
      kyc_status: (kycData?.status || 'PENDING') as any,
      sc_scan_status: 'NOT_REQUESTED' as any, // TODO: Fetch real SC scan status
      investor_vesting_valid:
        config.investor_vesting.schedule.reduce((sum, s) => sum + s.percentage, 0) === 100,
      team_vesting_valid:
        config.team_vesting.schedule.reduce((sum, s) => sum + s.percentage, 0) === 100,
      lp_lock_valid: config.lp_lock.duration_months >= 12,
    };

    const { valid, violations } = validateComplianceGates(complianceStatus);

    if (!valid) {
      return {
        success: false,
        error: 'Compliance requirements not met: ' + violations.join(', '),
      };
    }

    // Create presale record
    const presaleData = {
      created_by: session.userId,
      status: 'SUBMITTED_FOR_REVIEW',
      network: config.basics.network,
      type: 'PRESALE',
      token_address: config.sale_params.token_address,
      raise_asset: config.sale_params.payment_token,
      start_at: config.sale_params.start_at,
      end_at: config.sale_params.end_at,
      params: {
        price: parseFloat(config.sale_params.price),
        softcap: parseFloat(config.sale_params.softcap),
        hardcap: parseFloat(config.sale_params.hardcap),
        token_for_sale: parseFloat(config.sale_params.total_tokens),
        min_contribution: parseFloat(config.sale_params.min_contribution),
        max_contribution: parseFloat(config.sale_params.max_contribution),
        investor_vesting: config.investor_vesting,
        team_vesting: config.team_vesting,
        lp_lock: config.lp_lock,
        project_name: config.basics.name,
        project_description: config.basics.description,
        logo_url: config.basics.logo_url,
        banner_url: config.basics.banner_url,
        anti_bot: config.anti_bot,
        fees_referral: config.fees_referral,
      },
      compliance_snapshot: {
        kyc_status: complianceStatus.kyc_status,
        sc_scan_status: complianceStatus.sc_scan_status,
        submitted_at: new Date().toISOString(),
      },
    };

    const { data, error } = await supabase
      .from('launch_rounds')
      .insert(presaleData)
      .select()
      .single();

    if (error) {
      console.error('Failed to submit presale:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/owner/presales');
    revalidatePath('/admin/presales/review');

    return { success: true, data };
  } catch (error: any) {
    console.error('Submit error:', error);
    return { success: false, error: error.message || 'Failed to submit presale' };
  }
}

/**
 * Update presale draft
 */
export async function updatePresaleDraft(
  roundId: string,
  config: Partial<FullPresaleConfig>
): Promise<ActionResult> {
  try {
    const supabase = createClient();

    // Check authentication (Pattern 68: Wallet-Only Auth)
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const walletAddress = session.address;

    // Verify ownership
    const { data: existing } = await supabase
      .from('launch_rounds')
      .select('created_by, status')
      .eq('id', roundId)
      .single();

    if (!existing || existing.created_by !== session.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    if (existing.status !== 'DRAFT') {
      return { success: false, error: 'Can only update DRAFT presales' };
    }

    // Update
    const updateData: any = {};

    if (config.basics) {
      updateData.network = config.basics.network;
    }

    if (config.sale_params) {
      updateData.token_address = config.sale_params.token_address;
      updateData.raise_asset = config.sale_params.payment_token;
      updateData.start_at = config.sale_params.start_at;
      updateData.end_at = config.sale_params.end_at;
    }

    // Update params field
    const { data: current } = await supabase
      .from('launch_rounds')
      .select('params')
      .eq('id', roundId)
      .single();

    updateData.params = {
      ...(current?.params || {}),
      ...(config.sale_params && {
        price: parseFloat(config.sale_params.price || '0'),
        softcap: parseFloat(config.sale_params.softcap || '0'),
        hardcap: parseFloat(config.sale_params.hardcap || '0'),
        token_for_sale: parseFloat(config.sale_params.total_tokens || '0'),
        min_contribution: parseFloat(config.sale_params.min_contribution || '0'),
        max_contribution: parseFloat(config.sale_params.max_contribution || '0'),
      }),
      investor_vesting: config.investor_vesting,
      team_vesting: config.team_vesting,
      lp_lock: config.lp_lock,
      project_name: config.basics?.name,
      project_description: config.basics?.description,
      logo_url: config.basics?.logo_url,
      banner_url: config.basics?.banner_url,
      anti_bot: config.anti_bot,
      fees_referral: config.fees_referral,
    };

    const { data, error } = await supabase
      .from('launch_rounds')
      .update(updateData)
      .eq('id', roundId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/owner/presales');
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update draft' };
  }
}

/**
 * Delete presale draft
 */
export async function deletePresaleDraft(roundId: string): Promise<ActionResult> {
  try {
    const supabase = createClient();

    // Check authentication (Pattern 68: Wallet-Only Auth)
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const walletAddress = session.address;

    // Verify ownership and status
    const { data: existing } = await supabase
      .from('launch_rounds')
      .select('created_by, status')
      .eq('id', roundId)
      .single();

    if (!existing || existing.created_by !== session.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    if (existing.status !== 'DRAFT') {
      return { success: false, error: 'Can only delete DRAFT presales' };
    }

    const { error } = await supabase.from('launch_rounds').delete().eq('id', roundId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/owner/presales');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete draft' };
  }
}

/**
 * Check if user has DEVELOPER_KYC_VERIFIED badge
 * Used for gating access to presale creation page
 */
export async function checkUserHasDevKYC(
  walletAddress: string
): Promise<ActionResult<{ hasBadge: boolean }>> {
  try {
    const supabase = createClient();

    // Get session to get user ID
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Query badge_instances for DEVELOPER_KYC_VERIFIED badge
    const { data: badgeData } = await supabase
      .from('badge_instances')
      .select(
        `
        id,
        badge_id,
        badge_definitions!inner (badge_key)
      `
      )
      .eq('user_id', session.userId)
      .eq('badge_definitions.badge_key', 'DEVELOPER_KYC_VERIFIED')
      .limit(1)
      .single();

    const hasBadge = !!badgeData;

    return {
      success: true,
      data: { hasBadge },
    };
  } catch (error: any) {
    console.error('Check KYC badge error:', error);
    return {
      success: true,
      data: { hasBadge: false }, // Default to false on error
    };
  }
}

/**
 * Get template audit status from registry
 * Used to verify if a launchpad template is audited and VALID
 */
export async function getTemplateAuditStatus(
  network: string,
  templateVersion: string
): Promise<ActionResult<{ status: 'VALID' | 'REVOKED' | 'NOT_FOUND'; audit_report_ref?: string }>> {
  try {
    const supabase = createClient();

    // Query template_audits registry
    const { data: templateData, error } = await supabase
      .from('template_audits')
      .select('status, audit_report_ref, audit_provider, audited_at')
      .eq('network', network)
      .eq('template_version', templateVersion)
      .eq('status', 'VALID') // Only return VALID templates
      .limit(1)
      .single();

    if (error || !templateData) {
      return {
        success: true,
        data: { status: 'NOT_FOUND' },
      };
    }

    return {
      success: true,
      data: {
        status: templateData.status as 'VALID' | 'REVOKED',
        audit_report_ref: templateData.audit_report_ref,
      },
    };
  } catch (error: any) {
    console.error('Get template audit status error:', error);
    return {
      success: false,
      error: error.message || 'Failed to get template audit status',
    };
  }
}
