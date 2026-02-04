'use server';

import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';

interface SaveFairlaunchData {
  // Wizard data
  network: string;
  tokenAddress: string;
  tokenSource: 'factory' | 'existing';
  securityBadges: string[];
  
  // Token metadata
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  tokenTotalSupply?: string;
  
  projectName: string;
  description: string;
  logoUrl?: string;
  socialLinks: {
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
  tokensForSale: string;
  softcap: string;
  startTime: string;
  endTime: string;
  minContribution: string;
  maxContribution: string;
  dexPlatform: string;
  listingPremiumBps: number;
  liquidityPercent: number;
  lpLockMonths: number;
  teamAllocation: string;
  vestingBeneficiary: string;
  vestingSchedule: Array<{ month: number; percentage: number }>;

  // Deployed contracts
  fairlaunchAddress: string;
  vestingAddress?: string;
  feeSplitterAddress?: string;
  transactionHash: string;
}

interface SaveFairlaunchResult {
  success: boolean;
  fairlaunchId?: string;
  projectId?: string;
  error?: string;
}

/**
 * Save fairlaunch to database after successful deployment
 * Creates both project and launch_round records
 * 
 * @param data - Complete wizard data + deployed contract addresses
 * @returns Database IDs or error
 */
export async function saveFairlaunch(
  data: SaveFairlaunchData
): Promise<SaveFairlaunchResult> {
  try {
    // 1. Check authentication
    const session = await getServerSession();
    if (!session || !session.userId) {
      return {
        success: false,
        error: 'Unauthorized - please login',
      };
    }

    const supabase = createClient();

    // 1.5. Check for duplicates based on creator + token address + approximate time
    // This prevents users from accidentally deploying the same fairlaunch twice
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentDuplicate } = await supabase
      .from('launch_rounds')
      .select('id')
      .eq('created_by', session.userId)
      .eq('token_address', data.tokenAddress)
      .gte('created_at', fiveMinutesAgo)
      .single();
    
    if (recentDuplicate) {
      console.warn('Duplicate fairlaunch detected (same token + user within 5 min)');
      return {
        success: true,
        fairlaunchId: recentDuplicate.id,
        projectId: undefined,
      };
    }

    // 2. Create project record first
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: data.projectName,
        description: data.description,
        owner_user_id: session.userId, // Correct column name from schema
        chain: data.network,
        logo_url: data.logoUrl || null,
        // Store basic social links (only these 3 columns exist in projects table)
        website: data.socialLinks.website || null,
        twitter: data.socialLinks.twitter || null,
        telegram: data.socialLinks.telegram || null,
        // Note: Discord will be stored in launch_rounds.params instead
        // Auto-approved for fairlaunch (no KYC/admin review)
        status: 'LIVE', // Valid values: DRAFT, SUBMITTED, IN_REVIEW, APPROVED, REJECTED, LIVE, ENDED
        kyc_status: 'NONE', // Valid values: NONE, PENDING, VERIFIED, REJECTED
        sc_scan_status: 'PASS', // Valid values: IDLE, PENDING, RUNNING, PASS, FAIL, NEEDS_REVIEW
      })
      .select()
      .single();

    if (projectError || !project) {
      console.error('Failed to create project:', projectError);
      return {
        success: false,
        error: 'Failed to save project: ' + (projectError?.message || 'Unknown error'),
      };
    }

    // 3. Determine initial status based on start time
    const now = new Date();
    const startAt = new Date(data.startTime);
    // Valid status values: DRAFT, SUBMITTED, APPROVED, LIVE, ENDED, FINALIZED, REJECTED
    const initialStatus = startAt > now ? 'APPROVED' : 'LIVE';

    // 3b. Convert network name to chain ID (schema requires numeric string or 'SOLANA')
    const networkToChainId: Record<string, string> = {
      ethereum: '1',
      sepolia: '11155111',
      bnb: '56',
      bsc_testnet: '97',
      base: '8453',
      base_sepolia: '84532',
    };
    const chainId = networkToChainId[data.network] || data.network;

    // 4. Create launch_round record
    const { data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .insert({
        project_id: project.id,
        type: 'FAIRLAUNCH', // Valid values: PRESALE, FAIRLAUNCH
        chain: chainId, // Must be numeric string for EVM or 'SOLANA'
        token_address: data.tokenAddress,
        raise_asset: 'NATIVE', // Fairlaunch always uses native token
        start_at: data.startTime,
        end_at: data.endTime,
        status: initialStatus,
        created_by: session.userId,
        // Store all fairlaunch-specific configuration in params JSONB
        params: {
          // Token source metadata
          token_source: data.tokenSource, // 'factory' or 'existing'
          security_badges: data.securityBadges,
          
          // Token metadata
          token_name: data.tokenName,
          token_symbol: data.tokenSymbol,
          token_address: data.tokenAddress,
          token_decimals: data.tokenDecimals || 18,
          token_total_supply: data.tokenTotalSupply,
          
          // Contract addresses
          round_address: data.fairlaunchAddress,
          vesting_vault_address: data.vestingAddress || null,
          fee_splitter_address: data.feeSplitterAddress || null,
          
          // Listing configuration
          listing_premium_bps: data.listingPremiumBps,
          
          // Sale parameters
          tokens_for_sale: data.tokensForSale,
          softcap: data.softcap,
          min_contribution: data.minContribution,
          max_contribution: data.maxContribution,
          dex_platform: data.dexPlatform,
          
          // Liquidity configuration
          liquidity_percent: data.liquidityPercent,
          lp_lock_months: data.lpLockMonths,
          
          // Team vesting
          team_allocation: data.teamAllocation,
          vesting_beneficiary: data.vestingBeneficiary,
          vesting_schedule: data.vestingSchedule,
          
          // Full social links (4 platforms)
          social_links: data.socialLinks,
          
          // Project info (stored in both places for easy access)
          project_name: data.projectName,
          project_description: data.description,
          logo_url: data.logoUrl,
          
          // Network name (for easy display)
          network_name: data.network, // e.g., 'bsc_testnet', 'sepolia'
          
          // Deployment metadata
          deployed_at: new Date().toISOString(),
          deployment_tx: data.transactionHash,
        },
      })
      .select()
      .single();

    if (roundError || !round) {
      console.error('Failed to create launch round:', roundError);
      
      // Cleanup: delete the project if round creation failed
      await supabase.from('projects').delete().eq('id', project.id);
      
      return {
        success: false,
        error: 'Failed to save fairlaunch: ' + (roundError?.message || 'Unknown error'),
      };
    }

    // 5. Success!
    return {
      success: true,
      fairlaunchId: round.id,
      projectId: project.id,
    };
  } catch (error: any) {
    console.error('saveFairlaunch error:', error);
    return {
      success: false,
      error: error.message || 'Unexpected error saving fairlaunch',
    };
  }
}
