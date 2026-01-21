'use server';

import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

interface BondingCurveConfig {
  basics?: any;
  curve_params?: any;
  team_vesting?: any;
  fees?: any;
}

/**
 * Create or update a bonding curve draft
 */
export async function createBondingCurveDraft(
  config: Partial<BondingCurveConfig>,
  walletAddress: string
): Promise<ActionResult> {
  try {
    const supabase = createClient();

    // Check authentication (Pattern 68: Wallet-Only Auth)
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Prepare draft data for bonding_pools table
    const draftData = {
      creator_wallet: walletAddress,
      status: 'DRAFT',
      token_name: config.basics?.name || '',
      token_symbol: config.basics?.symbol || '',
      token_description: config.basics?.description || '',
      token_image_url: config.basics?.logo_url || '',
      initial_virtual_sol_reserves: parseFloat(
        config.curve_params?.initial_virtual_sol_reserves || '30'
      ),
      initial_virtual_token_reserves: parseFloat(
        config.curve_params?.initial_virtual_token_reserves || '1073000000'
      ),
      graduation_threshold_sol: parseFloat(config.curve_params?.graduation_threshold_sol || '85'),
      swap_fee_bps: config.fees?.swap_fee_bps || 150, // 1.5%
      metadata: {
        team_vesting: config.team_vesting,
        deploy_fee_sol: config.fees?.deploy_fee_sol || '0.5',
        migration_fee_sol: config.fees?.migration_fee_sol || '2.5',
        banner_url: config.basics?.banner_url,
      },
    };

    // Insert draft
    const { data, error } = await supabase
      .from('bonding_pools')
      .insert(draftData)
      .select()
      .single();

    if (error) {
      console.error('Failed to save bonding curve draft:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/bonding-curve');
    return { success: true, data };
  } catch (error: any) {
    console.error('Bonding curve draft save error:', error);
    return { success: false, error: error.message || 'Failed to save draft' };
  }
}

/**
 * Submit bonding curve for deployment (permissionless - no admin review)
 */
export async function submitBondingCurve(
  config: BondingCurveConfig,
  walletAddress: string
): Promise<ActionResult> {
  try {
    const supabase = createClient();

    // Check authentication (Pattern 68: Wallet-Only Auth)
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Validate team vesting is configured (MANDATORY for bonding curve)
    if (
      !config.team_vesting?.schedule ||
      config.team_vesting.schedule.length === 0 ||
      config.team_vesting.schedule.reduce((sum, s) => sum + s.percentage, 0) !== 100
    ) {
      return {
        success: false,
        error: 'Team vesting is mandatory and must total 100%',
      };
    }

    // Create bonding curve pool - status is DEPLOYING (permissionless)
    const poolData = {
      creator_wallet: walletAddress,
      status: 'DEPLOYING', // No admin review needed - goes straight to deployment
      token_name: config.basics.name,
      token_symbol: config.basics.symbol,
      token_description: config.basics.description,
      token_image_url: config.basics.logo_url,
      initial_virtual_sol_reserves: parseFloat(config.curve_params.initial_virtual_sol_reserves),
      initial_virtual_token_reserves: parseFloat(
        config.curve_params.initial_virtual_token_reserves
      ),
      graduation_threshold_sol: parseFloat(config.curve_params.graduation_threshold_sol),
      swap_fee_bps: config.fees?.swap_fee_bps || 150,
      metadata: {
        team_vesting: config.team_vesting,
        deploy_fee_sol: config.fees?.deploy_fee_sol || '0.5',
        migration_fee_sol: config.fees?.migration_fee_sol || '2.5',
        banner_url: config.basics?.banner_url,
        created_at: new Date().toISOString(),
      },
    };

    const { data, error } = await supabase.from('bonding_pools').insert(poolData).select().single();

    if (error) {
      console.error('Failed to submit bonding curve:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/bonding-curve');

    return { success: true, data };
  } catch (error: any) {
    console.error('Bonding curve submit error:', error);
    return { success: false, error: error.message || 'Failed to submit bonding curve' };
  }
}

/**
 * Update bonding curve draft
 */
export async function updateBondingCurveDraft(
  poolId: string,
  config: Partial<BondingCurveConfig>
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
      .from('bonding_pools')
      .select('creator_wallet, status')
      .eq('id', poolId)
      .single();

    if (!existing || existing.creator_wallet !== walletAddress) {
      return { success: false, error: 'Unauthorized' };
    }

    if (existing.status !== 'DRAFT') {
      return { success: false, error: 'Can only update DRAFT bonding curves' };
    }

    // Update
    const updateData: any = {
      token_name: config.basics?.name,
      token_symbol: config.basics?.symbol,
      token_description: config.basics?.description,
      token_image_url: config.basics?.logo_url,
    };

    if (config.curve_params) {
      updateData.initial_virtual_sol_reserves = parseFloat(
        config.curve_params.initial_virtual_sol_reserves
      );
      updateData.initial_virtual_token_reserves = parseFloat(
        config.curve_params.initial_virtual_token_reserves
      );
      updateData.graduation_threshold_sol = parseFloat(
        config.curve_params.graduation_threshold_sol
      );
    }

    // Update metadata field
    const { data: current } = await supabase
      .from('bonding_pools')
      .select('metadata')
      .eq('id', poolId)
      .single();

    updateData.metadata = {
      ...(current?.metadata || {}),
      team_vesting: config.team_vesting,
      banner_url: config.basics?.banner_url,
    };

    const { data, error } = await supabase
      .from('bonding_pools')
      .update(updateData)
      .eq('id', poolId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/bonding-curve');
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update draft' };
  }
}

/**
 * Delete bonding curve draft
 */
export async function deleteBondingCurveDraft(poolId: string): Promise<ActionResult> {
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
      .from('bonding_pools')
      .select('creator_wallet, status')
      .eq('id', poolId)
      .single();

    if (!existing || existing.creator_wallet !== walletAddress) {
      return { success: false, error: 'Unauthorized' };
    }

    if (existing.status !== 'DRAFT') {
      return { success: false, error: 'Can only delete DRAFT bonding curves' };
    }

    const { error } = await supabase.from('bonding_pools').delete().eq('id', poolId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/bonding-curve');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete draft' };
  }
}
