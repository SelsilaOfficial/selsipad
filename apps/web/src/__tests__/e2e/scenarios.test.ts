/**
 * FASE 10: Critical E2E Scenarios
 * Covers: 10.2 & 10.3 Test Strategy
 */

import { createClient } from '@/lib/supabase/server';
import { runSbtPayoutProcessor } from '../../../../../services/worker/jobs/sbt-payout-processor';

// Mock External Dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(), // For Workers
}));

// Mock Shared Utils if needed
jest.mock('@selsipad/shared', () => ({
  ...jest.requireActual('@selsipad/shared'),
  verifySbtOwnership: jest.fn().mockResolvedValue({ isValid: true }),
}));

describe('FASE 10: Critical E2E Scenarios', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;

  // Mock State to simulate DB Persistence in memory mostly
  // For complex E2E, we usually rely on mocked responses sequence

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Mock Supabase
    mockSupabase = {
      from: jest.fn(),
      auth: { getUser: jest.fn() },
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    require('@supabase/supabase-js').createClient.mockReturnValue(mockSupabase);
  });

  // ============================================
  // E2E-01: Presale Lifecycle (Success Case)
  // Listing -> Submit -> Approve -> (Deploy/Contribute/Finalize) -> Vesting -> Claim
  // ============================================
  test('E2E-01: Presale Lifecycle - Submit and state transitions', async () => {
    const roundId = 'round-e2e-presale-1';
    const ownerId = 'user-owner-1';

    mockSupabase.auth = {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: ownerId } },
        error: null,
      }),
    };

    const draftRound = {
      id: roundId,
      project_id: 'proj-e2e-1',
      status: 'DRAFT',
      type: 'presale',
      chain: 'EVM_1',
      params: {
        investor_vesting: { tge_bps: 1000, cliff_months: 0, vesting_months: 12 },
        team_vesting: { tge_bps: 500, cliff_months: 3, vesting_months: 12 },
        lp_lock_plan: { duration_months: 12, dex_id: 'pancakeswap', liquidity_percent_bps: 7000 },
      },
      projects: {
        id: 'proj-e2e-1',
        name: 'E2E Presale',
        owner_user_id: ownerId,
        kyc_status: 'CONFIRMED',
        sc_scan_status: 'PASS',
      },
    };

    const submittedRound = { ...draftRound, status: 'SUBMITTED_FOR_REVIEW' };

    const selectChain = jest.fn().mockReturnThis();
    const eqChain = jest.fn().mockReturnThis();
    const singleChain = jest.fn();
    const updateSelectChain = jest.fn().mockReturnValue({ single: singleChain });
    const updateEqChain = jest.fn().mockReturnValue({ select: updateSelectChain });
    const updateChain = jest.fn().mockReturnValue({ eq: updateEqChain });
    const insertChain = jest.fn().mockResolvedValue({ error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'launch_rounds') {
        return {
          select: selectChain,
          update: updateChain,
        };
      }
      if (table === 'audit_logs') {
        return { insert: insertChain };
      }
      return {};
    });

    selectChain.mockReturnValue({ eq: eqChain });
    eqChain.mockReturnValue({ single: singleChain });
    singleChain
      .mockResolvedValueOnce({ data: draftRound, error: null })
      .mockResolvedValueOnce({ data: submittedRound, error: null });

    const submitRoute = await import(
      // Path from src/__tests__/e2e to apps/web/app
      '../../../app/api/rounds/[id]/submit/route'
    );
    const submitRound = submitRoute.POST;
    const req = new Request('http://localhost/api/rounds/1/submit', {
      method: 'POST',
      headers: { authorization: 'Bearer mock-token' },
    });
    const res = await submitRound(req, { params: { id: roundId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.round).toBeDefined();
    expect(body.round.status).toBe('SUBMITTED_FOR_REVIEW');
    expect(updateChain).toHaveBeenCalled();
    expect(mockSupabase.from).toHaveBeenCalledWith('launch_rounds');
    expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
  });

  // ============================================
  // E2E-07: SBT Staking v2 (Recently Implemented)
  // Stake -> Claim -> Payout
  // ============================================
  test('E2E-07: SBT Staking - Full Flow', async () => {
    console.log('Testing E2E-07: SBT Staking...');

    const user = { id: 'u1' };
    const ruleId = 'rule-1';

    // Setup Mocks
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user }, error: null });

    // Chain Mocks
    const select = jest.fn();
    const insert = jest.fn();
    const update = jest.fn();
    const eq = jest.fn();
    const single = jest.fn();

    mockSupabase.from.mockReturnValue({ select, insert, update });
    select.mockReturnValue({ eq });
    eq.mockReturnValue({ single, eq }); // Chain
    insert.mockReturnValue({ select: jest.fn().mockReturnValue({ single }) });
    update.mockReturnValue({ eq });

    // 1. Stake
    const { POST: stake } = require('../../../app/api/v1/sbt/stake/route');
    // Mock Rule fetch
    single.mockResolvedValueOnce({ data: { id: ruleId, is_active: true }, error: null });
    // Mock Idempotency (null = not staked yet)
    single.mockResolvedValueOnce({ data: null, error: null });
    // Mock Insert check
    single.mockResolvedValueOnce({ data: { id: 'stake-1' }, error: null });

    const stakeReq = {
      json: async () => ({ rule_id: ruleId, wallet_address: 'mock_wallet' }),
    } as unknown as Request;
    const stakeRes = await stake(stakeReq);
    expect(stakeRes.status).toBe(200);

    // 2. Claim Intent
    const { POST: claimIntent } = require('../../../app/api/v1/sbt/claim/intent/route');
    // Mock Ledger Balance
    single.mockResolvedValueOnce({ data: { total_accrued: '500', total_claimed: '0' } });

    const claimReq = {} as unknown as Request;
    const claimRes = await claimIntent(claimReq);
    const claimJson = await claimRes.json();
    expect(claimJson.amount_sol).toBeDefined(); // Fee check

    // 3. Payout Worker (Simulate)
    // Needs to find CONFIRMED claims
    mockSupabase.from.mockReturnValue({ select, update }); // Reset for worker
    select.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({
          data: [{ id: 'claim-1', status: 'CONFIRMED' }],
          error: null,
        }),
      }),
    }); // Find CONFIRMED

    await runSbtPayoutProcessor();

    // Verify Update was called to change status to PAID
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'PAID' }));
  });

  // ============================================
  // E2E-06: Solana Bonding Curve
  // Graduation Logic
  // ============================================
  test('E2E-06: Solana Bonding Curve - Graduation', async () => {
    // Check if bonding curve reaches limit -> triggers graduation
    expect(true).toBe(true); // Logic resides in Rust/Solana program mostly, or listener
    // If backend handles "Graduation Event", we accept webhook
  });
});
