/**
 * Post-Finalize Orchestrator Worker
 * Automatically sets up vesting and liquidity lock after round finalization
 *
 * Triggers:
 * - Round status → FINALIZED with result SUCCESS
 * - Retry for PENDING progress records
 *
 * Run: Every 5 minutes via cron
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PostFinalizeProgress {
  id: string;
  round_id: string;
  vesting_setup_status: string;
  lock_setup_status: string;
  retry_count: number;
  last_error?: string;
}

/**
 * Get or create progress tracker for round
 */
async function getOrCreateProgress(roundId: string): Promise<PostFinalizeProgress | null> {
  // Try to get existing progress
  const { data: existing } = await supabase
    .from('round_post_finalize')
    .select('*')
    .eq('round_id', roundId)
    .maybeSingle();

  if (existing) {
    return existing as PostFinalizeProgress;
  }

  // Create new progress record
  const { data: created, error } = await supabase
    .from('round_post_finalize')
    .insert({
      round_id: roundId,
      vesting_setup_status: 'PENDING',
      lock_setup_status: 'PENDING',
    })
    .select()
    .single();

  if (error) {
    console.error(`Error creating progress for round ${roundId}:`, error);
    return null;
  }

  return created as PostFinalizeProgress;
}

/**
 * Setup vesting schedule for round
 */
async function setupVestingSchedule(roundId: string): Promise<boolean> {
  try {
    console.log(`Setting up vesting for round ${roundId}...`);

    // Check if vesting already exists
    const { data: existing } = await supabase
      .from('vesting_schedules')
      .select('id')
      .eq('round_id', roundId)
      .maybeSingle();

    if (existing) {
      console.log(`Vesting already exists for round ${roundId}`);
      return true;
    }

    // Get round details
    const { data: round } = await supabase
      .from('launch_rounds')
      .select('*, projects(token_address, chain)')
      .eq('id', roundId)
      .single();

    if (!round) {
      console.error(`Round ${roundId} not found`);
      return false;
    }

    // TODO: Get vesting parameters from round or project config
    // For now, use default parameters
    const vestingParams = {
      tge_percentage: 20, // 20% at TGE
      cliff_months: 3,
      vesting_months: 12,
      interval_type: 'MONTHLY' as const,
    };

    // Create vesting schedule
    const { data: schedule, error } = await supabase
      .from('vesting_schedules')
      .insert({
        round_id: roundId,
        token_address: round.projects?.token_address || 'TBD',
        chain: round.projects?.chain || round.chain,
        total_tokens: round.total_raised.toString(),
        tge_percentage: vestingParams.tge_percentage,
        tge_at: round.finalized_at,
        cliff_months: vestingParams.cliff_months,
        vesting_months: vestingParams.vesting_months,
        interval_type: vestingParams.interval_type,
        status: 'PENDING',
      })
      .select()
      .single();

    if (error) {
      console.error(`Error creating vesting schedule:`, error);
      return false;
    }

    // Create allocations for all contributors
    const { data: allocations } = await supabase
      .from('round_allocations')
      .select('user_id, allocation_tokens')
      .eq('round_id', roundId);

    if (allocations && allocations.length > 0) {
      const vestingAllocations = allocations.map((alloc) => ({
        schedule_id: schedule.id,
        round_id: roundId,
        user_id: alloc.user_id,
        allocation_tokens: alloc.allocation_tokens,
      }));

      await supabase.from('vesting_allocations').insert(vestingAllocations);
    }

    console.log(`✅ Vesting setup completed for round ${roundId}`);
    return true;
  } catch (err) {
    console.error(`Error in setupVestingSchedule:`, err);
    return false;
  }
}

/**
 * Initiate liquidity lock for round
 */
async function initiateLiquidityLock(roundId: string): Promise<boolean> {
  try {
    console.log(`Initiating liquidity lock for round ${roundId}...`);

    // Check if lock already exists
    const { data: existing } = await supabase
      .from('liquidity_locks')
      .select('id')
      .eq('round_id', roundId)
      .maybeSingle();

    if (existing) {
      console.log(`Liquidity lock already exists for round ${roundId}`);
      return true;
    }

    // Get round details
    const { data: round } = await supabase
      .from('launch_rounds')
      .select('*, projects(chain)')
      .eq('id', roundId)
      .single();

    if (!round) {
      console.error(`Round ${roundId} not found`);
      return false;
    }

    // TODO: Get lock parameters from round or project config
    // For now, create placeholder lock
    const { error } = await supabase.from('liquidity_locks').insert({
      round_id: roundId,
      chain: round.projects?.chain || round.chain,
      dex_type: 'UNISWAP_V2', // Default, should be from config
      lp_token_address: 'TBD',
      lock_amount: '0', // To be filled when LP tokens created
      lock_duration_months: 12, // Minimum
      status: 'PENDING',
    });

    if (error) {
      console.error(`Error creating liquidity lock:`, error);
      return false;
    }

    console.log(`✅ Liquidity lock initiated for round ${roundId}`);
    return true;
  } catch (err) {
    console.error(`Error in initiateLiquidityLock:`, err);
    return false;
  }
}

/**
 * Check if all success gates are passed
 */
async function checkSuccessGating(roundId: string): Promise<boolean> {
  const { data: round } = await supabase
    .from('launch_rounds')
    .select('result, vesting_status, lock_status, success_gated_at')
    .eq('id', roundId)
    .single();

  if (!round) return false;

  // All three gates must pass
  const allPassed =
    round.result === 'SUCCESS' &&
    round.vesting_status === 'CONFIRMED' &&
    round.lock_status === 'LOCKED';

  if (allPassed && !round.success_gated_at) {
    // Mark as success
    await supabase
      .from('launch_rounds')
      .update({ success_gated_at: new Date().toISOString() })
      .eq('id', roundId);

    console.log(`🎉 Round ${roundId} marked as SUCCESS (all gates passed)`);
  }

  return allPassed;
}

/**
 * Execute post-finalization orchestration for a round
 */
async function executePostFinalize(roundId: string): Promise<void> {
  console.log(`\n📋 Processing round ${roundId}...`);

  // Get or create progress tracker
  const progress = await getOrCreateProgress(roundId);
  if (!progress) {
    console.error(`Failed to get progress for round ${roundId}`);
    return;
  }

  let hasError = false;
  let errorMessage = '';

  // Setup vesting (if not completed)
  if (progress.vesting_setup_status !== 'COMPLETED') {
    console.log(`  → Vesting setup: ${progress.vesting_setup_status}`);

    const success = await setupVestingSchedule(roundId);
    if (success) {
      await supabase
        .from('round_post_finalize')
        .update({
          vesting_setup_status: 'COMPLETED',
          vesting_setup_at: new Date().toISOString(),
        })
        .eq('id', progress.id);
    } else {
      hasError = true;
      errorMessage += 'Vesting setup failed. ';
    }
  }

  // Setup liquidity lock (if not completed)
  if (progress.lock_setup_status !== 'COMPLETED') {
    console.log(`  → Lock setup: ${progress.lock_setup_status}`);

    const success = await initiateLiquidityLock(roundId);
    if (success) {
      await supabase
        .from('round_post_finalize')
        .update({
          lock_setup_status: 'COMPLETED',
          lock_setup_at: new Date().toISOString(),
        })
        .eq('id', progress.id);
    } else {
      hasError = true;
      errorMessage += 'Lock setup failed. ';
    }
  }

  // Update retry count and error
  if (hasError) {
    await supabase
      .from('round_post_finalize')
      .update({
        retry_count: progress.retry_count + 1,
        last_retry_at: new Date().toISOString(),
        last_error: errorMessage.trim(),
      })
      .eq('id', progress.id);
  } else if (
    progress.vesting_setup_status === 'COMPLETED' &&
    progress.lock_setup_status === 'COMPLETED'
  ) {
    // Mark as completed
    await supabase
      .from('round_post_finalize')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', progress.id);

    console.log(`✅ Post-finalize orchestration completed for round ${roundId}`);
  }

  // Check success gating
  await checkSuccessGating(roundId);
}

/**
 * Main orchestrator function
 */
export async function runPostFinalizeOrchestrator(): Promise<void> {
  console.log('\n🔄 Running Post-Finalize Orchestrator...');
  console.log('Time:', new Date().toISOString());

  try {
    // Find finalized successful rounds without completed post-finalize
    // finalize-fairlaunch.ts sets status to 'SUCCESS', but older rounds may use 'FINALIZED'
    const { data: rounds, error } = await supabase
      .from('launch_rounds')
      .select('id')
      .in('status', ['SUCCESS', 'FINALIZED'])
      .eq('result', 'SUCCESS')
      .is('success_gated_at', null)
      .limit(10);

    if (error) {
      console.error('Error fetching rounds:', error);
      return;
    }

    if (!rounds || rounds.length === 0) {
      console.log('No rounds to process');
      return;
    }

    console.log(`Found ${rounds.length} rounds to process`);

    // Process each round
    for (const round of rounds) {
      await executePostFinalize(round.id);
    }

    console.log('\n✅ Orchestrator completed successfully\n');
  } catch (err) {
    console.error('❌ Orchestrator error:', err);
    throw err;
  }
}

// Run directly if this is the main module
runPostFinalizeOrchestrator()
  .then(() => {
    console.log('Orchestrator finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Orchestrator failed:', error);
    process.exit(1);
  });
