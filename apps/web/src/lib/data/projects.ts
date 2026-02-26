// Data layer for Projects - REAL API INTEGRATION
// Replaces stub data with Supabase queries

import { createClient } from '@/lib/supabase/client';

export interface Project {
  id: string;
  name: string;
  symbol: string;
  logo: string; // Maps to logo_url in DB
  banner?: string; // Maps to banner_url/cover_image
  description: string;
  type: 'presale' | 'fairlaunch' | 'bonding_curve';
  network: 'SOL' | 'EVM';
  chain?: string; // Specific chain ID (97, 56, 1, 11155111, 8453, 84532, etc.)
  currency: string; // BNB, ETH, SOL
  status: 'live' | 'upcoming' | 'ended';
  raised: number;
  target: number;
  softcap?: number;
  participants?: number;
  kyc_verified: boolean;
  audit_status: 'pass' | 'pending' | null;
  lp_lock: boolean;
  contract_address?: string; // Fairlaunch/Presale contract address
  token_address?: string; // Token contract address
  vesting_address?: string; // Vesting contract address
  startDate?: string; // ISO timestamp for countdown
  endDate?: string; // ISO timestamp for countdown
  metadata?: any; // Generic metadata object
  factory_address?: string; // Factory address for SAFU check
  min_contribution?: number;
  max_contribution?: number;
  tokenomics?: {
    total_supply: number;
    tokens_for_presale: number;
    tokens_for_liquidity: number;
    team_allocation: number;
    liquidity_percent: number;
  };
}

/**
 * Get Trending Projects
 *
 * Fetches top trending projects from the latest snapshot
 * Uses the trending_projects table populated by the worker
 */
export async function getTrendingProjects(): Promise<Project[]> {
  const supabase = createClient();

  try {
    // Get the latest snapshot
    const { data: latestSnapshot } = await supabase
      .from('trending_snapshots')
      .select('id')
      .order('computed_at', { ascending: false })
      .limit(1)
      .single();

    if (!latestSnapshot) {
      console.warn('No trending snapshots found');
      return [];
    }

    // Get trending projects for this snapshot
    const { data, error } = await supabase
      .from('trending_projects')
      .select(
        `
        project_id,
        rank,
        score,
        projects (
          id,
          name,
          symbol,
          description,
          logo_url,
          status,
          kyc_status,
          sc_scan_status,
          metadata
        )
      `
      )
      .eq('snapshot_id', latestSnapshot.id)
      .eq('category', 'ALL')
      .eq('chain_scope', 'ALL')
      .order('rank', { ascending: true })
      .limit(5);

    if (error) {
      console.error('Error fetching trending projects:', error);
      return [];
    }

    // Map database format to frontend format
    return (data || []).map((item: any) => {
      const project = item.projects;
      const metadata = project.metadata || {};

      return {
        id: project.id,
        name: project.name,
        symbol: project.symbol || 'TBD',
        logo: project.logo_url || '/placeholder-logo.png',
        banner: metadata.banner_url || metadata.cover_image || '/placeholder-banner.jpg',
        description: project.description || '',
        type: metadata.type || 'presale',
        network: metadata.chain || 'SOL',
        currency: metadata.currency || (metadata.chain === 'SOL' ? 'SOL' : 'BNB'),
        status: mapProjectStatus(project.status),
        raised: metadata.raised || 0,
        target: metadata.target || 1000,
        participants: metadata.participants || 0,
        kyc_verified: !!(
          project.kyc_status === 'VERIFIED' ||
          project.metadata?.kyc_verified ||
          project.metadata?.safu
        ),
        audit_status:
          project.sc_scan_status === 'PASS' ||
          project.metadata?.audit_status ||
          project.metadata?.audit
            ? 'pass'
            : null,
        lp_lock: metadata.lp_lock || false,
      };
    });
  } catch (err) {
    console.error('Unexpected error in getTrendingProjects:', err);
    return [];
  }
}

/**
 * Get Featured Projects
 *
 * Fetches projects marked as featured in metadata
 * Fallback: Projects with highest raise ratio (raised/target)
 */
export async function getFeaturedProjects(): Promise<Project[]> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('status', 'LIVE')
      .contains('metadata', { featured: true })
      .limit(5);

    if (error) {
      console.error('Error fetching featured projects:', error);
      return [];
    }

    if (!data || data.length === 0) {
      // Fallback: Get high-performance projects
      const { data: fallbackData } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'LIVE')
        .order('created_at', { ascending: false })
        .limit(5);

      return mapProjectsToFrontend(fallbackData || []);
    }

    return mapProjectsToFrontend(data);
  } catch (err) {
    console.error('Unexpected error in getFeaturedProjects:', err);
    return [];
  }
}

/**
 * Get Project By ID
 *
 * Fetches a single project with full details.
 * Joins launch_rounds for live presale/fairlaunch data (V2.4).
 *
 * The `id` parameter can be either a project ID or a launch_round ID.
 */
export async function getProjectById(id: string): Promise<Project | null> {
  const supabase = createClient();

  try {
    // First try: id is a launch_round ID (used from explore page routing)
    const { data: roundData, error: roundError } = await supabase
      .from('launch_rounds')
      .select(
        `
        *,
        projects (
          id, name, symbol, description, logo_url, status,
          kyc_status, sc_scan_status, metadata, factory_address,
          website, twitter, telegram, discord, github
        ),
        vesting_schedules (
          contract_address
        )
      `
      )
      .eq('id', id)
      .single();

    if (roundError) {
      console.log('[getProjectById] Round Lookup Error/Empty:', roundError.message, id);
    }

    if (roundData) {
      let project = roundData.projects as any;

      // Fallback: If join failed (RLS or other issue) but we have project_id, fetch it manually
      if (!project && roundData.project_id) {
        console.log(
          '[getProjectById] Join failed, fetching project manually:',
          roundData.project_id
        );
        const { data: projectData } = await supabase
          .from('projects')
          .select('*')
          .eq('id', roundData.project_id)
          .single();

        if (projectData) {
          project = projectData;
        }
      }

      if (!project) {
        console.error('[getProjectById] Orphaned Round (No Project Linked):', id);
      } else {
        console.log('[getProjectById] Found Launch Round:', id);
        const params = (roundData.params as any) || {};

        return {
          id: roundData.id,
          name: params.project_name || project.name,
          symbol: params.token_symbol || project.symbol || 'TBD',
          logo: params.logo_url || project.logo_url || '/placeholder-logo.png',
          banner: params.banner_url || params.cover_image || '/placeholder-banner.jpg',
          description: params.project_description || project.description || '',
          type: (roundData.type?.toLowerCase() || 'presale') as 'presale' | 'fairlaunch',
          network: mapChainToNetwork(roundData.chain),
          currency: getCurrencySymbol(roundData.chain),
          chain: roundData.chain,
          status: calculateRealTimeStatus(roundData),
          raised: Number(roundData.total_raised) || 0,
          target: params.hardcap || params.softcap || 1000,
          softcap: params.softcap || 0,
          participants: roundData.total_participants || 0,
          kyc_verified: !!(
            project.kyc_status === 'VERIFIED' ||
            project.metadata?.kyc_verified ||
            project.metadata?.safu ||
            params.safu ||
            params.kyc ||
            (Array.isArray(project.metadata?.security_badges) &&
              project.metadata?.security_badges.includes('SAFU'))
          ),
          audit_status:
            project.sc_scan_status === 'PASS' ||
            project.metadata?.audit_status ||
            project.metadata?.audit ||
            params.audit ||
            params.audit_link ||
            (Array.isArray(project.metadata?.security_badges) &&
              (project.metadata?.security_badges.includes('SC_PASS') ||
                project.metadata?.security_badges.includes('AUDIT')))
              ? 'pass'
              : null,
          lp_lock: !!(params.lp_lock || params.lp_lock_months),
          contract_address: roundData.round_address || roundData.contract_address,
          token_address: roundData.token_address || params.token_address || null,
          vesting_address:
            roundData.vesting_vault_address ||
            params.vesting_address ||
            (roundData.vesting_schedules?.[0] as any)?.contract_address ||
            null,
          startDate: roundData.start_at,
          endDate: roundData.end_at,
          // ✅ Add metadata and factory_address for SAFU badges
          // Merge social links from params into metadata for Social Media tab
          metadata: {
            ...(project.metadata || {}),
            website: (project.metadata || {}).website || params.projectWebsite || project.website,
            twitter: (project.metadata || {}).twitter || params.twitter || project.twitter,
            telegram: (project.metadata || {}).telegram || params.telegram || project.telegram,
            discord: (project.metadata || {}).discord || params.discord || project.discord,
            github: params.github || project.github,
          },
          factory_address: project.factory_address || null,
          min_contribution: params.min_contribution ?? undefined,
          max_contribution: params.max_contribution ?? undefined,
          tokenomics: extractTokenomics(params),
        };
      }
    }

    // Second try: id is a project ID — join launch_rounds
    const { data, error } = await supabase
      .from('projects')
      .select(
        `
        *,
        launch_rounds (
          id, type, status, chain, start_at, end_at,
          contract_address, round_address, token_address,
          vesting_vault_address, total_raised,
          total_participants, params
        )
      `
      )
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error('Error fetching project:', error);
      return null;
    }

    // If project has launch_rounds, use the most relevant one
    const rounds = data.launch_rounds || [];
    const activeRound =
      rounds.find((r: any) =>
        ['DEPLOYED', 'LIVE', 'ACTIVE', 'ENDED'].includes(r.status?.toUpperCase())
      ) || rounds[0];

    if (activeRound) {
      const params = activeRound.params || {};
      return {
        id: activeRound.id, // Use round ID for detail page routing
        name: params.project_name || data.name,
        symbol: params.token_symbol || data.symbol || 'TBD',
        logo: params.logo_url || data.logo_url || '/placeholder-logo.png',
        banner: params.banner_url || params.cover_image || '/placeholder-banner.jpg',
        description: params.project_description || data.description || '',
        type: (activeRound.type?.toLowerCase() || 'presale') as 'presale' | 'fairlaunch',
        network: mapChainToNetwork(activeRound.chain),
        currency: getCurrencySymbol(activeRound.chain),
        chain: activeRound.chain,
        status: calculateRealTimeStatus(activeRound),
        raised: Number(activeRound.total_raised) || 0,
        target: params.hardcap || params.softcap || 1000,
        softcap: params.softcap || 0,
        participants: activeRound.total_participants || 0,
        kyc_verified: !!(
          data.kyc_status === 'VERIFIED' ||
          data.metadata?.kyc_verified ||
          data.metadata?.safu ||
          params.safu ||
          params.kyc ||
          (Array.isArray(data.metadata?.security_badges) &&
            data.metadata?.security_badges.includes('SAFU'))
        ),
        audit_status:
          data.sc_scan_status === 'PASS' ||
          data.metadata?.audit_status ||
          data.metadata?.audit ||
          params.audit ||
          params.audit_link ||
          (Array.isArray(data.metadata?.security_badges) &&
            (data.metadata?.security_badges.includes('SC_PASS') ||
              data.metadata?.security_badges.includes('AUDIT')))
            ? 'pass'
            : null,
        lp_lock: !!(params.lp_lock || params.lp_lock_months),
        contract_address: activeRound.round_address || activeRound.contract_address,
        token_address: activeRound.token_address || params.token_address || null,
        vesting_address: activeRound.vesting_vault_address || params.vesting_address || null,
        startDate: activeRound.start_at,
        endDate: activeRound.end_at,
        // Merge social links from params into metadata for Social Media tab
        metadata: {
          ...(data.metadata || {}),
          website: (data.metadata || {}).website || params.projectWebsite,
          twitter: (data.metadata || {}).twitter || params.twitter,
          telegram: (data.metadata || {}).telegram || params.telegram,
          discord: (data.metadata || {}).discord || params.discord,
        },
        min_contribution: params.min_contribution ?? undefined,
        max_contribution: params.max_contribution ?? undefined,
        tokenomics: extractTokenomics(params),
      };
    }

    // Fallback: no launch_rounds, use static metadata
    const mapped = mapProjectsToFrontend([data]);
    return mapped[0] || null;
  } catch (err) {
    console.error('Unexpected error in getProjectById:', err);
    return null;
  }
}

/**
 * Search/Filter Projects
 *
 * Supports filtering by status, network, type, and search query
 */
export async function getAllProjects(filters?: {
  status?: Project['status'];
  network?: Project['network'];
  type?: Project['type'];
  search?: string;
}): Promise<Project[]> {
  const supabase = createClient();

  try {
    // Query projects with launch_rounds joined
    const { data, error } = await supabase
      .from('projects')
      .select(
        `
        *,
        launch_rounds (
          id,
          type,
          status,
          chain,
          start_at,
          end_at,
          contract_address,
          total_raised,
          total_participants,
          params
        )
      `
      )
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      return [];
    }

    console.log('[Explore Debug] Total projects from DB:', data?.length || 0);
    console.log(
      '[Explore Debug] Sample project with rounds:',
      data?.[0]
        ? {
            projectName: data[0].name,
            projectStatus: data[0].status,
            roundsCount: data[0].launch_rounds?.length || 0,
            rounds: data[0].launch_rounds?.map((r: any) => ({
              id: r.id,
              status: r.status,
              type: r.type,
            })),
          }
        : 'No projects'
    );

    // Map each project with its launch_round data
    let projects = (data || []).flatMap((project: any) => {
      // If project has no launch_rounds, skip it
      if (!project.launch_rounds || project.launch_rounds.length === 0) {
        return [];
      }

      // Map each launch_round to a project entry
      // Filter: Only show rounds that are ready for public viewing
      return project.launch_rounds
        .filter((round: any) => {
          const status = round.status?.toUpperCase();
          console.log('[Explore Debug] Round status:', status, 'for project:', project.name);
          // Show if: APPROVED (approved by admin), DEPLOYED, LIVE, ACTIVE, ENDED, or FAILED (refunds available)
          return (
            status === 'APPROVED' ||
            status === 'DEPLOYED' ||
            status === 'LIVE' ||
            status === 'ACTIVE' ||
            status === 'ENDED' ||
            status === 'FINALIZED' ||
            status === 'FINALIZED_SUCCESS' ||
            status === 'FINALIZED_FAILED' ||
            status === 'CANCELLED' ||
            status === 'FAILED'
          );
        })
        .map((round: any) => {
          const params = round.params || {};

          return {
            id: round.id, // Use launch_round ID for correct detail page routing
            name: params.project_name || project.name,
            symbol: params.token_symbol || project.symbol || 'TBD',
            logo: params.logo_url || project.logo_url || '/placeholder-logo.png',
            banner: params.banner_url || params.cover_image || '/placeholder-banner.jpg',
            description: params.project_description || project.description || '',
            type: round.type?.toLowerCase() as 'presale' | 'fairlaunch',
            network: mapChainToNetwork(round.chain),
            currency: getCurrencySymbol(round.chain),
            chain: round.chain, // Add specific chain ID
            status: calculateRealTimeStatus(round),
            raised: Number(round.total_raised) || 0,
            target: params.hardcap || params.softcap || 1000,
            softcap: params.softcap || 0,
            participants: round.total_participants || 0,
            kyc_verified: !!(
              project.kyc_status === 'VERIFIED' ||
              project.metadata?.kyc_verified ||
              project.metadata?.safu ||
              params.safu ||
              params.kyc ||
              (Array.isArray(project.metadata?.security_badges) &&
                project.metadata?.security_badges.includes('SAFU'))
            ),
            audit_status:
              project.sc_scan_status === 'PASS' ||
              project.metadata?.audit_status ||
              project.metadata?.audit ||
              params.audit ||
              params.audit_link ||
              (Array.isArray(project.metadata?.security_badges) &&
                (project.metadata?.security_badges.includes('SC_PASS') ||
                  project.metadata?.security_badges.includes('AUDIT')))
                ? 'pass'
                : null,
            lp_lock: params.lp_lock || false,
            contract_address: round.contract_address, // Add contract address
            startDate: round.start_at, // ISO timestamp for countdown
            endDate: round.end_at, // ISO timestamp for countdown
            // ✅ Add metadata and factory_address for SAFU badges
            metadata: project.metadata || {},
            factory_address: project.factory_address || null,
            tokenomics: extractTokenomics(params),
          };
        });
    });

    console.log('[Explore Debug] Projects after filtering:', projects.length);
    if (projects.length > 0) {
      console.log('[Explore Debug] Sample filtered project:', {
        name: projects[0].name,
        status: projects[0].status,
        kyc: projects[0].kyc_verified,
        audit: projects[0].audit_status,
      });
    }

    // Client-side filtering
    if (filters?.network) {
      projects = projects.filter((p) => p.network === filters.network);
    }
    if (filters?.type) {
      projects = projects.filter((p) => p.type === filters.type);
    }
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      projects = projects.filter(
        (p) => p.name.toLowerCase().includes(search) || p.symbol.toLowerCase().includes(search)
      );
    }

    return projects;
  } catch (err) {
    console.error('Unexpected error in getAllProjects:', err);
    return [];
  }
}

/**
 * Get Bonding Curve Pools
 *
 * Fetches bonding curve pools from bonding_pools table
 * and maps them to the Project[] format for unified display
 */
export async function getBondingCurvePools(): Promise<Project[]> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('bonding_pools')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bonding pools:', error);
      return [];
    }

    return (data || []).map((pool: any) => {
      const bnbRaised = Number(pool.actual_native_reserves || 0) / 1e18;
      const threshold = Number(pool.graduation_threshold_native || 0) / 1e18;
      const isGraduated = pool.status === 'graduated';

      return {
        id: pool.id,
        name: pool.token_name || 'Unnamed Token',
        symbol: pool.token_symbol || 'TKN',
        logo: pool.logo_url || '/placeholder-logo.png',
        banner: pool.banner_url || '/placeholder-banner.jpg',
        description: pool.description || '',
        type: 'bonding_curve' as const,
        network: 'EVM' as const,
        chain: '97', // BSC Testnet
        currency: 'BNB',
        status: isGraduated ? 'ended' : 'live',
        raised: bnbRaised,
        target: threshold || 1,
        participants: 0,
        kyc_verified: false,
        audit_status: null,
        lp_lock: false,
        token_address: pool.token_address,
        metadata: {
          website: pool.website,
          twitter: pool.twitter,
          telegram: pool.telegram,
          isBondingCurve: true,
        },
      };
    });
  } catch (err) {
    console.error('Unexpected error in getBondingCurvePools:', err);
    return [];
  }
}

// Helper functions

function mapProjectsToFrontend(dbProjects: any[]): Project[] {
  return dbProjects.map((project) => {
    const metadata = project.metadata || {};

    return {
      id: project.id,
      name: project.name,
      symbol: project.symbol || 'TBD',
      logo: project.logo_url || '/placeholder-logo.png',
      banner: metadata.banner_url || metadata.cover_image || '/placeholder-banner.jpg',
      description: project.description || '',
      type: metadata.type || 'presale',
      network: metadata.chain || 'SOL',
      currency: metadata.currency || (metadata.chain === 'SOL' ? 'SOL' : 'BNB'),
      status: mapProjectStatus(project.status),
      raised: metadata.raised || 0,
      target: metadata.target || 1000,
      participants: metadata.participants || 0,
      kyc_verified: !!project.kyc_submission_id,
      audit_status: project.scan_result_id ? 'pass' : null,
      lp_lock: metadata.lp_lock || false,
    };
  });
}

function mapProjectStatus(dbStatus: string): 'live' | 'upcoming' | 'ended' {
  switch (dbStatus) {
    case 'LIVE':
      return 'live';
    case 'APPROVED':
    case 'DRAFT':
    case 'SUBMITTED':
    case 'IN_REVIEW':
      return 'upcoming';
    case 'ENDED':
    case 'FINALIZED':
    case 'FINALIZED_SUCCESS':
    case 'FINALIZED_FAILED':
    case 'CANCELLED':
    case 'FAILED':
    case 'REJECTED':
      return 'ended';
    default:
      return 'upcoming';
  }
}

function mapFrontendStatusToDb(frontendStatus: 'live' | 'upcoming' | 'ended'): string {
  switch (frontendStatus) {
    case 'live':
      return 'LIVE';
    case 'upcoming':
      return 'APPROVED';
    case 'ended':
      return 'ENDED';
  }
}

// Map chain ID to network type (EVM or SOL)
function mapChainToNetwork(chain: string): 'EVM' | 'SOL' {
  if (chain === 'SOLANA') return 'SOL';
  // All numeric chain IDs are EVM
  return 'EVM';
}

// Map launch_round status to frontend status
function mapLaunchRoundStatus(dbStatus: string): 'live' | 'upcoming' | 'ended' {
  switch (dbStatus) {
    case 'LIVE':
    case 'ACTIVE':
      return 'live';
    case 'APPROVED':
    case 'PENDING':
      return 'upcoming';
    case 'ENDED':
    case 'COMPLETED':
    case 'CANCELLED':
    case 'FINALIZED':
    case 'FINALIZED_SUCCESS':
    case 'FINALIZED_FAILED':
    case 'FAILED':
      return 'ended';
    default:
      return 'upcoming';
  }
}

/**
 * Calculate Real-Time Status
 *
 * This function determines the ACTUAL status of a launch round by checking
 * the current time against start_at and end_at timestamps.
 *
 * Priority:
 * 1. If current time >= end_at → ENDED
 * 2. If current time >= start_at && current time < end_at → LIVE
 * 3. If current time < start_at → UPCOMING
 *
 * Special cases:
 * - DEPLOYED status (Fairlaunch admin-deployed) → Depends on time
 * - ACTIVE status (Fairlaunch after start_at) → Treat as LIVE
 *
 * This OVERRIDES the database status field when necessary to ensure
 * the UI always reflects the real-time state.
 */
function calculateRealTimeStatus(round: any): 'live' | 'upcoming' | 'ended' {
  const now = new Date();
  const startAt = round.start_at ? new Date(round.start_at) : null;
  const endAt = round.end_at ? new Date(round.end_at) : null;
  const params = (round.params as any) || {};

  // Hardcap check: if totalRaised >= hardcap, presale is filled → ended
  const totalRaised = Number(round.total_raised) || 0;
  const hardcap = Number(params.hardcap) || 0;
  if (hardcap > 0 && totalRaised >= hardcap) {
    return 'ended';
  }

  // If timestamps are missing, fall back to database status
  if (!startAt || !endAt) {
    return mapLaunchRoundStatus(round.status);
  }

  // Time-based status calculation
  if (now >= endAt) {
    return 'ended';
  } else if (now >= startAt && now < endAt) {
    return 'live'; // DEPLOYED/ACTIVE rounds in this time range are LIVE
  } else {
    // Check if DEPLOYED before start_at
    if (round.status === 'DEPLOYED' || round.status === 'APPROVED') {
      return 'upcoming'; // Deployed but not started yet
    }
    return 'upcoming';
  }
}

function extractTokenomics(params: any) {
  // Handle both fairlaunch (tokens_for_sale) and presale (token_for_sale) field names
  const presale = Number(params.tokens_for_sale || params.token_for_sale || 0);
  const liquidity = Number(params.liquidity_tokens || 0);
  // Team allocation: fairlaunch uses team_vesting_tokens, presale uses team_vesting.team_allocation
  const team = Number(params.team_vesting_tokens || params.team_vesting?.team_allocation || 0);
  // If explicitly provided in params, use it. Otherwise sum components.
  const total = params.total_supply ? Number(params.total_supply) : presale + liquidity + team;

  // Liquidity percent: fairlaunch uses liquidity_percent, presale uses lp_lock.percentage
  const liquidityPercent = Number(params.liquidity_percent || params.lp_lock?.percentage || 0);

  return {
    total_supply: total,
    tokens_for_presale: presale,
    tokens_for_liquidity: liquidity,
    team_allocation: team,
    liquidity_percent: liquidityPercent,
  };
}

function getCurrencySymbol(chain: string): string {
  if (chain === '97' || chain === '56') return 'BNB';
  if (chain === '1' || chain === '11155111') return 'ETH';
  if (chain === 'SOLANA') return 'SOL';
  if (chain === '8453' || chain === '84532') return 'ETH'; // Base uses ETH
  return 'EVM';
}
