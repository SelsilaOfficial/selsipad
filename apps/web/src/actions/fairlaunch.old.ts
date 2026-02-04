'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Save fairlaunch contract address to database after deployment
 */
export async function saveFairlaunchContract(data: {
  roundId: string;
  fairlaunchAddress: string;
  txHash: string;
  chainId: number;
}) {
  const supabase = createClient();

  console.log('💾 Saving fairlaunch contract:', data);

  const { error } = await supabase
    .from('launch_rounds')
    .update({
      round_address: data.fairlaunchAddress.toLowerCase(),
      chain_id: data.chainId,
      status: 'UPCOMING',
    })
    .eq('id', data.roundId);

  if (error) {
    console.error('Failed to save fairlaunch address:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Update fairlaunch creation to include project_id return
 */
export async function createFairlaunchDraftWithReturn(wizardData: any, walletAddress: string) {
  const supabase = createClient();

  // Get user by wallet
  const { data: wallet } = await supabase
    .from('wallets')
    .select('user_id')
    .eq('address', walletAddress.toLowerCase())
    .single();

  if (!wallet) {
    return { success: false, error: 'Wallet not found' };
  }

  try {
    // Create project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: wizardData.basics?.name || 'Unnamed Project',
        symbol: wizardData.basics?.symbol,
        description: wizardData.basics?.description,
        owner_user_id: wallet.user_id,
        status: 'DRAFT',
        kyc_status: 'NONE',
        sc_scan_status: 'IDLE',
        logo_url: wizardData.basics?.logo_url,
      })
      .select('id')
      .single();

    if (projectError || !project) {
      return { success: false, error: projectError?.message || 'Project creation failed' };
    }

    // Create launch round
    const {data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .insert({
        project_id: project.id,
        type: 'FAIRLAUNCH',
        // Map network string to chain ID
        chain: (() => {
          const networkMap: Record<string, string> = {
            localhost: '31337',
            ethereum: '1',
            bnb: '56',
            base: '8453',
            sepolia: '11155111',
            bsc_testnet: '97',
            base_sepolia: '84532',
            solana: 'SOLANA',
          };
          return networkMap[wizardData.basics?.network || 'localhost'] || '31337';
        })(),
        // Use temporary unique address until token is deployed (wallet + timestamp hash to avoid duplicates)
        token_address: wizardData.params?.token_address || `0x${walletAddress.slice(2, 10)}${Date.now().toString(16).padStart(32, '0')}`.slice(0, 42),
        raise_asset: wizardData.params?.payment_token || 'ETH',
        start_at: wizardData.params?.start_at || new Date(Date.now() + 60 * 60 * 1000).toISOString(), // Default: 1 hour from now
        end_at: wizardData.params?.end_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default: 7 days from now
        status: 'DRAFT',
        created_by: wallet.user_id,
        params: {
          softcap: wizardData.params?.softcap || '1',
          token_for_sale: wizardData.params?.tokens_for_sale || '1000000',
          min_contribution: wizardData.params?.min_contribution || '0.01',
          max_contribution: wizardData.params?.max_contribution || '10',
          listing_premium_bps: 500,
          lp_lock_duration_months: wizardData.liquidity?.lp_lock_months || 12,
          lp_liquidity_percent: wizardData.liquidity?.liquidity_percent || 70,
        },
      })
      .select('id')
      .single();

    if (roundError || !round) {
      return { success: false, error: roundError?.message || 'Round creation failed' };
    }

    return {
      success: true,
      projectId: project.id,
      roundId: round.id,
    };
  } catch (error: any) {
    console.error('Error creating fairlaunch draft:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Complete fairlaunch deployment - save contract addresses to database
 */
export async function completeFairlaunchDeployment(data: {
  roundId: string;
  projectId: string;
  fairlaunchAddress: string;
  vestingAddress?: string;
  txHash: string;
  chainId: number;
}) {
  const supabase = createClient();

  console.log('✅ Completing fairlaunch deployment:', data);

  try {
    // Update launch_rounds with contract address
    const { error: roundError } = await supabase
      .from('launch_rounds')
      .update({
        round_address: data.fairlaunchAddress.toLowerCase(),
        status: 'UPCOMING',
        chain_id: data.chainId,
      })
      .eq('id', data.roundId);

    if (roundError) {
      console.error('Failed to update launch round:', roundError);
      return { success: false, error: roundError.message };
    }

    // Update projects with contract address and set to ACTIVE
    const { error: projectError } = await supabase
      .from('projects')
      .update({
        contract_address: data.fairlaunchAddress.toLowerCase(),
        status: 'ACTIVE',
      })
      .eq('id', data.projectId);

    if (projectError) {
      console.error('Failed to update project:', projectError);
      return { success: false, error: projectError.message };
    }

    // If vesting contract exists, save reference (could add vesting_address column)
    // For now, we'll log it
    if (data.vestingAddress) {
      console.log('📝 Vesting contract deployed:', data.vestingAddress);
    }

    return { 
      success: true,
      message: 'Fairlaunch deployed successfully!',
    };
  } catch (error: any) {
    console.error('Error completing deployment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Parse FairlaunchCreated event from transaction logs
 * Event: FairlaunchCreated(uint256 indexed fairlaunchId, address indexed fairlaunch, address indexed vesting, address projectToken)
 */
export async function parseFairlaunchCreatedEvent(txHash: string) {
  // This would require viem client on server side
  // For now, return a simplified version - actual parsing will be done client-side
  // then passed to this function
  
  console.log('📝 Parse fairlaunch event from tx:', txHash);
  
  return {
    success: true,
    message: 'Event parsing should be done client-side with viem',
  };
}
