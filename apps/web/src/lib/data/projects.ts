// Data layer for Projects - REAL API INTEGRATION
// Replaces stub data with Supabase queries

import { createClient } from '@/lib/supabase/client';

export interface Project {
  id: string;
  name: string;
  symbol: string;
  logo: string; // Maps to logo_url in DB
  description: string;
  type: 'presale' | 'fairlaunch';
  network: 'SOL' | 'EVM';
  chain?: string; // Specific chain ID (97, 56, 1, 11155111, 8453, 84532, etc.)
  status: 'live' | 'upcoming' | 'ended';
  raised: number;
  target: number;
  kyc_verified: boolean;
  audit_status: 'pass' |'pending' | null;
  lp_lock: boolean;
  contract_address?: string; // Fairlaunch/Presale contract address
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
          kyc_submission_id,
          scan_result_id,
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
        description: project.description || '',
        type: metadata.type || 'presale',
        network: metadata.chain || 'SOL',
        status: mapProjectStatus(project.status),
        raised: metadata.raised || 0,
        target: metadata.target || 1000,
        kyc_verified: !!project.kyc_submission_id,
        audit_status: project.scan_result_id ? 'pass' : null,
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
 * Fetches a single project with full details
 */
export async function getProjectById(id: string): Promise<Project | null> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();

    if (error) {
      console.error('Error fetching project:', error);
      return null;
    }

    if (!data) return null;

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
      .select(`
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
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      return [];
    }

    console.log('[Explore Debug] Total projects from DB:', data?.length || 0);
    console.log('[Explore Debug] Sample project with rounds:', data?.[0] ? {
      projectName: data[0].name,
      projectStatus: data[0].status,
      roundsCount: data[0].launch_rounds?.length || 0,
      rounds: data[0].launch_rounds?.map((r: any) => ({
        id: r.id,
        status: r.status,
        type: r.type,
      }))
    } : 'No projects');

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
          // Show if: APPROVED_TO_DEPLOY (approved by admin), DEPLOYED, LIVE, ACTIVE, or ENDED
          return status === 'APPROVED_TO_DEPLOY' || status === 'APPROVED' || status === 'DEPLOYED' || status === 'LIVE' || status === 'ACTIVE' || status === 'ENDED';
        })
        .map((round: any) => {
        const params = round.params || {};
        
        return {
          id: round.id, // Use launch_round ID for correct detail page routing
          name: params.project_name || project.name,
          symbol: params.token_symbol || project.symbol || 'TBD',
          logo: params.logo_url || project.logo_url || '/placeholder-logo.png',
          description: params.project_description || project.description || '',
          type: round.type?.toLowerCase() as 'presale' | 'fairlaunch',
          network: mapChainToNetwork(round.chain),
          chain: round.chain, // Add specific chain ID
          status: calculateRealTimeStatus(round),
          raised: Number(round.total_raised) || 0,
          target: params.softcap || params.hardcap || 1000,
          kyc_verified: !!project.kyc_submission_id,
          audit_status: project.scan_result_id ? 'pass' : null,
          lp_lock: params.lp_lock || false,
          contract_address: round.contract_address, // Add contract address
        };
      });
    });

    console.log('[Explore Debug] Projects after filtering:', projects.length);
    if (projects.length > 0) {
      console.log('[Explore Debug] Sample filtered project:', {
        name: projects[0].name,
        status: projects[0].status,
        type: projects[0].type,
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

// Helper functions

function mapProjectsToFrontend(dbProjects: any[]): Project[] {
  return dbProjects.map((project) => {
    const metadata = project.metadata || {};

    return {
      id: project.id,
      name: project.name,
      symbol: project.symbol || 'TBD',
      logo: project.logo_url || '/placeholder-logo.png',
      description: project.description || '',
      type: metadata.type || 'presale',
      network: metadata.chain || 'SOL',
      status: mapProjectStatus(project.status),
      raised: metadata.raised || 0,
      target: metadata.target || 1000,
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
 * This OVERRIDES the database status field when necessary to ensure
 * the UI always reflects the real-time state.
 */
function calculateRealTimeStatus(round: any): 'live' | 'upcoming' | 'ended' {
  const now = new Date();
  const startAt = round.start_at ? new Date(round.start_at) : null;
  const endAt = round.end_at ? new Date(round.end_at) : null;

  // If timestamps are missing, fall back to database status
  if (!startAt || !endAt) {
    return mapLaunchRoundStatus(round.status);
  }

  // Time-based status calculation
  if (now >= endAt) {
    return 'ended';
  } else if (now >= startAt && now < endAt) {
    return 'live';
  } else {
    return 'upcoming';
  }
}
