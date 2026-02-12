/**
 * Scanner Execution Service
 *
 * Background job that processes pending scan runs
 * Call this from Edge Function, cron job, or queue worker
 */

import { createClient } from '@supabase/supabase-js';
import { evmScanner } from './evm-scanner';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Process all pending scans
 * Can be called from:
 * - Edge Function (triggered on scan creation)
 * - Cron job (every 30s)
 * - Queue worker (BullMQ, etc.)
 */
export async function processPendingScans() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Get all pending or running scans
    const { data: scans, error } = await supabase
      .from('sc_scan_results')
      .select('*')
      .in('status', ['PENDING', 'RUNNING'])
      .order('created_at', { ascending: true })
      .limit(10); // Process 10 at a time

    if (error || !scans || scans.length === 0) {
      return { success: true, processed: 0 };
    }

    console.log(`Processing ${scans.length} pending scans`);

    let processed = 0;
    for (const scan of scans) {
      try {
        await processSingleScan(scan.id, scan.network, scan.target_address, scan.chain);
        processed++;
      } catch (error) {
        console.error(`Failed to process scan ${scan.id}:`, error);
      }
    }

    return { success: true, processed };
  } catch (error) {
    console.error('Process scans error:', error);
    return { success: false, error };
  }
}

/**
 * Process a single scan run
 */
async function processSingleScan(
  scanId: string,
  network: string,
  targetAddress: string,
  chain?: string
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Update to RUNNING
  await supabase.from('sc_scan_results').update({ status: 'RUNNING' }).eq('id', scanId);

  try {
    // Run scanner based on network
    // Pass chain identifier (e.g. bsc_testnet, 97) for RPC resolution
    const scanNetwork = chain || network;
    let result;
    if (network.startsWith('EVM') || network === 'EVM') {
      result = await evmScanner.scan(targetAddress, scanNetwork);
    } else if (network === 'SOLANA') {
      // TODO: Implement Solana scanner
      throw new Error('Solana scanner not implemented yet');
    } else {
      throw new Error(`Unsupported network: ${network}`);
    }

    // Update scan result
    await supabase
      .from('sc_scan_results')
      .update({
        status: result.status,
        score: result.risk_score,
        risk_flags: result.risk_flags,
        summary: result.summary,
        raw_findings: result.raw_findings,
        finished_at: new Date().toISOString(),
      })
      .eq('id', scanId);

    // Update project scan status
    const { data: scan } = await supabase
      .from('sc_scan_results')
      .select('project_id')
      .eq('id', scanId)
      .single();

    if (scan?.project_id) {
      await supabase
        .from('projects')
        .update({ sc_scan_status: result.status })
        .eq('id', scan.project_id);

      // If PASS, auto-issue PROJECT_AUDITED badge
      if (result.status === 'PASS') {
        const { data: badge } = await supabase
          .from('badge_definitions')
          .select('id')
          .eq('badge_key', 'PROJECT_AUDITED')
          .single();

        if (badge) {
          await supabase
            .from('project_badges')
            .insert({
              project_id: scan.project_id,
              badge_id: badge.id,
              awarded_by: null, // Auto-award (system)
              reason: 'External contract passed security scan',
            })
            .onConflict('project_id,badge_id')
            .merge();
        }
      }
    }

    console.log(`Scan ${scanId} completed: ${result.status}`);
  } catch (error: any) {
    console.error(`Scan ${scanId} failed:`, error);

    // Update as FAIL
    await supabase
      .from('sc_scan_results')
      .update({
        status: 'FAIL',
        summary: `Scan execution failed: ${error.message}`,
        finished_at: new Date().toISOString(),
      })
      .eq('id', scanId);
  }
}

/**
 * Process specific scan by ID (for manual trigger)
 */
export async function processScanById(scanId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: scan, error } = await supabase
    .from('sc_scan_results')
    .select('*')
    .eq('id', scanId)
    .single();

  if (error || !scan) {
    throw new Error('Scan not found');
  }

  await processSingleScan(scan.id, scan.network, scan.target_address, scan.chain);
}
