'use server';

import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface InvestedProject {
  projectId: string;
  name: string;
  symbol: string;
  logoUrl: string | null;
  chain: string;
  totalContributed: number;
  currency: string;
  contributionCount: number;
  lastContributedAt: string;
  status: string;
}

export interface ClaimScheduleItem {
  allocationId: string;
  projectId: string;
  projectName: string;
  projectSymbol: string;
  tokensAllocated: number;
  tokensClaimed: number;
  tokensClaimable: number;
  vestingTotal: number;
  tgePercentage: number;
  status: 'ready' | 'upcoming' | 'completed';
  createdAt: string;
}

export interface TransactionItem {
  id: string;
  projectId: string;
  projectName: string;
  projectSymbol: string;
  type: 'contribution' | 'claim' | 'refund';
  amount: number;
  currency: string;
  status: 'pending' | 'success' | 'failed' | 'finalizing';
  txHash: string | null;
  createdAt: string;
}

export interface PortfolioData {
  investedProjects: InvestedProject[];
  claimSchedule: ClaimScheduleItem[];
  transactions: TransactionItem[];
  stats: {
    totalInvested: number;
    totalClaimable: number;
    projectCount: number;
    transactionCount: number;
  };
}

/* ------------------------------------------------------------------ */
/*  Main Fetcher                                                       */
/* ------------------------------------------------------------------ */

export async function getPortfolioData(): Promise<PortfolioData> {
  const session = await getServerSession();

  if (!session) {
    return emptyPortfolio();
  }

  const supabase = createClient();
  const userId = session.userId;

  // Fetch all data in parallel
  const [investedProjects, claimSchedule, transactions] = await Promise.all([
    fetchInvestedProjects(supabase, userId),
    fetchClaimSchedule(supabase, userId),
    fetchTransactions(supabase, userId),
  ]);

  // Calculate stats
  const totalInvested = investedProjects.reduce((sum, p) => sum + p.totalContributed, 0);
  const totalClaimable = claimSchedule
    .filter((c) => c.status === 'ready')
    .reduce((sum, c) => sum + c.tokensClaimable, 0);

  return {
    investedProjects,
    claimSchedule,
    transactions,
    stats: {
      totalInvested,
      totalClaimable,
      projectCount: investedProjects.length,
      transactionCount: transactions.length,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Invested Projects                                                  */
/* ------------------------------------------------------------------ */

async function fetchInvestedProjects(supabase: any, userId: string): Promise<InvestedProject[]> {
  try {
    // No FK between contributions and projects — fetch separately
    const { data: contributions, error } = await supabase
      .from('contributions')
      .select('id, amount, chain, created_at, project_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Portfolio] Error fetching contributions:', error);
      return [];
    }

    if (!contributions || contributions.length === 0) return [];

    // Fetch project details separately
    const projectIds = [
      ...new Set((contributions as any[]).map((c: any) => c.project_id).filter(Boolean)),
    ];
    const projectLookup = new Map<string, any>();

    if (projectIds.length > 0) {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name, symbol, logo_url, status')
        .in('id', projectIds);
      (projects || []).forEach((p: any) => projectLookup.set(p.id, p));
    }

    // Group contributions by project
    const grouped = new Map<string, InvestedProject>();

    (contributions as any[]).forEach((contrib: any) => {
      const projectId = contrib.project_id || 'unknown';
      const project = projectLookup.get(projectId) || {};
      const amount = parseFloat(contrib.amount || '0');
      const chain = contrib.chain || 'BSC';

      const existing = grouped.get(projectId);
      if (existing) {
        existing.totalContributed += amount;
        existing.contributionCount += 1;
        if (contrib.created_at > existing.lastContributedAt) {
          existing.lastContributedAt = contrib.created_at;
        }
      } else {
        grouped.set(projectId, {
          projectId,
          name: project.name || 'Unknown Project',
          symbol: project.symbol || '---',
          logoUrl: project.logo_url || null,
          chain,
          totalContributed: amount,
          currency: chain === 'SOLANA' ? 'SOL' : 'BNB',
          contributionCount: 1,
          lastContributedAt: contrib.created_at,
          status: project.status || 'unknown',
        });
      }
    });

    return Array.from(grouped.values()).sort(
      (a, b) => new Date(b.lastContributedAt).getTime() - new Date(a.lastContributedAt).getTime()
    );
  } catch (err) {
    console.error('[Portfolio] Unexpected error in fetchInvestedProjects:', err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Claim Schedule                                                     */
/* ------------------------------------------------------------------ */

async function fetchClaimSchedule(supabase: any, userId: string): Promise<ClaimScheduleItem[]> {
  try {
    const { data, error } = await supabase
      .from('vesting_allocations')
      .select(
        `
        id,
        allocation_tokens,
        claimed_tokens,
        created_at,
        vesting_schedules!schedule_id (
          id,
          total_tokens,
          tge_percentage,
          launch_rounds!round_id (
            id,
            project_id,
            projects (
              id,
              name,
              symbol
            )
          )
        )
      `
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Portfolio] Error fetching vesting allocations:', error);
      return [];
    }

    return (data || []).map((alloc: any) => {
      const schedule = alloc.vesting_schedules || {};
      const round = schedule.launch_rounds || {};
      const project = round.projects || {};

      const allocated = parseFloat(alloc.allocation_tokens || '0');
      const claimed = parseFloat(alloc.claimed_tokens || '0');
      const claimable = Math.max(0, allocated - claimed);
      const tgePercentage = parseFloat(schedule.tge_percentage || '0');

      let status: 'ready' | 'upcoming' | 'completed' = 'upcoming';
      if (claimed >= allocated && allocated > 0) {
        status = 'completed';
      } else if (claimable > 0) {
        status = 'ready';
      }

      return {
        allocationId: alloc.id,
        projectId: project.id || 'unknown',
        projectName: project.name || 'Unknown Project',
        projectSymbol: project.symbol || '---',
        tokensAllocated: allocated,
        tokensClaimed: claimed,
        tokensClaimable: claimable,
        vestingTotal: allocated,
        tgePercentage,
        status,
        createdAt: alloc.created_at,
      };
    });
  } catch (err) {
    console.error('[Portfolio] Unexpected error in fetchClaimSchedule:', err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Transactions                                                       */
/* ------------------------------------------------------------------ */

async function fetchTransactions(supabase: any, userId: string): Promise<TransactionItem[]> {
  try {
    // No FK between transactions and projects — fetch separately
    const { data: txData, error } = await supabase
      .from('transactions')
      .select('id, type, status, tx_hash, metadata, created_at, project_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Portfolio] Error fetching transactions:', error);
      return [];
    }

    if (!txData || txData.length === 0) return [];

    // Fetch project details separately
    const projectIds = [
      ...new Set((txData as any[]).map((t: any) => t.project_id).filter(Boolean)),
    ];
    const projectLookup = new Map<string, any>();

    if (projectIds.length > 0) {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name, symbol')
        .in('id', projectIds);
      (projects || []).forEach((p: any) => projectLookup.set(p.id, p));
    }

    return (txData as any[]).map((tx: any) => {
      const project = projectLookup.get(tx.project_id) || {};
      const metadata = tx.metadata || {};

      return {
        id: tx.id,
        projectId: tx.project_id || 'unknown',
        projectName: project.name || 'Unknown Project',
        projectSymbol: project.symbol || '---',
        type: mapTxType(tx.type),
        amount: metadata.amount || 0,
        currency: metadata.currency || 'BNB',
        status: mapTxStatus(tx.status),
        txHash: tx.tx_hash || null,
        createdAt: tx.created_at,
      };
    });
  } catch (err) {
    console.error('[Portfolio] Unexpected error in fetchTransactions:', err);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function mapTxType(dbType: string): 'contribution' | 'claim' | 'refund' {
  switch (dbType) {
    case 'CONTRIBUTE':
      return 'contribution';
    case 'CLAIM':
      return 'claim';
    case 'REFUND':
      return 'refund';
    default:
      return 'contribution';
  }
}

function mapTxStatus(dbStatus: string): 'pending' | 'success' | 'failed' | 'finalizing' {
  switch (dbStatus) {
    case 'CREATED':
    case 'SUBMITTED':
      return 'pending';
    case 'PENDING':
      return 'finalizing';
    case 'CONFIRMED':
      return 'success';
    case 'FAILED':
      return 'failed';
    default:
      return 'pending';
  }
}

function emptyPortfolio(): PortfolioData {
  return {
    investedProjects: [],
    claimSchedule: [],
    transactions: [],
    stats: {
      totalInvested: 0,
      totalClaimable: 0,
      projectCount: 0,
      transactionCount: 0,
    },
  };
}
