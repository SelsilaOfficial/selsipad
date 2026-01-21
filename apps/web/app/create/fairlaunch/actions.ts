'use server';

import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { validateComplianceGates } from '@/../../packages/shared/src/validators/presale-wizard';

interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

interface FairlaunchConfig {
  basics?: any;
  sale_params?: any;
  team_vesting?: any;
  lp_lock?: any;
  fees_referral?: any;
}

/**
 * Create or update a fairlaunch draft
 */
export async function createFairlaunchDraft(
  config: Partial<FairlaunchConfig>,
  walletAddress: string
): Promise<ActionResult> {
  try {
    const supabase = createClient();

    // Check authentication (Pattern 68: Wallet-Only Auth)
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Prepare draft data - key difference: sale_type = 'fairlaunch', hardcap = NULL
    const draftData = {
      created_by: session.userId,
      status: 'DRAFT',
      sale_type: 'fairlaunch', // Key differentiator
      network: config.basics?.network || 'ethereum',
      type: 'FAIRLAUNCH',
      token_address: config.sale_params?.token_address || '',
      raise_asset: config.sale_params?.payment_token || 'NATIVE',
      start_at: config.sale_params?.start_at || new Date(Date.now() + 3600000).toISOString(),
      end_at: config.sale_params?.end_at || new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
      params: {
        // Fairlaunch params - no hardcap
        price: null, // Dynamic price calculation
        softcap: parseFloat(config.sale_params?.softcap || '0'),
        hardcap: null, // Fairlaunch has no hardcap
        token_for_sale: parseFloat(config.sale_params?.total_tokens || '0'),
        min_contribution: parseFloat(config.sale_params?.min_contribution || '0'),
        max_contribution: parseFloat(config.sale_params?.max_contribution || '0'),
        // Vesting
        team_vesting: config.team_vesting,
        // LP Lock - minimum 70% for fairlaunch
        lp_lock: config.lp_lock,
        // Additional metadata
        project_name: config.basics?.name,
        project_description: config.basics?.description,
        logo_url: config.basics?.logo_url,
        banner_url: config.basics?.banner_url,
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
      console.error('Failed to save fairlaunch draft:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/owner/fairlaunch');
    return { success: true, data };
  } catch (error: any) {
    console.error('Fairlaunch draft save error:', error);
    return { success: false, error: error.message || 'Failed to save draft' };
  }
}

/**
 * Submit fairlaunch for admin review
 */
export async function submitFairlaunch(
  config: FairlaunchConfig,
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

    // Validate compliance gates (fairlaunch specific)
    const complianceStatus = {
      kyc_status: (kycData?.status || 'PENDING') as any,
      sc_scan_status: 'NOT_REQUESTED' as any,
      investor_vesting_valid: true, // Not required for fairlaunch
      team_vesting_valid:
        config.team_vesting?.schedule?.reduce((sum, s) => sum + s.percentage, 0) === 100,
      lp_lock_valid:
        (config.lp_lock?.duration_months || 0) >= 12 && (config.lp_lock?.percentage || 0) >= 70, // Fairlaunch minimum 70%
    };

    const { valid, violations } = validateComplianceGates(complianceStatus);

    if (!valid) {
      return {
        success: false,
        error: 'Compliance requirements not met: ' + violations.join(', '),
      };
    }

    // Validate fairlaunch-specific requirements
    if ((config.lp_lock?.percentage || 0) < 70) {
      return {
        success: false,
        error: 'Fairlaunch requires minimum 70% liquidity allocation',
      };
    }

    // Create fairlaunch record
    const fairlaunchData = {
      created_by: session.userId,
      status: 'SUBMITTED_FOR_REVIEW',
      sale_type: 'fairlaunch', // Key differentiator
      network: config.basics.network,
      type: 'FAIRLAUNCH',
      token_address: config.sale_params.token_address,
      raise_asset: config.sale_params.payment_token,
      start_at: config.sale_params.start_at,
      end_at: config.sale_params.end_at,
      params: {
        price: null, // Dynamic price: total_raised / token_for_sale
        softcap: parseFloat(config.sale_params.softcap),
        hardcap: null, // No hardcap for fairlaunch
        token_for_sale: parseFloat(config.sale_params.total_tokens),
        min_contribution: parseFloat(config.sale_params.min_contribution),
        max_contribution: parseFloat(config.sale_params.max_contribution),
        team_vesting: config.team_vesting,
        lp_lock: config.lp_lock,
        project_name: config.basics.name,
        project_description: config.basics.description,
        logo_url: config.basics.logo_url,
        banner_url: config.basics.banner_url,
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
      .insert(fairlaunchData)
      .select()
      .single();

    if (error) {
      console.error('Failed to submit fairlaunch:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/owner/fairlaunch');
    revalidatePath('/admin/fairlaunch/review');

    return { success: true, data };
  } catch (error: any) {
    console.error('Fairlaunch submit error:', error);
    return { success: false, error: error.message || 'Failed to submit fairlaunch' };
  }
}

/**
 * Update fairlaunch draft
 */
export async function updateFairlaunchDraft(
  roundId: string,
  config: Partial<FairlaunchConfig>
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
      .select('created_by, status, sale_type')
      .eq('id', roundId)
      .single();

    if (!existing || existing.created_by !== session.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    if (existing.sale_type !== 'fairlaunch') {
      return { success: false, error: 'Not a fairlaunch round' };
    }

    if (existing.status !== 'DRAFT') {
      return { success: false, error: 'Can only update DRAFT fairlaunches' };
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
        price: null, // Dynamic
        softcap: parseFloat(config.sale_params.softcap || '0'),
        hardcap: null, // No hardcap
        token_for_sale: parseFloat(config.sale_params.total_tokens || '0'),
        min_contribution: parseFloat(config.sale_params.min_contribution || '0'),
        max_contribution: parseFloat(config.sale_params.max_contribution || '0'),
      }),
      team_vesting: config.team_vesting,
      lp_lock: config.lp_lock,
      project_name: config.basics?.name,
      project_description: config.basics?.description,
      logo_url: config.basics?.logo_url,
      banner_url: config.basics?.banner_url,
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

    revalidatePath('/dashboard/owner/fairlaunch');
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update draft' };
  }
}

/**
 * Delete fairlaunch draft
 */
export async function deleteFairlaunchDraft(roundId: string): Promise<ActionResult> {
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
      .select('created_by, status, sale_type')
      .eq('id', roundId)
      .single();

    if (!existing || existing.created_by !== session.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    if (existing.sale_type !== 'fairlaunch') {
      return { success: false, error: 'Not a fairlaunch round' };
    }

    if (existing.status !== 'DRAFT') {
      return { success: false, error: 'Can only delete DRAFT fairlaunches' };
    }

    const { error } = await supabase.from('launch_rounds').delete().eq('id', roundId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/owner/fairlaunch');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete draft' };
  }
}
