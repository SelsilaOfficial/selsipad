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
export async function saveFairlaunch(data: SaveFairlaunchData): Promise<SaveFairlaunchResult> {
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

    // Determine chain ID from network name
    const networkToChainId: Record<string, number> = {
      ethereum: 1,
      sepolia: 11155111,
      bnb: 56,
      bsc_testnet: 97,
      base: 8453,
      base_sepolia: 84532,
    };
    const chainId = networkToChainId[data.network] || 97;

    // 2. Create project record first
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: data.projectName,
        description: data.description,
        owner_user_id: session.userId,
        creator_id: session.userId, // ✅ Creator reference
        chain: data.network,
        chain_id: chainId, // ✅ Numeric chain ID
        logo_url: data.logoUrl || null,
        website: data.socialLinks.website || null,
        twitter: data.socialLinks.twitter || null,
        telegram: data.socialLinks.telegram || null,
        discord: data.socialLinks.discord || null,
        type: 'FAIRLAUNCH', // ✅ Project type
        submitted_at: new Date().toISOString(), // ✅ Submission timestamp
        contract_mode: 'LAUNCHPAD_TEMPLATE', // ✅ CHECK: LAUNCHPAD_TEMPLATE or EXTERNAL_CONTRACT
        contract_network: 'EVM', // ✅ CHECK: EVM or SOLANA

        // ✅ Factory metadata for SAFU badges
        token_address: data.tokenAddress,
        contract_address: data.fairlaunchAddress,
        deployment_tx_hash: data.transactionHash,
        factory_address:
          data.tokenSource === 'factory'
            ? process.env.NEXT_PUBLIC_SIMPLE_TOKEN_FACTORY_BSC_TESTNET || null
            : null,
        template_version: data.tokenSource === 'factory' ? 'v1.0' : null,

        // Auto-grant security badges for factory tokens in metadata
        metadata: data.tokenSource === 'factory' ? { security_badges: ['SAFU', 'SC_PASS'] } : {},

        status: 'LIVE',
        kyc_status: 'NONE',
        sc_scan_status: 'PASS',
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

    // 3b. chain string for launch_round (uses chainId already defined above)
    const chainStr = chainId.toString();

    // 4. Create launch_round record
    const { data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .insert({
        project_id: project.id,
        type: 'FAIRLAUNCH',
        chain: chainStr,
        chain_id: chainId, // ✅ Numeric chain ID
        token_address: data.tokenAddress,
        raise_asset: 'NATIVE',
        start_at: data.startTime,
        end_at: data.endTime,
        status: initialStatus,
        created_by: session.userId,
        sale_type: 'fairlaunch',
        // ✅ Top-level columns (not just in params)
        round_address: data.fairlaunchAddress, // ✅ Contract address
        contract_address: data.fairlaunchAddress,
        token_source: data.tokenSource, // ✅ 'factory' or 'existing'
        security_badges: data.securityBadges || [], // ✅ Badge array
        fee_splitter_address: data.feeSplitterAddress || null, // ✅ Fee splitter
        vesting_vault_address: data.vestingAddress || null, // ✅ Vesting vault
        deployed_at: new Date().toISOString(), // ✅ Deployment time
        deployment_tx_hash: data.transactionHash, // ✅ Tx hash
        // Store all fairlaunch-specific configuration in params JSONB
        params: {
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
          liquidity_tokens: Math.round(
            parseFloat(data.tokensForSale) * (data.liquidityPercent / 100)
          ).toString(),

          // Team vesting
          vesting_address: data.vestingBeneficiary,
          team_vesting_tokens: data.teamAllocation,
          vesting_schedule: data.vestingSchedule,

          // Social links
          social_links: data.socialLinks,

          // Network name
          network_name: data.network,
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
